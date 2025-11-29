import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";
import { financeEvents } from "./events";
import { v1Path } from "../shared/http";
import { v4 as uuidv4 } from 'uuid';
import { toISTDateString } from "../shared/date_utils";

async function updateDailyCashBalanceForTransaction(tx: any, params: {
  orgId: number;
  propertyId: number;
  date: string;
  transactionType: 'revenue' | 'expense';
  amountCents: number;
  paymentMode: string;
}) {
  try {
    // Calculate opening balance from previous day
    const previousDate = new Date(params.date);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousDateStr = previousDate.toISOString().split('T')[0];

    const previousBalance = await tx.queryRow`
      SELECT closing_balance_cents FROM daily_cash_balances
      WHERE org_id = ${params.orgId} 
        AND property_id = ${params.propertyId} 
        AND balance_date = ${previousDateStr}
    `;

    const openingBalanceCents = previousBalance ? parseInt(previousBalance.closing_balance_cents) || 0 : 0;
    
    // Determine increments based on transaction type and payment mode
    const cashRevenueIncrement = params.transactionType === 'revenue' && params.paymentMode === 'cash' ? params.amountCents : 0;
    const bankRevenueIncrement = params.transactionType === 'revenue' && params.paymentMode === 'bank' ? params.amountCents : 0;
    const cashExpenseIncrement = params.transactionType === 'expense' && params.paymentMode === 'cash' ? params.amountCents : 0;
    const bankExpenseIncrement = params.transactionType === 'expense' && params.paymentMode === 'bank' ? params.amountCents : 0;

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
        ${params.orgId}, ${params.propertyId}, ${params.date}, ${openingBalanceCents},
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

    console.log(`[Finance] Updated daily_cash_balances for property ${params.propertyId} on ${params.date}: ${params.transactionType} ${params.paymentMode} ${params.amountCents} cents`);
  } catch (error) {
    console.error('[Finance] Error updating daily_cash_balances:', error);
    throw error; // Don't suppress - this is critical for data integrity
  }
}

export interface ApproveExpenseByIdRequest {
  id: number;
  approved: boolean;
  notes?: string;
}

export interface ApproveExpenseByIdResponse {
  success: boolean;
  expenseId: number;
  status: string;
}

// Approves or rejects an expense by ID (matches frontend URL pattern)
async function approveExpenseByIdHandler(req: ApproveExpenseByIdRequest): Promise<ApproveExpenseByIdResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData); // Only admins can approve expenses

    const { id, approved, notes } = req;

    // Check if status columns exist in both tables
    let hasStatusColumns = false;
    try {
      const statusCheck = await financeDB.queryAll`
        SELECT table_name, column_name FROM information_schema.columns 
        WHERE table_name IN ('expenses', 'revenues') AND column_name = 'status'
      `;
      // Only consider status columns present if they exist in BOTH tables
      hasStatusColumns = statusCheck.length === 2;
      console.log('Status column check result:', statusCheck, 'hasStatusColumns:', hasStatusColumns);
    } catch (error) {
      console.log('Status column check failed:', error);
    }

    const tx = await financeDB.begin();
    try {
      // Get expense and check access with org scoping - get full expense data for event
      let expenseRow: any;
      if (hasStatusColumns) {
        expenseRow = await tx.queryRow`
          SELECT e.id, e.org_id, e.status, e.created_by_user_id, e.property_id, e.expense_date, e.amount_cents, e.payment_mode, u.display_name as created_by_name
          FROM expenses e
          JOIN users u ON e.created_by_user_id = u.id
          WHERE e.id = ${id} AND e.org_id = ${authData.orgId}
        `;
      } else {
        expenseRow = await tx.queryRow`
          SELECT e.id, e.org_id, e.created_by_user_id, e.property_id, e.expense_date, e.amount_cents, e.payment_mode, u.display_name as created_by_name
          FROM expenses e
          JOIN users u ON e.created_by_user_id = u.id
          WHERE e.id = ${id} AND e.org_id = ${authData.orgId}
        `;
        // Set default status if column doesn't exist
        expenseRow.status = 'pending';
      }

      if (!expenseRow) {
        throw APIError.notFound("Expense not found");
      }

      if (expenseRow.status !== 'pending') {
        throw APIError.failedPrecondition(`Cannot approve expense with status: ${expenseRow.status}`);
      }

      const newStatus = approved ? 'approved' : 'rejected';

      // Update expense status (only if status column exists)
      let updateResult;
      if (hasStatusColumns) {
        updateResult = await tx.exec`
          UPDATE expenses 
          SET status = ${newStatus}, approved_by_user_id = ${parseInt(authData.userID)}, approved_at = NOW()
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;
      } else {
        // If no status column, just update approval fields
        updateResult = await tx.exec`
          UPDATE expenses 
          SET approved_by_user_id = ${parseInt(authData.userID)}, approved_at = NOW()
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;
      }

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
            ...(notes ? { notes } : {}),
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

      // Auto-grant daily approval for the manager if this is an approval
      if (newStatus === 'approved') {
        const expense = await tx.queryRow`
          SELECT created_by_user_id, created_at, expense_date
          FROM expenses
          WHERE id = ${id}
        `;
        
        if (expense) {
          const expenseDate = expense.expense_date ? (typeof expense.expense_date === 'string' ? expense.expense_date.split('T')[0] : new Date(expense.expense_date).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0];
          
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
            propertyId: expenseRow.property_id,
            date: expenseDate,
            transactionType: 'expense',
            amountCents: expenseRow.amount_cents,
            paymentMode: expenseRow.payment_mode
          });
        }
      }

      await tx.commit();

      // Publish event for real-time updates
      try {
        await financeEvents.publish({
          eventId: uuidv4(),
          eventVersion: 'v1',
          eventType: approved ? 'expense_approved' : 'expense_rejected',
          orgId: authData.orgId,
          propertyId: expenseRow.property_id,
          userId: parseInt(authData.userID),
          timestamp: new Date(),
          entityId: id,
          entityType: 'expense',
          metadata: {
            previousStatus: 'pending',
            newStatus: approved ? 'approved' : 'rejected',
            amountCents: expenseRow.amount_cents,
            currency: expenseRow.currency,
            paymentMode: expenseRow.payment_mode,
            category: expenseRow.category,
            transactionDate: toISTDateString(expenseRow.expense_date || new Date()),
            affectedReportDates: [toISTDateString(expenseRow.expense_date || new Date())],
            ...(notes ? { notes } : {})
          }
        });
        console.log(`[Finance] Published ${approved ? 'expense_approved' : 'expense_rejected'} event for expense ID: ${id}`);
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
      console.error('Approve expense by ID error:', error);
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      throw APIError.internal(`Failed to approve expense: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export const approveExpenseById = api<ApproveExpenseByIdRequest, ApproveExpenseByIdResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/finance/expenses/:id/approve" },
  approveExpenseByIdHandler
);

export const approveExpenseByIdV1 = api<ApproveExpenseByIdRequest, ApproveExpenseByIdResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/v1/finance/expenses/:id/approve" },
  approveExpenseByIdHandler
);
