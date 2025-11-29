import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { financeDB } from "./db";
import { checkDailyApproval } from "./check_daily_approval";
import { financeEvents } from "./events";
import { v1Path } from "../shared/http";
import { v4 as uuidv4 } from 'uuid';
import { distributedCache } from "../cache/distributed_cache_manager";
import { toISTDateString } from "../shared/date_utils";

export interface DeleteRevenueRequest {
  id: number;
}

export interface DeleteRevenueResponse {
  id: number;
  deleted: boolean;
}

// Deletes a revenue record
async function deleteRevenueHandler(req: DeleteRevenueRequest): Promise<DeleteRevenueResponse> {
    const { id } = req;
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    // Check if manager can delete transactions based on daily approval workflow
    if (authData.role === "MANAGER") {
      const approvalCheck = await checkDailyApproval({});
      if (!approvalCheck.canAddTransactions) {
        throw APIError.permissionDenied(
          approvalCheck.message || "You cannot delete transactions at this time. Please wait for admin approval."
        );
      }
    }

    // Check if status columns exist
    let hasStatusColumns = false;
    try {
      const statusCheck = await financeDB.queryAll`
        SELECT table_name, column_name FROM information_schema.columns 
        WHERE table_name IN ('expenses', 'revenues') AND column_name = 'status'
      `;
      // Both tables must have the status column
      hasStatusColumns = statusCheck.length === 2;
      console.log('Status column check result:', statusCheck, 'hasStatusColumns:', hasStatusColumns);
    } catch (error) {
      console.log('Status column check failed:', error);
    }

    const tx = await financeDB.begin();
    try {
      // Get existing revenue and check access with org scoping - get full data for event
      let revenueRow;
      if (hasStatusColumns) {
        revenueRow = await tx.queryRow`
          SELECT r.id, r.org_id, r.status, r.created_by_user_id, r.property_id, r.amount_cents, r.source, r.occurred_at
          FROM revenues r
          WHERE r.id = ${id} AND r.org_id = ${authData.orgId}
        `;
      } else {
        // Fallback: select without status column
        revenueRow = await tx.queryRow`
          SELECT r.id, r.org_id, r.created_by_user_id, r.property_id, r.amount_cents, r.source, r.occurred_at
          FROM revenues r
          WHERE r.id = ${id} AND r.org_id = ${authData.orgId}
        `;
        // Add default status in memory
        if (revenueRow) {
          revenueRow.status = 'pending';
        }
      }

      if (!revenueRow) {
        throw APIError.notFound("Revenue not found");
      }

        // Check if user can delete this revenue
        if (authData.role === "MANAGER") {
          // Managers can only delete their own revenues or revenues for properties they manage
          const canDelete = await tx.queryRow`
            SELECT EXISTS(
              SELECT 1 FROM user_properties up 
              WHERE up.user_id = ${parseInt(authData.userID)} 
              AND up.property_id = ${revenueRow.property_id}
            ) OR ${revenueRow.created_by_user_id} = ${parseInt(authData.userID)}
          `;
          
          if (!canDelete?.exists) {
            throw APIError.permissionDenied("You can only delete revenues for properties you manage or revenues you created");
          }
        }

      // For managers, create a deletion request instead of actually deleting
      if (authData.role === "MANAGER") {
        // Create a deletion request record (if table exists)
        try {
          await tx.exec`
            INSERT INTO revenue_deletion_requests (
              org_id, revenue_id, requested_by_user_id, amount_cents, source, 
              reason, status, created_at
            ) VALUES (
              ${authData.orgId}, ${id}, ${parseInt(authData.userID)}, 
              ${revenueRow.amount_cents}, ${revenueRow.source}, 
              'Revenue deletion requested by manager', 'pending', NOW()
            )
          `;
        } catch (error) {
          console.log('Revenue deletion requests table may not exist, skipping:', error);
        }

        // Create notification for admins
        await tx.exec`
          INSERT INTO notifications (org_id, user_id, type, title, message, data, created_at)
          SELECT 
            ${authData.orgId},
            u.id,
            'revenue_deletion_request',
            'Revenue Deletion Request',
            'A manager has requested to delete a revenue that requires approval',
            json_build_object('revenue_id', ${id}, 'requested_by', ${authData.userID}, 'amount', ${revenueRow.amount_cents}),
            NOW()
          FROM users u
          WHERE u.org_id = ${authData.orgId} AND u.role IN ('ADMIN')
        `;

        await tx.commit();

        return {
          id,
          deleted: false, // Not actually deleted, just requested
        };
      } else {
        // Publish event BEFORE delete (for safety - we have full row data)
        try {
          const revenueDate = toISTDateString(revenueRow.occurred_at || new Date());
          await financeEvents.publish({
            eventId: uuidv4(),
            eventVersion: 'v1',
            eventType: 'revenue_deleted',
            orgId: authData.orgId,
            propertyId: revenueRow.property_id,
            userId: parseInt(authData.userID),
            timestamp: new Date(),
            entityId: id,
            entityType: 'revenue',
            metadata: {
              amountCents: revenueRow.amount_cents,
              currency: revenueRow.currency || 'INR',
              paymentMode: revenueRow.payment_mode,
              source: revenueRow.source,
              transactionDate: revenueDate,
              affectedReportDates: [revenueDate]
            }
          });
          console.log(`[Finance] Published revenue_deleted event for revenue ID: ${id}`);
        } catch (eventError) {
          console.error('[Finance] Failed to publish revenue_deleted event:', eventError);
          // Don't fail the transaction if event publishing fails
        }

        // Get receipt file ID before deleting
        const receiptFileId = revenueRow.receipt_file_id;

        // Delete revenue record
        await tx.exec`
          DELETE FROM revenues 
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;

        await tx.commit();

        // Clean up receipt file if it exists and is not referenced by other transactions
        if (receiptFileId) {
          try {
            // Check if file is referenced by other transactions
            const otherRevenueRefs = await financeDB.queryRow`
              SELECT COUNT(*) as count FROM revenues WHERE receipt_file_id = ${receiptFileId} AND org_id = ${authData.orgId}
            `;
            
            const expenseRefs = await financeDB.queryRow`
              SELECT COUNT(*) as count FROM expenses WHERE receipt_file_id = ${receiptFileId} AND org_id = ${authData.orgId}
            `;

            const totalRefs = (otherRevenueRefs?.count || 0) + (expenseRefs?.count || 0);

            // If file is not referenced by any other transactions, delete it
            if (totalRefs === 0) {
              // Note: We don't delete the file here as it requires uploads service
              // The cleanup can be done via the cleanup endpoint or background job
              console.log(`Receipt file ${receiptFileId} is orphaned and can be cleaned up`);
            }
          } catch (error) {
            console.error('Error checking receipt file references:', error);
            // Don't fail the revenue deletion if file cleanup fails
          }
        }

        // Clear related cache after delete
        try {
          const revenueDate = revenueRow.occurred_at ? (typeof revenueRow.occurred_at === 'string' ? revenueRow.occurred_at.split('T')[0] : revenueRow.occurred_at.toISOString().split('T')[0]) : new Date().toISOString().split('T')[0];
          await clearRelatedCache(authData.orgId, revenueRow.property_id, revenueDate);
        } catch (cacheError) {
          console.error('[Finance] Failed to clear cache:', cacheError);
          // Don't fail the transaction if cache clearing fails
        }

        return {
          id,
          deleted: true,
        };
      }
    } catch (error) {
      await tx.rollback();
      throw error;
    }
}

export const deleteRevenue = api<DeleteRevenueRequest, DeleteRevenueResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/finance/revenues/:id" },
  deleteRevenueHandler
);

export const deleteRevenueV1 = api<DeleteRevenueRequest, DeleteRevenueResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/v1/finance/revenues/:id" },
  deleteRevenueHandler
);

// Helper function to clear related cache
async function clearRelatedCache(orgId: number, propertyId: number, date: string): Promise<void> {
  // Clear Redis cache
  await distributedCache.invalidateDailyReport(orgId, propertyId, date);
  await distributedCache.invalidateBalance(orgId, propertyId, date);
  
  // Clear database cache
  await financeDB.exec`
    DELETE FROM daily_cash_balances 
    WHERE org_id = ${orgId} AND property_id = ${propertyId} AND balance_date = ${date}
  `;
}
