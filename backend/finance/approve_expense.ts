import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { financeDB } from "./db";
import { financeEvents } from "./events";
import { v4 as uuidv4 } from 'uuid';
import { toISTDateString } from "../shared/date_utils";

// Helper function to remove transaction from daily cash balance when rejected/deleted
async function removeDailyCashBalanceForTransaction(tx: any, params: {
  orgId: number;
  propertyId: number;
  date: string;
  transactionType: 'revenue' | 'expense';
  amountCents: number;
  paymentMode: string;
}) {
  const { orgId, propertyId, date, transactionType, amountCents, paymentMode } = params;
  
  try {
    // Determine decrements (negative of increments)
    const cashRevenueDecrement = transactionType === 'revenue' && paymentMode === 'cash' ? amountCents : 0;
    const bankRevenueDecrement = transactionType === 'revenue' && paymentMode === 'bank' ? amountCents : 0;
    const cashExpenseDecrement = transactionType === 'expense' && paymentMode === 'cash' ? amountCents : 0;
    const bankExpenseDecrement = transactionType === 'expense' && paymentMode === 'bank' ? amountCents : 0;

    // Subtract from daily_cash_balances
    await tx.exec`
      UPDATE daily_cash_balances
      SET
        cash_received_cents = GREATEST(0, cash_received_cents - ${cashRevenueDecrement}),
        bank_received_cents = GREATEST(0, bank_received_cents - ${bankRevenueDecrement}),
        cash_expenses_cents = GREATEST(0, cash_expenses_cents - ${cashExpenseDecrement}),
        bank_expenses_cents = GREATEST(0, bank_expenses_cents - ${bankExpenseDecrement}),
        closing_balance_cents = opening_balance_cents + 
                                GREATEST(0, cash_received_cents - ${cashRevenueDecrement}) - 
                                GREATEST(0, cash_expenses_cents - ${cashExpenseDecrement}),
        calculated_closing_balance_cents = opening_balance_cents + 
                                           GREATEST(0, cash_received_cents - ${cashRevenueDecrement}) - 
                                           GREATEST(0, cash_expenses_cents - ${cashExpenseDecrement}),
        balance_discrepancy_cents = 0,
        updated_at = NOW()
      WHERE org_id = ${orgId}
        AND property_id = ${propertyId}
        AND balance_date = ${date}
    `;

    console.log(`[Finance] Removed transaction from daily_cash_balances for property ${propertyId} on ${date}`);
  } catch (error) {
    console.error('[Finance] Error removing transaction from daily_cash_balances:', error);
    throw error;
  }
}

// Helper function to update daily cash balance when a transaction is approved
async function updateDailyCashBalanceForTransaction(tx: any, params: {
  orgId: number;
  propertyId: number;
  date: string;
  transactionType: 'revenue' | 'expense';
  amountCents: number;
  paymentMode: string;
}) {
  const { orgId, propertyId, date, transactionType, amountCents, paymentMode } = params;
  
  try {
    // Calculate opening balance from previous day
    const previousDate = new Date(date);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousDateStr = previousDate.toISOString().split('T')[0];

    const previousBalance = await tx.queryRow`
      SELECT closing_balance_cents FROM daily_cash_balances
      WHERE org_id = ${orgId} 
        AND property_id = ${propertyId} 
        AND balance_date = ${previousDateStr}
    `;

    const openingBalanceCents = previousBalance ? parseInt(previousBalance.closing_balance_cents) || 0 : 0;
    
    // Determine increments based on transaction type and payment mode
    const cashRevenueIncrement = transactionType === 'revenue' && paymentMode === 'cash' ? amountCents : 0;
    const bankRevenueIncrement = transactionType === 'revenue' && paymentMode === 'bank' ? amountCents : 0;
    const cashExpenseIncrement = transactionType === 'expense' && paymentMode === 'cash' ? amountCents : 0;
    const bankExpenseIncrement = transactionType === 'expense' && paymentMode === 'bank' ? amountCents : 0;

    // Use INSERT ... ON CONFLICT ... DO UPDATE for atomic upsert
    await tx.exec`
      INSERT INTO daily_cash_balances (
        org_id, property_id, balance_date, opening_balance_cents,
        cash_received_cents, bank_received_cents, cash_expenses_cents,
        bank_expenses_cents, closing_balance_cents,
        is_opening_balance_auto_calculated, calculated_closing_balance_cents,
        balance_discrepancy_cents, created_by_user_id, created_at, updated_at
      )
      VALUES (
        ${orgId}, ${propertyId}, ${date}, ${openingBalanceCents},
        ${cashRevenueIncrement}, ${bankRevenueIncrement}, ${cashExpenseIncrement},
        ${bankExpenseIncrement}, 
        ${openingBalanceCents + cashRevenueIncrement - cashExpenseIncrement},
        ${!!previousBalance}, 
        ${openingBalanceCents + cashRevenueIncrement - cashExpenseIncrement}, 
        0, 1, NOW(), NOW()
      )
      ON CONFLICT (org_id, property_id, balance_date)
      DO UPDATE SET
        cash_received_cents = daily_cash_balances.cash_received_cents + ${cashRevenueIncrement},
        bank_received_cents = daily_cash_balances.bank_received_cents + ${bankRevenueIncrement},
        cash_expenses_cents = daily_cash_balances.cash_expenses_cents + ${cashExpenseIncrement},
        bank_expenses_cents = daily_cash_balances.bank_expenses_cents + ${bankExpenseIncrement},
        closing_balance_cents = daily_cash_balances.opening_balance_cents + 
                                (daily_cash_balances.cash_received_cents + ${cashRevenueIncrement}) - 
                                (daily_cash_balances.cash_expenses_cents + ${cashExpenseIncrement}),
        calculated_closing_balance_cents = daily_cash_balances.opening_balance_cents + 
                                           (daily_cash_balances.cash_received_cents + ${cashRevenueIncrement}) - 
                                           (daily_cash_balances.cash_expenses_cents + ${cashExpenseIncrement}),
        balance_discrepancy_cents = 0,
        updated_at = NOW()
    `;

    console.log(`[Finance] Updated daily_cash_balances for property ${propertyId} on ${date}: ${transactionType} ${paymentMode} ${amountCents} cents`);
  } catch (error) {
    console.error('[Finance] Error updating daily_cash_balances:', error);
    throw error; // Don't suppress - this is critical for data integrity
  }
}

