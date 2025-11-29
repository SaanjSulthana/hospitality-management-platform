import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";
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

export interface ApproveRevenueRequest {
  id: number;
  approved: boolean;
  notes?: string;
}

export interface ApproveRevenueResponse {
  success: boolean;
  revenueId: number;
  status: string;
}

// Shared handler for approving/rejecting revenue (used by both legacy and v1 endpoints)
async function approveRevenueHandler(req: ApproveRevenueRequest): Promise<ApproveRevenueResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN")(authData); // Only admins can approve revenues

  const { id, approved, notes } = req;

    const tx = await financeDB.begin();
    try {
      // Get revenue and check access with org scoping
      const revenueRow = await tx.queryRow`
        SELECT r.id, r.org_id, r.status, r.created_by_user_id, u.display_name as created_by_name
        FROM revenues r
        JOIN users u ON r.created_by_user_id = u.id
        WHERE r.id = ${id} AND r.org_id = ${authData.orgId}
      `;

      if (!revenueRow) {
        throw APIError.notFound("Revenue not found");
      }

      if (revenueRow.status !== 'pending') {
        throw APIError.failedPrecondition(`Cannot approve revenue with status: ${revenueRow.status}`);
      }

      const newStatus = approved ? 'approved' : 'rejected';

      // Update revenue status
      const updateResult = await tx.exec`
        UPDATE revenues 
        SET status = ${newStatus}, approved_by_user_id = ${parseInt(authData.userID)}, approved_at = NOW()
        WHERE id = ${id} AND org_id = ${authData.orgId}
      `;

      // Create notification for the revenue creator
      await tx.exec`
        INSERT INTO notifications (org_id, user_id, type, payload_json)
        VALUES (
          ${authData.orgId},
          ${revenueRow.created_by_user_id},
          ${'revenue_' + newStatus},
          ${JSON.stringify({
            revenue_id: id,
            status: newStatus,
            approved_by: authData.displayName,
            notes: notes || null,
            message: `Your revenue has been ${newStatus}${notes ? ': ' + notes : ''}`,
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
            action: 'revenue_approved',
            revenue_id: id,
            status: newStatus,
            approved_by: authData.displayName,
            message: `Revenue ${id} has been ${newStatus}`,
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
            action: 'revenue_approved',
            revenue_id: id,
            status: newStatus,
            approved_by: authData.displayName,
            message: `Daily approval status updated - revenue ${id} ${newStatus}`,
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
        const revenue = await tx.queryRow`
          SELECT created_by_user_id, created_at, property_id, amount_cents, payment_mode, 
                 currency, source, occurred_at
          FROM revenues
          WHERE id = ${id}
        `;
        
        if (revenue) {
          const revenueDate = new Date(revenue.created_at).toISOString().split('T')[0];
          
          // Check if daily approval already exists
          const existingApproval = await tx.queryRow`
            SELECT id
            FROM daily_approvals
            WHERE org_id = ${authData.orgId} 
              AND manager_user_id = ${revenue.created_by_user_id}
              AND approval_date = ${revenueDate}
          `;
          
          if (!existingApproval) {
            // Grant daily approval for the manager
            await tx.exec`
              INSERT INTO daily_approvals (org_id, manager_user_id, approval_date, approved_by_admin_id, notes)
              VALUES (
                ${authData.orgId}, 
                ${revenue.created_by_user_id}, 
                ${revenueDate}, 
                ${parseInt(authData.userID)}, 
                'Auto-granted when revenue was approved'
              )
            `;
            
            console.log(`Auto-granted daily approval for manager ${revenue.created_by_user_id} on ${revenueDate}`);
          }

          // Update daily cash balance record for this property and date
          await updateDailyCashBalanceForTransaction(tx, {
            orgId: authData.orgId,
            propertyId: revenue.property_id,
            date: revenueDate,
            transactionType: 'revenue',
            amountCents: revenue.amount_cents,
            paymentMode: revenue.payment_mode
          });
        }
      } else if (newStatus === 'rejected') {
        // NEW: Handle rejection - check if it was previously approved
        const wasApproved = await tx.queryRow`
          SELECT status FROM revenues WHERE id = ${id}
        `;
        
        if (wasApproved && wasApproved.status === 'approved') {
          // Get revenue data for removal
          const revenue = await tx.queryRow`
            SELECT property_id, amount_cents, payment_mode, created_at
            FROM revenues
            WHERE id = ${id}
          `;
          
          if (revenue) {
            const revenueDate = new Date(revenue.created_at).toISOString().split('T')[0];
            
            // Remove from daily_cash_balances
            await removeDailyCashBalanceForTransaction(tx, {
              orgId: authData.orgId,
              propertyId: revenue.property_id,
              date: revenueDate,
              transactionType: 'revenue',
              amountCents: revenue.amount_cents,
              paymentMode: revenue.payment_mode
            });
          }
        }
      }

      await tx.commit();

      // Publish event for real-time updates (following Encore pattern)
      try {
        // Re-fetch revenue data after commit for event publishing
        const revenueForEvent = await financeDB.queryRow`
          SELECT property_id, amount_cents, currency, payment_mode, source, occurred_at
          FROM revenues
          WHERE id = ${id}
        `;
        
        if (revenueForEvent) {
          const revenueDate = toISTDateString(
            revenueForEvent.occurred_at || new Date()
          );
          
          await financeEvents.publish({
            eventId: uuidv4(),
            eventVersion: 'v1',
            eventType: approved ? 'revenue_approved' : 'revenue_rejected',
            orgId: authData.orgId,
            propertyId: revenueForEvent.property_id,
            userId: parseInt(authData.userID),
            timestamp: new Date(),
            entityId: id,
            entityType: 'revenue',
            metadata: {
              previousStatus: 'pending',
              newStatus: approved ? 'approved' : 'rejected',
              amountCents: revenueForEvent.amount_cents,
              currency: revenueForEvent.currency,
              paymentMode: revenueForEvent.payment_mode,
              source: revenueForEvent.source,
              transactionDate: revenueDate,
              affectedReportDates: [revenueDate],
              ...(notes ? { notes } : {})
            }
          });
          console.log(`[Finance] Published ${approved ? 'revenue_approved' : 'revenue_rejected'} event for revenue ID: ${id}`);
        }
      } catch (eventError) {
        console.error('[Finance] Failed to publish revenue approval event:', eventError);
        // Don't fail the transaction if event publishing fails
      }

      return {
        success: true,
        revenueId: id,
        status: newStatus,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Approve revenue error:', error);
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      throw APIError.internal(`Failed to approve revenue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

// LEGACY: Approves or rejects a revenue (keep for backward compatibility)
export const approveRevenue = api<ApproveRevenueRequest, ApproveRevenueResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/revenues/approve" },
  approveRevenueHandler
);

// V1: Approves or rejects a revenue
export const approveRevenueV1 = api<ApproveRevenueRequest, ApproveRevenueResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/finance/revenues/approve" },
  approveRevenueHandler
);

