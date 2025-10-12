import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { financeDB } from "./db";

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
    // Get current daily cash balance record
    const existingBalance = await tx.queryRow`
      SELECT * FROM daily_cash_balances
      WHERE org_id = ${orgId} 
        AND property_id = ${propertyId} 
        AND balance_date = ${date}
    `;

    if (existingBalance) {
      // Update existing record
      if (transactionType === 'revenue') {
        if (paymentMode === 'cash') {
          await tx.exec`
            UPDATE daily_cash_balances
            SET cash_received_cents = cash_received_cents + ${amountCents},
                updated_at = NOW()
            WHERE org_id = ${orgId} 
              AND property_id = ${propertyId} 
              AND balance_date = ${date}
          `;
        } else {
          await tx.exec`
            UPDATE daily_cash_balances
            SET bank_received_cents = bank_received_cents + ${amountCents},
                updated_at = NOW()
            WHERE org_id = ${orgId} 
              AND property_id = ${propertyId} 
              AND balance_date = ${date}
          `;
        }
      } else {
        if (paymentMode === 'cash') {
          await tx.exec`
            UPDATE daily_cash_balances
            SET cash_expenses_cents = cash_expenses_cents + ${amountCents},
                updated_at = NOW()
            WHERE org_id = ${orgId} 
              AND property_id = ${propertyId} 
              AND balance_date = ${date}
          `;
        } else {
          await tx.exec`
            UPDATE daily_cash_balances
            SET bank_expenses_cents = bank_expenses_cents + ${amountCents},
                updated_at = NOW()
            WHERE org_id = ${orgId} 
              AND property_id = ${propertyId} 
              AND balance_date = ${date}
          `;
        }
      }
    } else {
      // Create new record - calculate opening balance from previous day
      let openingBalanceCents = 0;
      
      // Get previous day's closing balance
      const previousDate = new Date(date);
      previousDate.setDate(previousDate.getDate() - 1);
      const previousDateStr = previousDate.toISOString().split('T')[0];
      
      const previousBalance = await tx.queryRow`
        SELECT closing_balance_cents 
        FROM daily_cash_balances 
        WHERE org_id = ${orgId} 
          AND property_id = ${propertyId} 
          AND balance_date = ${previousDateStr}
      `;
      
      if (previousBalance) {
        openingBalanceCents = previousBalance.closing_balance_cents;
      }

      // Initialize new record with the transaction
      const cashReceivedCents = transactionType === 'revenue' && paymentMode === 'cash' ? amountCents : 0;
      const bankReceivedCents = transactionType === 'revenue' && paymentMode === 'bank' ? amountCents : 0;
      const cashExpensesCents = transactionType === 'expense' && paymentMode === 'cash' ? amountCents : 0;
      const bankExpensesCents = transactionType === 'expense' && paymentMode === 'bank' ? amountCents : 0;
      
      const closingBalanceCents = openingBalanceCents + cashReceivedCents - cashExpensesCents;

      await tx.exec`
        INSERT INTO daily_cash_balances (
          org_id, property_id, balance_date, opening_balance_cents,
          cash_received_cents, bank_received_cents, cash_expenses_cents,
          bank_expenses_cents, closing_balance_cents,
          is_opening_balance_auto_calculated, calculated_closing_balance_cents,
          balance_discrepancy_cents, created_by_user_id
        )
        VALUES (
          ${orgId}, ${propertyId}, ${date}, ${openingBalanceCents},
          ${cashReceivedCents}, ${bankReceivedCents}, ${cashExpensesCents},
          ${bankExpensesCents}, ${closingBalanceCents}, 
          ${!!previousBalance}, ${closingBalanceCents}, 
          0, ${1} -- Default created_by_user_id
        )
      `;
    }

    console.log(`Updated daily cash balance for property ${propertyId} on ${date} with ${transactionType} of ${amountCents} cents (${paymentMode})`);
  } catch (error) {
    console.error('Error updating daily cash balance:', error);
    // Don't throw error to avoid breaking the approval process
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

// Approves or rejects an expense
export const approveExpense = api<ApproveExpenseRequest, ApproveExpenseResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/expenses/approve" },
  async (req) => {
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

      // Auto-grant daily approval for the manager if this is an approval
      if (newStatus === 'approved') {
        const expense = await tx.queryRow`
          SELECT created_by_user_id, created_at, property_id, amount_cents, payment_mode
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
      }

      await tx.commit();

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
);