export interface ApproveExpenseRequest {
  id: number;
  approved: boolean;
  notes?: string;
}

export interface ApproveExpenseResponse {
  success: boolean;
  expenseId: number;
  status: string;
}

// Shared handler for approving/rejecting expense (used by both legacy and v1 endpoints)
async function approveExpenseHandler(req: ApproveExpenseRequest): Promise<ApproveExpenseResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN")(authData); // Only admins can approve expenses

  const { id, approved, notes } = req;

    const tx = await financeDB.begin();
    try {
      // Get expense and check access with org scoping
      const expenseRow = await tx.queryRow`
        SELECT e.id, e.org_id, e.status, e.created_by_user_id, u.display_name as created_by_name
        FROM expenses e
        JOIN users u ON e.created_by_user_id = u.id
        WHERE e.id = ${id} AND e.org_id = ${authData.orgId}
      `;

      if (!expenseRow) {
        throw APIError.notFound("Expense not found");
      }

      if (expenseRow.status !== 'pending') {
        throw APIError.failedPrecondition(`Cannot approve expense with status: ${expenseRow.status}`);
      }

      const newStatus = approved ? 'approved' : 'rejected';

      // Update expense status
      const updateResult = await tx.exec`
        UPDATE expenses 
        SET status = ${newStatus}, approved_by_user_id = ${parseInt(authData.userID)}, approved_at = NOW()
        WHERE id = ${id} AND org_id = ${authData.orgId}
      `;

      // Create notification for the expense creator
      await tx.exec`
        INSERT INTO notifications (org_id, user_id, type, payload_json)
        VALUES (
          ${authData.orgId},
          ${expenseRow.created_by_user_id},
          ${'expense_' + newStatus},
          ${JSON.stringify({
            expense_id: id,
            status: newStatus,
            approved_by: authData.displayName,
            notes: notes || null,
            message: `Your expense has been ${newStatus}${notes ? ': ' + notes : ''}`,
            timestamp: new Date().toISOString(),
            requires_action: false
          })}
        )
      `;

      // Create notification for all managers in the organization to trigger real-time updates
      await tx.exec`
        INSERT INTO notifications (org_id, user_id, type, payload_json)
        SELECT 
          ${authData.orgId},
          u.id,
          'finance_update',
          ${JSON.stringify({
            action: 'expense_approved',
            expense_id: id,
            status: newStatus,
            approved_by: authData.displayName,
            message: `Expense ${id} has been ${newStatus}`,
            timestamp: new Date().toISOString(),
            requires_action: false
          })}
        FROM users u
        WHERE u.org_id = ${authData.orgId} 
          AND u.role = 'MANAGER'
          AND u.id != ${parseInt(authData.userID)}
      `;

      // Create notification for daily approval status update
      await tx.exec`
        INSERT INTO notifications (org_id, user_id, type, payload_json)
        SELECT 
          ${authData.orgId},
          u.id,
          'daily_approval_update',
          ${JSON.stringify({
            action: 'expense_approved',
            expense_id: id,
            status: newStatus,
            approved_by: authData.displayName,
            message: `Daily approval status updated - expense ${id} ${newStatus}`,
            timestamp: new Date().toISOString(),
            requires_action: false,
            trigger_daily_approval_refresh: true
          })}
        FROM users u
        WHERE u.org_id = ${authData.orgId} 
          AND u.role = 'MANAGER'
      `;

      // Handle approval or rejection
      if (newStatus === 'approved') {
        const expense = await tx.queryRow`
          SELECT created_by_user_id, created_at, property_id, amount_cents, payment_mode,
                 currency, category, expense_date
          FROM expenses
          WHERE id = ${id}
        `;
        
        if (expense) {
          const expenseDate = new Date(expense.created_at).toISOString().split('T')[0];
          
          // Check if daily approval already exists
          const existingApproval = await tx.queryRow`
            SELECT id
            FROM daily_approvals
            WHERE org_id = ${authData.orgId} 
              AND manager_user_id = ${expense.created_by_user_id}
              AND approval_date = ${expenseDate}
          `;
          
          if (!existingApproval) {
            // Grant daily approval for the manager
            await tx.exec`
              INSERT INTO daily_approvals (org_id, manager_user_id, approval_date, approved_by_admin_id, notes)
              VALUES (
                ${authData.orgId}, 
                ${expense.created_by_user_id}, 
                ${expenseDate}, 
                ${parseInt(authData.userID)}, 
                'Auto-granted when expense was approved'
              )
            `;
            
            console.log(`Auto-granted daily approval for manager ${expense.created_by_user_id} on ${expenseDate}`);
          }

          // Update daily cash balance record for this property and date
          await updateDailyCashBalanceForTransaction(tx, {
            orgId: authData.orgId,
            propertyId: expense.property_id,
            date: expenseDate,
            transactionType: 'expense',
            amountCents: expense.amount_cents,
            paymentMode: expense.payment_mode
          });
        }
      } else if (newStatus === 'rejected') {
        // NEW: Handle rejection - check if it was previously approved
        const wasApproved = await tx.queryRow`
          SELECT status FROM expenses WHERE id = ${id}
        `;
        
        if (wasApproved && wasApproved.status === 'approved') {
          // Get expense data for removal
          const expense = await tx.queryRow`
            SELECT property_id, amount_cents, payment_mode, created_at
            FROM expenses
            WHERE id = ${id}
          `;
          
          if (expense) {
            const expenseDate = new Date(expense.created_at).toISOString().split('T')[0];
            
            // Remove from daily_cash_balances
            await removeDailyCashBalanceForTransaction(tx, {
              orgId: authData.orgId,
              propertyId: expense.property_id,
              date: expenseDate,
              transactionType: 'expense',
              amountCents: expense.amount_cents,
              paymentMode: expense.payment_mode
            });
          }
        }
      }

      await tx.commit();

      // Publish event for real-time updates (following Encore pattern)
      try {
        // Re-fetch expense data after commit for event publishing
        const expenseForEvent = await financeDB.queryRow`
          SELECT property_id, amount_cents, currency, payment_mode, category, expense_date
          FROM expenses
          WHERE id = ${id}
        `;
        
        if (expenseForEvent) {
          const expenseDate = toISTDateString(
            expenseForEvent.expense_date || new Date()
          );
          
          await financeEvents.publish({
            eventId: uuidv4(),
            eventVersion: 'v1',
            eventType: approved ? 'expense_approved' : 'expense_rejected',
            orgId: authData.orgId,
            propertyId: expenseForEvent.property_id,
            userId: parseInt(authData.userID),
            timestamp: new Date(),
            entityId: id,
            entityType: 'expense',
            metadata: {
              previousStatus: 'pending',
              newStatus: approved ? 'approved' : 'rejected',
              amountCents: expenseForEvent.amount_cents,
              currency: expenseForEvent.currency,
              paymentMode: expenseForEvent.payment_mode,
              category: expenseForEvent.category,
              transactionDate: expenseDate,
              affectedReportDates: [expenseDate],
              ...(notes ? { notes } : {})
            }
          });
          console.log(`[Finance] Published ${approved ? 'expense_approved' : 'expense_rejected'} event for expense ID: ${id}`);
        }
      } catch (eventError) {
        console.error('[Finance] Failed to publish expense approval event:', eventError);
        // Don't fail the transaction if event publishing fails
      }

      return {
        success: true,
        expenseId: id,
        status: newStatus,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Approve expense error:', error);
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      throw APIError.internal(`Failed to approve expense: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

// LEGACY: Approves or rejects an expense (keep for backward compatibility)
export const approveExpense = api<ApproveExpenseRequest, ApproveExpenseResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/expenses/approve" },
  approveExpenseHandler
);

// V1: Approves or rejects an expense
export const approveExpenseV1 = api<ApproveExpenseRequest, ApproveExpenseResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/finance/expenses/approve" },
  approveExpenseHandler
);
