import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { financeDB } from "./db";
import { v1Path } from "../shared/http";

export interface GetRevenueByIdRequest {
  id: number;
}

export interface GetRevenueByIdResponse {
  id: number;
  propertyId: number;
  propertyName: string;
  source: 'room' | 'addon' | 'other';
  amountCents: number;
  currency: string;
  description?: string;
  receiptUrl?: string;
  receiptFileId?: number;
  occurredAt: Date;
  paymentMode: 'cash' | 'bank';
  bankReference?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdByUserId: number;
  createdByName: string;
  approvedByUserId?: number;
  approvedByName?: string;
  approvedAt?: Date;
  createdAt: Date;
}

// Gets a single revenue by ID (for realtime reconciliation)
async function getRevenueByIdHandler(req: GetRevenueByIdRequest): Promise<GetRevenueByIdResponse> {
    const { id } = req;
    const authData = getAuthData();
    
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    try {
      const revenue = await financeDB.queryRow`
        SELECT
          r.id, r.property_id, p.name as property_name, r.source, r.amount_cents, r.currency,
          r.description, r.receipt_url, r.receipt_file_id, r.occurred_at,
          r.payment_mode, r.bank_reference,
          COALESCE(r.status, 'pending') as status, r.created_by_user_id,
          u.display_name as created_by_name,
          r.approved_by_user_id, au.display_name as approved_by_name, r.approved_at, r.created_at
        FROM revenues r
        JOIN properties p ON r.property_id = p.id AND p.org_id = ${authData.orgId}
        JOIN users u ON r.created_by_user_id = u.id AND u.org_id = ${authData.orgId}
        LEFT JOIN users au ON r.approved_by_user_id = au.id AND au.org_id = ${authData.orgId}
        WHERE r.id = ${id} AND r.org_id = ${authData.orgId}
      `;

      if (!revenue) {
        throw APIError.notFound("Revenue not found");
      }

      // Check manager property access
      if (authData.role === "MANAGER") {
        const hasAccess = await financeDB.queryRow`
          SELECT EXISTS(
            SELECT 1 FROM user_properties
            WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${revenue.property_id}
          ) as has_access
        `;
        
        if (!hasAccess?.has_access) {
          throw APIError.permissionDenied("You don't have access to this property");
        }
      }

      return {
        id: revenue.id,
        propertyId: revenue.property_id,
        propertyName: revenue.property_name,
        source: revenue.source,
        amountCents: revenue.amount_cents,
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
      };
    } catch (error) {
      console.error('Get revenue by ID error:', error);
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      throw APIError.internal(`Failed to fetch revenue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export const getRevenueById = api<GetRevenueByIdRequest, GetRevenueByIdResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/revenues/:id" },
  getRevenueByIdHandler
);

export const getRevenueByIdV1 = api<GetRevenueByIdRequest, GetRevenueByIdResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/finance/revenues/:id" },
  getRevenueByIdHandler
);

