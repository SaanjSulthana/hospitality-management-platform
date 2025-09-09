import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";

interface ListRevenuesRequest {
  propertyId?: number;
  source?: string;
  startDate?: string; // YYYY-MM-DD format
  endDate?: string; // YYYY-MM-DD format
}

export interface RevenueInfo {
  id: number;
  propertyId: number;
  propertyName: string;
  source: string;
  amountCents: number;
  currency: string;
  description?: string;
  receiptUrl?: string;
  receiptFileId?: number;
  occurredAt: Date;
  paymentMode: string;
  bankReference?: string;
  status: string;
  createdByUserId: number;
  createdByName: string;
  approvedByUserId?: number;
  approvedByName?: string;
  approvedAt?: Date;
  createdAt: Date;
}

export interface ListRevenuesResponse {
  revenues: RevenueInfo[];
  totalAmount: number;
}

// Lists revenues with filtering
export const listRevenues = api<ListRevenuesRequest, ListRevenuesResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/revenues" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { propertyId, source, startDate, endDate } = req || {};

    try {
      console.log('List revenues request:', { propertyId, source, startDate, endDate, orgId: authData.orgId });
      let query = `
        SELECT 
          r.id, r.property_id, p.name as property_name, r.source, r.amount_cents, r.currency,
          r.description, r.receipt_url, r.receipt_file_id, r.occurred_at, r.payment_mode, r.bank_reference,
          r.status, r.created_by_user_id, r.approved_by_user_id, r.approved_at, r.created_at,
          u.display_name as created_by_name,
          au.display_name as approved_by_name
        FROM revenues r
        JOIN properties p ON r.property_id = p.id AND p.org_id = $1
        JOIN users u ON r.created_by_user_id = u.id AND u.org_id = $1
        LEFT JOIN users au ON r.approved_by_user_id = au.id AND au.org_id = $1
        WHERE r.org_id = $1
      `;
      const params: any[] = [authData.orgId];
      let paramIndex = 2;

      // Managers can only see revenues for properties they have access to
      if (authData.role === "MANAGER") {
        query += ` AND p.id IN (
          SELECT property_id FROM user_properties WHERE user_id = $${paramIndex}
        )`;
        params.push(parseInt(authData.userID));
        paramIndex++;
      }

      // Apply filters
      if (propertyId) {
        query += ` AND r.property_id = $${paramIndex}`;
        params.push(propertyId);
        paramIndex++;
      }

      if (source) {
        query += ` AND r.source = $${paramIndex}`;
        params.push(source);
        paramIndex++;
      }

      if (startDate) {
        // Start of day: 00:00:00
        query += ` AND r.occurred_at >= $${paramIndex}`;
        params.push(new Date(`${startDate}T00:00:00.000Z`));
        paramIndex++;
      }

      if (endDate) {
        // End of day: 23:59:59.999
        query += ` AND r.occurred_at <= $${paramIndex}`;
        params.push(new Date(`${endDate}T23:59:59.999Z`));
        paramIndex++;
      }

      query += ` ORDER BY r.occurred_at DESC, r.created_at DESC`;

      console.log('Executing query:', query);
      console.log('Query params:', params);
      const revenues = await financeDB.rawQueryAll(query, ...params);
      console.log('Query result count:', revenues.length);

      // Calculate total amount for all revenues (including pending)
      const totalAmount = revenues
        .reduce((sum, revenue) => sum + (parseInt(revenue.amount_cents) || 0), 0);

      return {
        revenues: revenues.map((revenue) => ({
          id: revenue.id,
          propertyId: revenue.property_id,
          propertyName: revenue.property_name,
          source: revenue.source,
          amountCents: parseInt(revenue.amount_cents),
          currency: revenue.currency,
          description: revenue.description,
          receiptUrl: revenue.receipt_url,
          receiptFileId: revenue.receipt_file_id,
          occurredAt: revenue.occurred_at,
          paymentMode: revenue.payment_mode,
          bankReference: revenue.bank_reference,
          status: revenue.status,
          createdByUserId: revenue.created_by_user_id,
          createdByName: revenue.created_by_name,
          approvedByUserId: revenue.approved_by_user_id,
          approvedByName: revenue.approved_by_name,
          approvedAt: revenue.approved_at,
          createdAt: revenue.created_at,
        })),
        totalAmount,
      };
    } catch (error) {
      console.error('List revenues error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal('Failed to fetch revenues');
    }
  }
);
