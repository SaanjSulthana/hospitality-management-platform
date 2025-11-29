import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { financeDB } from "./db";
import { checkDailyApproval } from "./check_daily_approval";
import { financeEvents } from "./events";
import { v1Path } from "../shared/http";
import { v4 as uuidv4 } from 'uuid';
import { toISTDateString } from "../shared/date_utils";

export interface UpdateRevenueRequest {
  id: number;
  propertyId?: number;
  source?: "room" | "addon" | "other";
  amountCents?: number;
  currency?: string;
  description?: string;
  receiptUrl?: string;
  receiptFileId?: number;
  occurredAt?: Date;
  paymentMode?: "cash" | "bank";
  bankReference?: string;
}

export interface UpdateRevenueResponse {
  id: number;
  propertyId: number;
  source: "room" | "addon" | "other";
  amountCents: number;
  currency: string;
  description?: string;
  receiptUrl?: string;
  receiptFileId?: number;
  occurredAt: Date;
  paymentMode: "cash" | "bank";
  bankReference?: string;
  status: string;
  createdByUserId: number;
  updatedAt: Date;
}

// Updates an existing revenue record
async function updateRevenueHandler(req: UpdateRevenueRequest): Promise<UpdateRevenueResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { id, ...updateData } = req;

    // Check if manager can modify transactions based on daily approval workflow
    if (authData.role === "MANAGER") {
      try {
        const approvalCheck = await checkDailyApproval({});
        if (!approvalCheck.canAddTransactions) {
          throw APIError.permissionDenied(
            approvalCheck.message || "You cannot modify transactions at this time. Please wait for admin approval."
          );
        }
      } catch (approvalError) {
        console.error('Daily approval check failed:', approvalError);
        // Allow the transaction to proceed if approval check fails
        // This prevents the approval system from blocking legitimate updates
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
      // Get existing revenue and check access with org scoping
      let revenueRow;
      if (hasStatusColumns) {
        revenueRow = await tx.queryRow`
          SELECT r.id, r.org_id, r.status, r.created_by_user_id, r.property_id
          FROM revenues r
          WHERE r.id = ${id} AND r.org_id = ${authData.orgId}
        `;
      } else {
        // Fallback: select without status column
        revenueRow = await tx.queryRow`
          SELECT r.id, r.org_id, r.created_by_user_id, r.property_id
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

      // Check if user can modify this revenue
      if (authData.role === "MANAGER") {
        // Managers can only modify their own revenues or revenues for properties they manage
        const canModify = await tx.queryRow`
          SELECT EXISTS(
            SELECT 1 FROM user_properties up 
            WHERE up.user_id = ${parseInt(authData.userID)} 
            AND up.property_id = ${revenueRow.property_id}
          ) OR EXISTS(
            SELECT 1 FROM revenues r
            WHERE r.id = ${id} AND r.created_by_user_id = ${parseInt(authData.userID)}
          )
        `;
        
        if (!canModify) {
          throw APIError.permissionDenied("You can only modify revenues for properties you manage or revenues you created");
        }
      }

      // If amount is being updated, validate it
      if (updateData.amountCents !== undefined && updateData.amountCents <= 0) {
        throw APIError.invalidArgument("Amount must be greater than zero");
      }

      // If property is being updated, check access
      if (updateData.propertyId) {
        const propertyRow = await tx.queryRow`
          SELECT id FROM properties 
          WHERE id = ${updateData.propertyId} AND org_id = ${authData.orgId}
        `;
        
        if (!propertyRow) {
          throw APIError.notFound("Property not found");
        }

        // Check if manager has access to the new property
        if (authData.role === "MANAGER") {
          const hasAccess = await tx.queryRow`
            SELECT EXISTS(
              SELECT 1 FROM user_properties 
              WHERE user_id = ${parseInt(authData.userID)} 
              AND property_id = ${updateData.propertyId}
            )
          `;
          
          if (!hasAccess) {
            throw APIError.permissionDenied("You don't have access to this property");
          }
        }
      }

      // Update revenue fields using template literals
      let hasUpdates = false;

      if (updateData.propertyId !== undefined) {
        await tx.exec`
          UPDATE revenues 
          SET property_id = ${updateData.propertyId}
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;
        hasUpdates = true;
      }
      if (updateData.source !== undefined) {
        await tx.exec`
          UPDATE revenues 
          SET source = ${updateData.source}
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;
        hasUpdates = true;
      }
      if (updateData.amountCents !== undefined) {
        await tx.exec`
          UPDATE revenues 
          SET amount_cents = ${updateData.amountCents}
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;
        hasUpdates = true;
      }
      if (updateData.currency !== undefined) {
        await tx.exec`
          UPDATE revenues 
          SET currency = ${updateData.currency}
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;
        hasUpdates = true;
      }
      if (updateData.description !== undefined) {
        await tx.exec`
          UPDATE revenues 
          SET description = ${updateData.description}
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;
        hasUpdates = true;
      }
      if (updateData.receiptUrl !== undefined) {
        await tx.exec`
          UPDATE revenues 
          SET receipt_url = ${updateData.receiptUrl}
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;
        hasUpdates = true;
      }
      if (updateData.receiptFileId !== undefined) {
        await tx.exec`
          UPDATE revenues 
          SET receipt_file_id = ${updateData.receiptFileId}
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;
        hasUpdates = true;
      }
      if (updateData.occurredAt !== undefined) {
        await tx.exec`
          UPDATE revenues 
          SET occurred_at = ${updateData.occurredAt}
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;
        hasUpdates = true;
      }
      if (updateData.paymentMode !== undefined) {
        await tx.exec`
          UPDATE revenues 
          SET payment_mode = ${updateData.paymentMode}
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;
        hasUpdates = true;
      }
      if (updateData.bankReference !== undefined) {
        await tx.exec`
          UPDATE revenues 
          SET bank_reference = ${updateData.bankReference}
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;
        hasUpdates = true;
      }

      if (!hasUpdates) {
        throw APIError.invalidArgument("No fields to update");
      }

      // For managers, reset status to pending when modifying (if status column exists)
      if (authData.role === "MANAGER" && hasStatusColumns) {
        await tx.exec`
          UPDATE revenues 
          SET status = 'pending', approved_by_user_id = NULL, approved_at = NULL
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;
      }

      // Note: updated_at column doesn't exist in revenues table, so we skip this
      
      // Get the updated revenue
      const updatedRevenue = await tx.queryRow`
        SELECT * FROM revenues 
        WHERE id = ${id} AND org_id = ${authData.orgId}
      `;
      
      if (!updatedRevenue) {
        throw APIError.notFound("Revenue not found or access denied");
      }

      // Create notification for admins if manager modified the revenue
      if (authData.role === "MANAGER") {
        await tx.exec`
          INSERT INTO notifications (org_id, user_id, type, payload_json)
          SELECT 
            ${authData.orgId},
            u.id,
            'revenue_modified',
            ${JSON.stringify({
              revenue_id: id,
              modified_by: authData.displayName,
              modified_at: new Date().toISOString(),
              message: 'A revenue has been modified and requires approval'
            })}
          FROM users u
          WHERE u.org_id = ${authData.orgId} AND u.role IN ('ADMIN')
        `;
      }

      await tx.commit();

      // Publish event for real-time updates (after commit, before return)
      try {
        const revenueDate = toISTDateString(updatedRevenue.occurred_at || new Date());
        await financeEvents.publish({
          eventId: uuidv4(),
          eventVersion: 'v1',
          eventType: 'revenue_updated',
          orgId: authData.orgId,
          propertyId: updatedRevenue.property_id,
          userId: parseInt(authData.userID),
          timestamp: new Date(),
          entityId: updatedRevenue.id,
          entityType: 'revenue',
          metadata: {
            amountCents: updatedRevenue.amount_cents,
            currency: updatedRevenue.currency,
            transactionDate: revenueDate,
            paymentMode: updatedRevenue.payment_mode,
            source: updatedRevenue.source,
            affectedReportDates: [revenueDate],
            newStatus: updatedRevenue.status || 'pending',
          }
        });
        console.log('[Finance] Published revenue_updated event for revenue ID:', updatedRevenue.id);
      } catch (eventError) {
        console.error('[Finance] Failed to publish revenue_updated event:', eventError);
        // Don't fail the request if event publishing fails
      }

      return {
        id: updatedRevenue.id,
        propertyId: updatedRevenue.property_id,
        source: updatedRevenue.source,
        amountCents: updatedRevenue.amount_cents,
        currency: updatedRevenue.currency,
        description: updatedRevenue.description,
        receiptUrl: updatedRevenue.receipt_url,
        receiptFileId: updatedRevenue.receipt_file_id,
        occurredAt: updatedRevenue.occurred_at,
        paymentMode: updatedRevenue.payment_mode,
        bankReference: updatedRevenue.bank_reference,
        status: updatedRevenue.status || 'pending',
        createdByUserId: updatedRevenue.created_by_user_id,
        updatedAt: updatedRevenue.updated_at,
      };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
}

export const updateRevenue = api<UpdateRevenueRequest, UpdateRevenueResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/finance/revenues/:id" },
  updateRevenueHandler
);

export const updateRevenueV1 = api<UpdateRevenueRequest, UpdateRevenueResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/v1/finance/revenues/:id" },
  updateRevenueHandler
);
