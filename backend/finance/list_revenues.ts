import { api, Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";

export interface ListRevenuesRequest {
  propertyId?: Query<number>;
  source?: Query<string>;
  startDate?: Query<Date>;
  endDate?: Query<Date>;
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
  occurredAt: Date;
  createdByUserId: number;
  createdByName: string;
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
    const authData = getAuthData()!;
    const { propertyId, source, startDate, endDate } = req;

    try {
      let query = `
        SELECT 
          r.id, r.property_id, p.name as property_name, r.source, r.amount_cents, r.currency,
          r.description, r.receipt_url, r.occurred_at, r.created_by_user_id, r.created_at,
          u.display_name as created_by_name
        FROM revenues r
        JOIN properties p ON r.property_id = p.id AND p.org_id = $1
        JOIN users u ON r.created_by_user_id = u.id AND u.org_id = $1
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
        query += ` AND r.occurred_at >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        query += ` AND r.occurred_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      query += ` ORDER BY r.occurred_at DESC, r.created_at DESC`;

      const revenues = await financeDB.rawQueryAll(query, ...params);

      // Calculate total amount
      const totalAmount = revenues.reduce((sum, revenue) => sum + (parseInt(revenue.amount_cents) || 0), 0);

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
          occurredAt: revenue.occurred_at,
          createdByUserId: revenue.created_by_user_id,
          createdByName: revenue.created_by_name,
          createdAt: revenue.created_at,
        })),
        totalAmount,
      };
    } catch (error) {
      console.error('List revenues error:', error);
      throw new Error('Failed to fetch revenues');
    }
  }
);
