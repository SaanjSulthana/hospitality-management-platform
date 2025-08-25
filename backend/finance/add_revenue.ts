import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";

export interface AddRevenueRequest {
  propertyId: number;
  source: 'room' | 'addon' | 'other';
  amountCents: number;
  currency?: string;
  description?: string;
  receiptUrl?: string;
  occurredAt: Date;
}

export interface AddRevenueResponse {
  id: number;
  propertyId: number;
  source: string;
  amountCents: number;
  currency: string;
  description?: string;
  receiptUrl?: string;
  occurredAt: Date;
  createdByUserId: number;
  createdAt: Date;
}

// Adds a new revenue record
export const addRevenue = api<AddRevenueRequest, AddRevenueResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/revenues" },
  async (req) => {
    const authData = getAuthData()!;
    requireRole("ADMIN", "MANAGER")(authData);

    const { propertyId, source, amountCents, currency = "USD", description, receiptUrl, occurredAt } = req;

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
        INSERT INTO revenues (org_id, property_id, source, amount_cents, currency, description, receipt_url, occurred_at, created_by_user_id)
        VALUES (${authData.orgId}, ${propertyId}, ${source}, ${amountCents}, ${currency}, ${description || null}, ${receiptUrl || null}, ${occurredAt}, ${parseInt(authData.userID)})
        RETURNING id, property_id, source, amount_cents, currency, description, receipt_url, occurred_at, created_by_user_id, created_at
      `;

      if (!revenueRow) {
        throw new Error("Failed to create revenue record");
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
        occurredAt: revenueRow.occurred_at,
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
