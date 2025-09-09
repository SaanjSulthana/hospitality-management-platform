import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";
import { checkDailyApproval } from "./check_daily_approval";

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
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    // Check if manager can add transactions based on daily approval workflow
    if (authData.role === "MANAGER") {
      const approvalCheck = await checkDailyApproval({});
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
    console.log('Revenue creation - occurred_at date:', occurredAtDate.toISOString());
    console.log('Revenue creation - current timestamp:', currentTimestamp.toISOString());

    if (amountCents <= 0) {
      throw APIError.invalidArgument("Amount must be greater than zero");
    }

    const tx = await financeDB.begin();
    try {
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

      // Create revenue record
      const revenueRow = await tx.queryRow`
        INSERT INTO revenues (org_id, property_id, source, amount_cents, currency, description, receipt_url, receipt_file_id, occurred_at, created_by_user_id, status, payment_mode, bank_reference, created_at)
        VALUES (${authData.orgId}, ${propertyId}, ${source}, ${amountCents}, ${currency}, ${description || null}, ${receiptUrl || null}, ${receiptFileId || null}, ${occurredAtDate}, ${parseInt(authData.userID)}, 'pending', ${paymentMode}, ${bankReference || null}, ${currentTimestamp})
        RETURNING id, property_id, source, amount_cents, currency, description, receipt_url, receipt_file_id, occurred_at, status, created_by_user_id, created_at, payment_mode, bank_reference
      `;

      if (!revenueRow) {
        throw new Error("Failed to create revenue record");
      }

      // Auto-approve for admins, require approval for managers
      if (authData.role === "ADMIN") {
        await tx.exec`
          UPDATE revenues 
          SET status = 'approved', approved_by_user_id = ${parseInt(authData.userID)}, approved_at = NOW()
          WHERE id = ${revenueRow.id} AND org_id = ${authData.orgId}
        `;
        revenueRow.status = 'approved';
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
      };
    } catch (error) {
      await tx.rollback();
      console.error('Add revenue error:', error);
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      throw APIError.internal("Failed to add revenue");
    }
  }
);

