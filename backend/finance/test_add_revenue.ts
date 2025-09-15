import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";

export interface TestAddRevenueRequest {
  propertyId: number;
  source: 'room' | 'addon' | 'other';
  amountCents: number;
  currency?: string;
  description?: string;
  receiptUrl?: string;
  receiptFileId?: number;
  occurredAt: string;
  paymentMode?: 'cash' | 'bank';
  bankReference?: string;
}

export interface TestAddRevenueResponse {
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
  success: boolean;
  error?: string;
}

// Test version of add revenue without daily approval check
export const testAddRevenue = api<TestAddRevenueRequest, TestAddRevenueResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/test-add-revenue" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { propertyId, source, amountCents, currency = "USD", description, receiptUrl, receiptFileId, occurredAt, paymentMode = "cash", bankReference } = req;
    
    // Use provided revenue date for occurred_at field, but current timestamp for created_at
    const occurredAtDate = occurredAt ? new Date(occurredAt) : new Date();
    const currentTimestamp = new Date();
    console.log('Test revenue creation - occurred_at date:', occurredAtDate.toISOString());
    console.log('Test revenue creation - current timestamp:', currentTimestamp.toISOString());

    if (amountCents <= 0) {
      throw APIError.invalidArgument("Amount must be greater than zero");
    }

    const tx = await financeDB.begin();
    try {
      // First check if the revenues table exists
      const revenuesTableExists = await tx.queryRow`
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
      const propertyRow = await tx.queryRow`
        SELECT p.id, p.org_id
        FROM properties p
        WHERE p.id = ${propertyId} AND p.org_id = ${authData.orgId}
      `;

      if (!propertyRow) {
        throw APIError.notFound("Property not found");
      }

      if (authData.role === "MANAGER") {
        const accessCheck = await tx.queryRow`
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
        revenueRow = await tx.queryRow`
          INSERT INTO revenues (org_id, property_id, source, amount_cents, currency, description, receipt_url, receipt_file_id, occurred_at, created_by_user_id, status, payment_mode, bank_reference, created_at)
          VALUES (${authData.orgId}, ${propertyId}, ${source}, ${amountCents}, ${currency}, ${description || null}, ${receiptUrl || null}, ${receiptFileId || null}, ${occurredAtDate}, ${parseInt(authData.userID)}, 'pending', ${paymentMode}, ${bankReference || null}, ${currentTimestamp})
          RETURNING id, property_id, source, amount_cents, currency, description, receipt_url, receipt_file_id, occurred_at, status, created_by_user_id, created_at, payment_mode, bank_reference
        `;
      } catch (dbError: any) {
        console.error('Database error during test revenue creation:', dbError);
        
        // If columns are missing, try without the new columns
        if (dbError.message?.includes('column') && dbError.message?.includes('does not exist')) {
          console.log('Trying fallback insert without new columns...');
          revenueRow = await tx.queryRow`
            INSERT INTO revenues (org_id, property_id, source, amount_cents, currency, description, receipt_url, occurred_at, created_by_user_id, created_at)
            VALUES (${authData.orgId}, ${propertyId}, ${source}, ${amountCents}, ${currency}, ${description || null}, ${receiptUrl || null}, ${occurredAtDate}, ${parseInt(authData.userID)}, ${currentTimestamp})
            RETURNING id, property_id, source, amount_cents, currency, description, receipt_url, occurred_at, created_by_user_id, created_at
          `;
          
          // Set default values for missing columns
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

      // Auto-approve for admins, require approval for managers
      if (authData.role === "ADMIN") {
        try {
          await tx.exec`
            UPDATE revenues 
            SET status = 'approved', approved_by_user_id = ${parseInt(authData.userID)}, approved_at = NOW()
            WHERE id = ${revenueRow.id} AND org_id = ${authData.orgId}
          `;
          revenueRow.status = 'approved';
        } catch (updateError: any) {
          console.warn('Could not update revenue status:', updateError.message);
          // Continue without status update if columns don't exist
        }
      }

      await tx.commit();

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
        success: true,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Test add revenue error:', error);
      
      return {
        id: 0,
        propertyId: 0,
        source: '',
        amountCents: 0,
        currency: '',
        occurredAt: new Date(),
        paymentMode: '',
        createdByUserId: 0,
        createdAt: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
);

