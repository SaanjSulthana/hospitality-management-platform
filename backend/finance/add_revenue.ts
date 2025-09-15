import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";
import { checkDailyApprovalInternal } from "./check_daily_approval";

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
}

// Adds a new revenue record
export const addRevenue = api<AddRevenueRequest, AddRevenueResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/revenues" },
  async (req) => {
    console.log('=== ADD REVENUE FUNCTION CALLED ===');
    console.log('Request data:', req);
    
    const authData = getAuthData();
    console.log('Auth data:', { userId: authData?.userID, role: authData?.role, orgId: authData?.orgId });
    
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    // Check if manager can add transactions based on daily approval workflow
    if (authData.role === "MANAGER") {
      const approvalCheck = await checkDailyApprovalInternal(authData);
      if (!approvalCheck.canAddTransactions) {
        throw APIError.permissionDenied(
          approvalCheck.message || "You cannot add transactions at this time. Please wait for admin approval."
        );
      }
    }

    const { propertyId, source, amountCents, currency = "USD", description, receiptUrl, receiptFileId, occurredAt, paymentMode = "cash", bankReference } = req;
    
    // Use provided revenue date for occurred_at field, but current timestamp for created_at
    const occurredAtDate = occurredAt ? new Date(occurredAt) : new Date();
    const currentTimestamp = new Date();

    if (amountCents <= 0) {
      throw APIError.invalidArgument("Amount must be greater than zero");
    }

    try {
      console.log('Starting revenue insertion process');
      // First check if the revenues table exists
      const revenuesTableExists = await financeDB.queryRow`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'revenues'
        )
      `;
      
      if (!revenuesTableExists?.exists) {
        throw APIError.internal("Database not initialized. Please run database setup first.");
      }

      // Check property access with org scoping
      const propertyRow = await financeDB.queryRow`
        SELECT p.id, p.org_id
        FROM properties p
        WHERE p.id = ${propertyId} AND p.org_id = ${authData.orgId}
      `;

      if (!propertyRow) {
        throw APIError.notFound("Property not found");
      }

      if (authData.role === "MANAGER") {
        const accessCheck = await financeDB.queryRow`
          SELECT 1 FROM user_properties 
          WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${propertyId}
        `;
        if (!accessCheck) {
          throw APIError.permissionDenied("No access to this property");
        }
      }

      // Create revenue record - handle potential missing columns gracefully
      let revenueRow;
      try {
        revenueRow = await financeDB.queryRow`
          INSERT INTO revenues (org_id, property_id, source, amount_cents, currency, description, receipt_url, occurred_at, created_by_user_id, status, payment_mode, bank_reference, receipt_file_id, created_at)
          VALUES (${authData.orgId}, ${propertyId}, ${source}, ${amountCents}, ${currency}, ${description || null}, ${receiptUrl || null}, ${occurredAtDate}, ${parseInt(authData.userID)}, 'pending', ${paymentMode}, ${bankReference || null}, ${receiptFileId || null}, ${currentTimestamp})
          RETURNING id, property_id, source, amount_cents, currency, description, receipt_url, occurred_at, status, created_by_user_id, created_at, payment_mode, bank_reference, receipt_file_id
        `;
      } catch (dbError: any) {
        console.error('Database error during revenue creation:', dbError);
        
        // If columns are missing, try without the new columns
        if (dbError.message?.includes('column') && dbError.message?.includes('does not exist')) {
          console.log('Trying fallback insert without new columns...');
          revenueRow = await financeDB.queryRow`
            INSERT INTO revenues (org_id, property_id, source, amount_cents, currency, description, receipt_url, occurred_at, created_by_user_id, status, created_at)
            VALUES (${authData.orgId}, ${propertyId}, ${source}, ${amountCents}, ${currency}, ${description || null}, ${receiptUrl || null}, ${occurredAtDate}, ${parseInt(authData.userID)}, 'pending', ${currentTimestamp})
            RETURNING id, property_id, source, amount_cents, currency, description, receipt_url, occurred_at, created_by_user_id, status, created_at
          `;
          
          // Set default values for missing columns in memory only
          if (revenueRow) {
            revenueRow.status = 'pending';
            revenueRow.payment_mode = paymentMode;
            revenueRow.bank_reference = bankReference;
            revenueRow.receipt_file_id = receiptFileId;
          }
        } else {
          throw dbError;
        }
      }

      if (!revenueRow) {
        throw new Error("Failed to create revenue record");
      }

      // All transactions now require daily approval - no auto-approval
      // Status is already set to 'pending' in the INSERT statement above
      console.log(`Revenue created with pending status - requires daily approval. ID: ${revenueRow.id}`);

      console.log('Revenue creation completed successfully');

      return {
        id: revenueRow.id,
        propertyId: revenueRow.property_id,
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
        createdAt: revenueRow.created_at,
      };
    } catch (error) {
      // Error occurred during revenue creation
      console.error('Add revenue error:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined
      });
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      throw APIError.internal(`Failed to add revenue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

