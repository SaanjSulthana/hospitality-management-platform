import { api, APIError, Header, Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";
import { handleFinanceError, executeWithRetry, generateFallbackQuery, isSchemaError } from "./error_handling";
import { v1Path } from "../shared/http";
import { 
  trackMetrics,
  generateCollectionETag,
  checkConditionalGet,
  generateCacheHeaders,
  recordETagCheck
} from "../middleware";
import {
  createFieldSelector,
  recordFieldSelectionStats,
} from "../middleware/field_selector";

interface ListRevenuesRequest {
  propertyId?: number;
  source?: string;
  startDate?: string; // YYYY-MM-DD format
  endDate?: string; // YYYY-MM-DD format
  // Conditional GET headers for cache validation
  ifNoneMatch?: Header<"If-None-Match">;
  // Field selection for sparse responses (reduces payload size)
  fields?: Query<"fields">;
  // Expand nested objects
  expand?: Query<"expand">;
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
  // Cache metadata (returned for client-side caching)
  _meta?: {
    etag?: string;
    cacheControl?: string;
    count?: number;
    cached?: boolean;  // True if this is a 304-equivalent response
  };
}

// Lists revenues with filtering
async function listRevenuesHandler(req: ListRevenuesRequest): Promise<ListRevenuesResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    
    // Wrap with metrics tracking and ETag support
    return trackMetrics('/v1/finance/revenues', async (timer) => {
      timer.checkpoint('auth');
      requireRole("ADMIN", "MANAGER")(authData);

      const { propertyId, source, startDate, endDate, ifNoneMatch, fields, expand } = req || {};
      
      // === FIELD SELECTION ===
      const fieldSelector = createFieldSelector('finance/revenues', fields, expand);

      console.log('List revenues request:', { propertyId, source, startDate, endDate, orgId: authData.orgId });
    
    // Use full query with all columns (they are guaranteed to exist after migrations)
    let query = `
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

      query += ` ORDER BY r.created_at DESC, r.occurred_at DESC`;

      console.log('Executing query:', query);
      console.log('Query params:', params);
      
      // Execute query with retry logic for connection issues
      const revenues = await executeWithRetry(
        () => financeDB.rawQueryAll(query, ...params),
        3, // max retries
        1000 // delay between retries
      );
      
      console.log('Query result count:', revenues.length);

      timer.checkpoint('db_complete');
      
      // Calculate total amount for all revenues (including pending)
      const totalAmount = revenues
        .reduce((sum, revenue) => sum + (parseInt(revenue.amount_cents) || 0), 0);

      const revenueList = revenues.map((revenue) => ({
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
        paymentMode: revenue.payment_mode || 'cash',
        bankReference: revenue.bank_reference,
        status: revenue.status || 'pending',
        createdByUserId: revenue.created_by_user_id,
        createdByName: revenue.created_by_name,
        approvedByUserId: revenue.approved_by_user_id,
        approvedByName: revenue.approved_by_name,
        approvedAt: revenue.approved_at,
        createdAt: revenue.created_at,
      }));

      // Generate ETag from the response data
      const responseData = { revenues: revenueList, totalAmount };
      const etag = generateCollectionETag(responseData, revenueList.length);
      
      // Check If-None-Match for conditional GET (304 response)
      if (ifNoneMatch) {
        const isMatch = checkConditionalGet(etag, ifNoneMatch);
        recordETagCheck('/v1/finance/revenues', isMatch);
        
        if (isMatch) {
          console.log('[Revenues] 304 Not Modified - ETag match:', etag);
          // Return minimal response with 304 indicator
          // Note: Encore handles the actual 304 status code
          return {
            revenues: [],
            totalAmount: 0,
            _meta: { etag, cacheControl: 's-maxage=60, stale-while-revalidate=300', count: revenueList.length, cached: true }
          };
        }
      }

      // Generate cache headers
      const cacheHeaders = generateCacheHeaders('summaries', {
        orgId: authData.orgId,
        propertyId: propertyId,
      });
      
      // === APPLY FIELD SELECTION ===
      const filteredRevenues = fieldSelector.apply(revenueList) as RevenueInfo[];
      
      // Record stats for monitoring
      if (fieldSelector.hasCustomFields) {
        const savings = fieldSelector.calculateSavings(revenueList, filteredRevenues);
        recordFieldSelectionStats(true, savings.savedBytes, savings.savedPercent);
        console.log('[Revenues] Field selection applied:', {
          fieldsReturned: fieldSelector.fields.length,
          bytesSaved: savings.savedBytes,
          percentSaved: savings.savedPercent,
        });
      }
      
      // Get field selection headers
      const fieldHeaders = fieldSelector.getHeaders();

      return {
        revenues: filteredRevenues,
        totalAmount,
        _meta: {
          etag,
          cacheControl: cacheHeaders['Cache-Control'],
          count: revenueList.length,
          fieldsReturned: fieldHeaders['X-Fields-Returned'] || undefined,
        }
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
  }); // End trackMetrics
}

// Legacy path (kept during migration window)
export const listRevenues = api<ListRevenuesRequest, ListRevenuesResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/revenues" },
  listRevenuesHandler
);

// Versioned path
export const listRevenuesV1 = api<ListRevenuesRequest, ListRevenuesResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/finance/revenues" },
  listRevenuesHandler
);
