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

export interface ApproveRevenueByIdRequest {
  id: number;
  approved: boolean;
  notes?: string;
}

export interface ApproveRevenueByIdResponse {
  success: boolean;
  revenueId: number;
  status: string;
}

// Approves or rejects a revenue by ID (matches frontend URL pattern)
async function approveRevenueByIdHandler(req: ApproveRevenueByIdRequest): Promise<ApproveRevenueByIdResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData); // Only admins can approve revenues

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
      // Get revenue and check access with org scoping - get full data for event
      let revenueRow: any;
      if (hasStatusColumns) {
        revenueRow = await tx.queryRow`
          SELECT r.id, r.org_id, r.status, r.created_by_user_id, r.property_id, r.occurred_at, r.amount_cents, r.payment_mode, u.display_name as created_by_name
          FROM revenues r
          JOIN users u ON r.created_by_user_id = u.id
          WHERE r.id = ${id} AND r.org_id = ${authData.orgId}
        `;
      } else {
        revenueRow = await tx.queryRow`
          SELECT r.id, r.org_id, r.created_by_user_id, r.property_id, r.occurred_at, r.amount_cents, r.payment_mode, u.display_name as created_by_name
          FROM revenues r
          JOIN users u ON r.created_by_user_id = u.id
          WHERE r.id = ${id} AND r.org_id = ${authData.orgId}
        `;
        // Set default status if column doesn't exist
        revenueRow.status = 'pending';
      }

      if (!revenueRow) {
        throw APIError.notFound("Revenue not found");
      }

      if (revenueRow.status !== 'pending') {
        throw APIError.failedPrecondition(`Cannot approve revenue with status: ${revenueRow.status}`);
      }

      const newStatus = approved ? 'approved' : 'rejected';

      // Update revenue status (only if status column exists)
      let updateResult;
      if (hasStatusColumns) {
        updateResult = await tx.exec`
          UPDATE revenues 
          SET status = ${newStatus}, approved_by_user_id = ${parseInt(authData.userID)}, approved_at = NOW()
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;
      } else {
        // If no status column, just update approval fields
        updateResult = await tx.exec`
          UPDATE revenues 
          SET approved_by_user_id = ${parseInt(authData.userID)}, approved_at = NOW()
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;
      }

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
            ...(notes ? { notes } : {}),
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

      // Auto-grant daily approval for the manager if this is an approval
      if (newStatus === 'approved') {
        const revenue = await tx.queryRow`
          SELECT created_by_user_id, created_at, occurred_at
          FROM revenues
          WHERE id = ${id}
        `;
        
        if (revenue) {
          const revenueDate = revenue.occurred_at ? (typeof revenue.occurred_at === 'string' ? revenue.occurred_at.split('T')[0] : new Date(revenue.occurred_at).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0];
          
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
            propertyId: revenueRow.property_id,
            date: revenueDate,
            transactionType: 'revenue',
            amountCents: revenueRow.amount_cents,
            paymentMode: revenueRow.payment_mode
          });
        }
      }

      await tx.commit();

      // Publish event for real-time updates
      try {
        await financeEvents.publish({
          eventId: uuidv4(),
          eventVersion: 'v1',
          eventType: approved ? 'revenue_approved' : 'revenue_rejected',
          orgId: authData.orgId,
          propertyId: revenueRow.property_id,
          userId: parseInt(authData.userID),
          timestamp: new Date(),
          entityId: id,
          entityType: 'revenue',
          metadata: {
            previousStatus: 'pending',
            newStatus: approved ? 'approved' : 'rejected',
            amountCents: revenueRow.amount_cents,
            currency: revenueRow.currency,
            paymentMode: revenueRow.payment_mode,
            source: revenueRow.source,
            transactionDate: toISTDateString(revenueRow.occurred_at || new Date()),
            affectedReportDates: [toISTDateString(revenueRow.occurred_at || new Date())],
            ...(notes ? { notes } : {})
          }
        });
        console.log(`[Finance] Published ${approved ? 'revenue_approved' : 'revenue_rejected'} event for revenue ID: ${id}`);
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
      console.error('Approve revenue by ID error:', error);
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      throw APIError.internal(`Failed to approve revenue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export const approveRevenueById = api<ApproveRevenueByIdRequest, ApproveRevenueByIdResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/finance/revenues/:id/approve" },
  approveRevenueByIdHandler
);

export const approveRevenueByIdV1 = api<ApproveRevenueByIdRequest, ApproveRevenueByIdResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/v1/finance/revenues/:id/approve" },
  approveRevenueByIdHandler
);
