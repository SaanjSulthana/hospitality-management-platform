import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";
import { handleFinanceError, executeWithRetry, generateFallbackQuery, isSchemaError } from "./error_handling";

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
  occurredAt: Date;
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

    console.log('List revenues request:', { propertyId, source, startDate, endDate, orgId: authData.orgId });
    
    // Check if new columns exist and build query dynamically
    let hasNewColumns = false;
    try {
      const columnCheck = await financeDB.queryRow`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'revenues' AND column_name IN ('status', 'payment_mode', 'bank_reference', 'receipt_file_id', 'approved_by_user_id', 'approved_at')
      `;
      hasNewColumns = !!columnCheck;
    } catch (error) {
      console.log('Column check failed, using fallback query:', error);
    }

    let query = `
      SELECT
        r.id, r.property_id, p.name as property_name, r.source, r.amount_cents, r.currency,
        r.description, r.receipt_url, r.occurred_at,
        r.created_by_user_id, r.created_at,
        u.display_name as created_by_name
      FROM revenues r
      JOIN properties p ON r.property_id = p.id AND p.org_id = $1
      JOIN users u ON r.created_by_user_id = u.id AND u.org_id = $1
      WHERE r.org_id = $1
    `;

    // Add new columns if they exist
    if (hasNewColumns) {
      query = `
        SELECT
          r.id, r.property_id, p.name as property_name, r.source, r.amount_cents, r.currency,
          r.description, r.receipt_url, r.receipt_file_id, r.occurred_at,
          r.payment_mode, r.bank_reference,
          COALESCE(r.status, 'pending') as status, r.created_by_user_id, r.created_at,
          u.display_name as created_by_name,
          r.approved_by_user_id,
          approver.display_name as approved_by_name,
          r.approved_at
        FROM revenues r
        JOIN properties p ON r.property_id = p.id AND p.org_id = $1
        JOIN users u ON r.created_by_user_id = u.id AND u.org_id = $1
        LEFT JOIN users approver ON r.approved_by_user_id = approver.id AND approver.org_id = $1
        WHERE r.org_id = $1
      `;
    }
    const params: any[] = [authData.orgId];
    let paramIndex = 2;

    try {

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
        // Filter by IST date to handle timezone correctly
        query += ` AND DATE(r.occurred_at AT TIME ZONE 'Asia/Kolkata') >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        // Filter by IST date to handle timezone correctly
        query += ` AND DATE(r.occurred_at AT TIME ZONE 'Asia/Kolkata') <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      query += ` ORDER BY r.occurred_at DESC, r.created_at DESC`;

      console.log('Executing query:', query);
      console.log('Query params:', params);
      
      // Execute query with retry logic for connection issues
      const revenues = await executeWithRetry(
        () => financeDB.rawQueryAll(query, ...params),
        3, // max retries
        1000 // delay between retries
      );
      
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
          receiptFileId: hasNewColumns ? revenue.receipt_file_id : null,
          occurredAt: revenue.occurred_at,
          paymentMode: hasNewColumns ? (revenue.payment_mode || 'cash') : 'cash',
          bankReference: hasNewColumns ? revenue.bank_reference : null,
          status: hasNewColumns ? (revenue.status || 'pending') : 'pending',
          createdByUserId: revenue.created_by_user_id,
          createdByName: revenue.created_by_name,
          approvedByUserId: hasNewColumns ? revenue.approved_by_user_id : null,
          approvedByName: hasNewColumns ? revenue.approved_by_name : null,
          approvedAt: hasNewColumns ? revenue.approved_at : null,
          createdAt: revenue.created_at,
        })),
        totalAmount,
      };
    } catch (error) {
      // Handle schema errors with fallback query
      if (isSchemaError(error as Error)) {
        console.log('Schema error detected, attempting fallback query...');
        try {
          // Try with a simplified query without new columns
          const fallbackQuery = generateFallbackQuery(query, ['status', 'payment_mode', 'bank_reference', 'receipt_file_id', 'approved_by_user_id', 'approved_at']);
          console.log('Executing fallback query:', fallbackQuery);
          
          const fallbackRevenues = await executeWithRetry(
            () => financeDB.rawQueryAll(fallbackQuery, params[0]), // Only pass orgId parameter
            3,
            1000
          );
          
          const totalAmount = fallbackRevenues
            .reduce((sum, revenue) => sum + (parseInt(revenue.amount_cents) || 0), 0);

          return {
            revenues: fallbackRevenues.map((revenue) => ({
              id: revenue.id,
              propertyId: revenue.property_id,
              propertyName: revenue.property_name,
              source: revenue.source,
              amountCents: parseInt(revenue.amount_cents),
              currency: revenue.currency,
              description: revenue.description,
              receiptUrl: revenue.receipt_url,
              receiptFileId: null, // Not available in fallback
              occurredAt: revenue.occurred_at,
              paymentMode: 'cash', // Default value
              bankReference: null, // Not available in fallback
              status: 'pending', // Default value
              createdByUserId: revenue.created_by_user_id,
              createdByName: revenue.created_by_name,
              approvedByUserId: null, // Not available in fallback
              approvedByName: null, // Not available in fallback
              approvedAt: null, // Not available in fallback
              createdAt: revenue.created_at,
            })),
            totalAmount,
          };
        } catch (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          // If fallback also fails, use enhanced error handling
          throw handleFinanceError(fallbackError as Error, 'list_revenues', {
            userId: authData.userId,
            orgId: authData.orgId,
            query: fallbackQuery,
            table: 'revenues'
          });
        }
      }
      
      // Use enhanced error handling for all other errors
      throw handleFinanceError(error as Error, 'list_revenues', {
        userId: authData.userId,
        orgId: authData.orgId,
        query,
        table: 'revenues'
      });
    }
  }
);
