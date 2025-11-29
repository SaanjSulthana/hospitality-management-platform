import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";
import { checkDailyApprovalInternal } from "./check_daily_approval";
import { handleFinanceError } from "./error_handling";
import { executeQueryWithStability } from "./connection_stability";
import { financeEvents } from "./events";
import { v4 as uuidv4 } from 'uuid';
import { toISTDateString } from "../shared/date_utils";

export interface AddRevenueRequest {
  propertyId: number;
  source: 'room' | 'addon' | 'other';
  amountCents: number;
  currency?: string;
  description?: string;
  receiptUrl?: string;
  receiptFileId?: number;
  occurredAt: string; // Changed from Date to string for consistency
  paymentMode?: 'cash' | 'bank';
  bankReference?: string;
}

export interface AddRevenueResponse {
  id: number;
  propertyId: number;
  source: string;
  amountCents: number;
  currency: string;
  description?: string;
  receiptUrl?: string;
  receiptFileId?: number;
  occurredAt: Date;
  paymentMode: string;
  bankReference?: string;
  createdByUserId: number;
  createdAt: Date;
  status: string;
  approvedByUserId?: number | null;
  approvedAt?: Date | null;
}

// Shared handler for adding revenue (used by both legacy and v1 endpoints)
async function addRevenueHandler(req: AddRevenueRequest): Promise<AddRevenueResponse> {
  console.log('=== ADD REVENUE FUNCTION CALLED ===');
  console.log('Request data:', req);
  
  const authData = getAuthData();
  console.log('Auth data:', { userId: authData?.userID, role: authData?.role, orgId: authData?.orgId });
  
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN", "MANAGER")(authData);

    // Check approval workflow for all users (ADMIN and MANAGER)
    const approvalCheck = await checkDailyApprovalInternal(authData);
    if (!approvalCheck.canAddTransactions) {
      throw APIError.permissionDenied(
        approvalCheck.message || "You cannot add transactions at this time. Please wait for admin approval."
      );
    }

    const { propertyId, source, amountCents, currency = "INR", description, receiptUrl, receiptFileId, occurredAt, paymentMode = "cash", bankReference } = req;
    
    // If we have a receiptFileId but no receiptUrl, construct the URL
    let finalReceiptUrl = receiptUrl;
    if (receiptFileId && !receiptUrl) {
      finalReceiptUrl = `/uploads/file/${receiptFileId}`;
    }
    
    // Use provided revenue date for occurred_at field, but current timestamp for created_at
    const occurredAtDate = occurredAt ? new Date(occurredAt) : new Date();
    const currentTimestamp = new Date();

    if (amountCents <= 0) {
      throw APIError.invalidArgument("Amount must be greater than zero");
    }

    try {
      console.log('Starting revenue insertion process');
      // First check if the revenues table exists
      const revenuesTableExists = await executeQueryWithStability(
        () => financeDB.queryRow`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'revenues'
          )
        `,
        'check_revenues_table_exists'
      );
      
      if (!revenuesTableExists?.exists) {
        throw APIError.internal("Database not initialized. Please run database setup first.");
      }

      // Check property access with org scoping using connection stability
      const propertyRow = await executeQueryWithStability(
          () => financeDB.queryRow`
          SELECT p.id, p.org_id, p.name
          FROM properties p
          WHERE p.id = ${propertyId} AND p.org_id = ${authData.orgId}
        `,
        'check_property_access'
      );

      if (!propertyRow) {
        throw APIError.notFound("Property not found");
      }

      if (authData.role === "MANAGER") {
        const accessCheck = await executeQueryWithStability(
          () => financeDB.queryRow`
            SELECT 1 FROM user_properties 
            WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${propertyId}
          `,
          'check_user_property_access'
        );
        if (!accessCheck) {
          throw APIError.permissionDenied("No access to this property");
        }
      }

      // Create revenue record with connection stability and graceful column handling
      let revenueRow;
      try {
        // Determine status and approval fields based on user role
        const isAdmin = authData.role === "ADMIN";
        const status = isAdmin ? 'approved' : 'pending';
        const approvedByUserId = isAdmin ? parseInt(authData.userID) : null;
        const approvedAt = isAdmin ? currentTimestamp : null;

        revenueRow = await executeQueryWithStability(
          () => financeDB.queryRow`
            INSERT INTO revenues (org_id, property_id, source, amount_cents, currency, description, receipt_url, occurred_at, created_by_user_id, status, payment_mode, bank_reference, receipt_file_id, created_at, approved_by_user_id, approved_at)
            VALUES (${authData.orgId}, ${propertyId}, ${source}, ${amountCents}, ${currency}, ${description || null}, ${finalReceiptUrl || null}, ${occurredAtDate}, ${parseInt(authData.userID)}, ${status}, ${paymentMode}, ${bankReference || null}, ${receiptFileId || null}, ${currentTimestamp}, ${approvedByUserId}, ${approvedAt})
            RETURNING id, property_id, source, amount_cents, currency, description, receipt_url, occurred_at, status, created_by_user_id, created_at, payment_mode, bank_reference, receipt_file_id, approved_by_user_id, approved_at
          `,
          'create_revenue_with_new_columns'
        );
      } catch (dbError: any) {
        console.error('Database error during revenue creation:', dbError);
        
        // If columns are missing, try without the new columns using connection stability
        if (dbError.message?.includes('column') && dbError.message?.includes('does not exist')) {
          console.log('Trying fallback insert without new columns...');
          try {
            revenueRow = await executeQueryWithStability(
              () => financeDB.queryRow`
                INSERT INTO revenues (org_id, property_id, source, amount_cents, currency, description, receipt_url, occurred_at, created_by_user_id, created_at)
                VALUES (${authData.orgId}, ${propertyId}, ${source}, ${amountCents}, ${currency}, ${description || null}, ${finalReceiptUrl || null}, ${occurredAtDate}, ${parseInt(authData.userID)}, ${currentTimestamp})
                RETURNING id, property_id, source, amount_cents, currency, description, receipt_url, occurred_at, created_by_user_id, created_at
              `,
              'create_revenue_fallback'
            );
            
            // Set default values for missing columns in memory only
            if (revenueRow) {
              revenueRow.status = authData.role === "ADMIN" ? 'approved' : 'pending';
              revenueRow.payment_mode = paymentMode || null;
              revenueRow.bank_reference = bankReference || null;
              revenueRow.receipt_file_id = receiptFileId || null;
              revenueRow.approved_by_user_id = authData.role === "ADMIN" ? parseInt(authData.userID) : null;
              revenueRow.approved_at = authData.role === "ADMIN" ? currentTimestamp : null;
            }
          } catch (fallbackError: any) {
            // Use enhanced error handling for fallback failure
            throw handleFinanceError(fallbackError, 'add_revenue', {
              userId: authData.userID,
              orgId: authData.orgId.toString(),
              operation: 'create_revenue_fallback',
              table: 'revenues'
            });
          }
        } else {
          // Use enhanced error handling for other database errors
          throw handleFinanceError(dbError, 'add_revenue', {
            userId: authData.userID,
            orgId: authData.orgId.toString(),
            operation: 'create_revenue',
            table: 'revenues'
          });
        }
      }

      if (!revenueRow) {
        throw new Error("Failed to create revenue record");
      }

      // All transactions now require daily approval - no auto-approval
      // Status is already set to 'pending' in the INSERT statement above
      console.log(`Revenue created with pending status - requires daily approval. ID: ${revenueRow.id}`);

      console.log('Revenue creation completed successfully');

      // Publish event for real-time updates BEFORE returning
      try {
        await financeEvents.publish({
          eventId: uuidv4(),
          eventVersion: 'v1',
          eventType: 'revenue_added',
          orgId: authData.orgId,
          propertyId: revenueRow.property_id,
          userId: parseInt(authData.userID),
          timestamp: new Date(),
          entityId: revenueRow.id,
          entityType: 'revenue',
          metadata: {
            amountCents: revenueRow.amount_cents,
            currency: revenueRow.currency,
            transactionDate: toISTDateString(revenueRow.occurred_at || new Date()),
            paymentMode: revenueRow.payment_mode,
            source: revenueRow.source,
            affectedReportDates: [toISTDateString(revenueRow.occurred_at || new Date())],
            propertyName: propertyRow?.name || undefined,
            newStatus: revenueRow.status || undefined
          }
        });
        console.log(`[Finance] Published revenue_added event for revenue ID: ${revenueRow.id}`);
      } catch (eventError) {
        console.error('[Finance] Failed to publish revenue_added event:', eventError);
        // Don't fail the transaction if event publishing fails
      }

      return {
        id: revenueRow.id,
        propertyId: revenueRow.property_id,
        // Include property name so frontend can render immediately without extra lookups
        propertyName: propertyRow?.name || 'Unknown Property',
        source: revenueRow.source,
        amountCents: revenueRow.amount_cents,
        currency: revenueRow.currency,
        description: revenueRow.description,
        receiptUrl: revenueRow.receipt_url,
        receiptFileId: revenueRow.receipt_file_id,
        occurredAt: revenueRow.occurred_at,
        paymentMode: revenueRow.payment_mode,
        bankReference: revenueRow.bank_reference,
        createdByUserId: revenueRow.created_by_user_id,
        // Best-effort creator name; frontend also has user context
        createdByName: (authData as any)?.displayName || (authData as any)?.email || 'Unknown User',
        createdAt: revenueRow.created_at,
        status: revenueRow.status || 'pending',
        approvedByUserId: revenueRow.approved_by_user_id,
        approvedAt: revenueRow.approved_at,
      };
    } catch (error) {
      // Use enhanced error handling for any remaining errors
      throw handleFinanceError(error as Error, 'add_revenue', {
        userId: authData.userID,
        orgId: authData.orgId.toString(),
        operation: 'add_revenue',
        table: 'revenues'
      });
    }
  }

// LEGACY: Adds a new revenue record (keep for backward compatibility)
export const addRevenue = api<AddRevenueRequest, AddRevenueResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/revenues" },
  addRevenueHandler
);

// V1: Adds a new revenue record
export const addRevenueV1 = api<AddRevenueRequest, AddRevenueResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/finance/revenues" },
  addRevenueHandler
);

