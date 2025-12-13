import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";

// Batch request types
export interface BatchRequest {
  requests: BatchSubRequest[];
}

export interface BatchSubRequest {
  id: string; // Unique identifier for this sub-request
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string; // Relative path like "/v1/finance/expenses"
  body?: any; // Request body for POST/PATCH
  headers?: Record<string, string>; // Additional headers
}

export interface BatchResponse {
  responses: BatchSubResponse[];
}

export interface BatchSubResponse {
  id: string; // Matches the request id
  status: number; // HTTP status code
  headers?: Record<string, string>; // Response headers
  body?: any; // Response body
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// Import service handlers dynamically to avoid circular dependencies
// We'll route requests to the appropriate handlers
async function routeBatchRequest(
  subRequest: BatchSubRequest,
  authData: any
): Promise<{ status: number; headers?: Record<string, string>; body?: any }> {
  const { method, path, body, headers } = subRequest;

  // Remove leading slash and split path
  const pathParts = path.replace(/^\/+/, '').split('/');
  const version = pathParts[0]; // v1, v2, etc.
  const service = pathParts[1]; // finance, properties, etc.

  // Route to appropriate service handler
  switch (`${version}/${service}`) {
    case 'v1/finance':
      return await routeFinanceRequest(method, path, body, headers, authData);
    case 'v1/properties':
      return await routePropertiesRequest(method, path, body, headers, authData);
    case 'v1/staff':
      return await routeStaffRequest(method, path, body, headers, authData);
    case 'v1/tasks':
      return await routeTasksRequest(method, path, body, headers, authData);
    case 'v1/users':
      return await routeUsersRequest(method, path, body, headers, authData);
    case 'v1/reports':
      return await routeReportsRequest(method, path, body, headers, authData);
    default:
      throw APIError.notFound(`Unsupported batch endpoint: ${path}`);
  }
}

// Finance service routing
async function routeFinanceRequest(method: string, path: string, body: any, headers: any, authData: any) {
  const { listExpensesV1 } = await import('../finance/list_expenses');
  const { listRevenuesV1 } = await import('../finance/list_revenues');
  const { addExpense } = await import('../finance/add_expense');
  const { addRevenue } = await import('../finance/add_revenue');

  if (path.includes('/expenses') && method === 'GET') {
    // Extract query params from headers or body
    const queryParams = headers?.queryParams || {};
    return await listExpensesV1({
      propertyId: queryParams.propertyId,
      category: queryParams.category,
      status: queryParams.status,
      startDate: queryParams.startDate,
      endDate: queryParams.endDate,
      fields: queryParams.fields,
      expand: queryParams.expand,
      ifNoneMatch: headers?.['If-None-Match']
    });
  }

  if (path.includes('/revenues') && method === 'GET') {
    const queryParams = headers?.queryParams || {};
    return await listRevenuesV1({
      propertyId: queryParams.propertyId,
      category: queryParams.category,
      status: queryParams.status,
      startDate: queryParams.startDate,
      endDate: queryParams.endDate,
      fields: queryParams.fields,
      expand: queryParams.expand,
      ifNoneMatch: headers?.['If-None-Match']
    });
  }

  if (path.includes('/expenses') && method === 'POST') {
    return await addExpense(body);
  }

  if (path.includes('/revenues') && method === 'POST') {
    return await addRevenue(body);
  }

  throw APIError.notFound(`Finance endpoint not supported in batch: ${method} ${path}`);
}

// Properties service routing
async function routePropertiesRequest(method: string, path: string, body: any, headers: any, authData: any) {
  const { listV1: listPropertiesV1 } = await import('../properties/list');

  if (path.includes('/properties') && method === 'GET') {
    const queryParams = headers?.queryParams || {};
    return await listPropertiesV1({
      search: queryParams.search,
      limit: queryParams.limit,
      offset: queryParams.offset
    });
  }

  throw APIError.notFound(`Properties endpoint not supported in batch: ${method} ${path}`);
}

// Staff service routing
async function routeStaffRequest(method: string, path: string, body: any, headers: any, authData: any) {
  const { listV1: listStaffV1 } = await import('../staff/list');

  if (path.includes('/staff') && method === 'GET') {
    const queryParams = headers?.queryParams || {};
    return await listStaffV1({
      propertyId: queryParams.propertyId,
      search: queryParams.search,
      limit: queryParams.limit,
      offset: queryParams.offset
    });
  }

  throw APIError.notFound(`Staff endpoint not supported in batch: ${method} ${path}`);
}

// Tasks service routing
async function routeTasksRequest(method: string, path: string, body: any, headers: any, authData: any) {
  const { listV1: listTasksV1 } = await import('../tasks/list');

  if (path.includes('/tasks') && method === 'GET') {
    const queryParams = headers?.queryParams || {};
    return await listTasksV1({
      propertyId: queryParams.propertyId,
      status: queryParams.status,
      assignedToUserId: queryParams.assignedToUserId,
      search: queryParams.search,
      limit: queryParams.limit,
      offset: queryParams.offset
    });
  }

  throw APIError.notFound(`Tasks endpoint not supported in batch: ${method} ${path}`);
}

// Users service routing
async function routeUsersRequest(method: string, path: string, body: any, headers: any, authData: any) {
  const { listV1: listUsersV1 } = await import('../users/list');

  if (path.includes('/users') && method === 'GET') {
    const queryParams = headers?.queryParams || {};
    return await listUsersV1({
      search: queryParams.search,
      role: queryParams.role,
      limit: queryParams.limit,
      offset: queryParams.offset
    });
  }

  throw APIError.notFound(`Users endpoint not supported in batch: ${method} ${path}`);
}

// Reports service routing
async function routeReportsRequest(method: string, path: string, body: any, headers: any, authData: any) {
  const { getDailyReportV1 } = await import('../reports/daily_reports');

  if (path.includes('/daily-report') && method === 'GET') {
    const queryParams = headers?.queryParams || {};
    return await getDailyReportV1({
      propertyId: queryParams.propertyId,
      date: queryParams.date
    });
  }

  throw APIError.notFound(`Reports endpoint not supported in batch: ${method} ${path}`);
}

// Main batch handler
async function batchHandler(req: BatchRequest): Promise<BatchResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }

  // Limit batch size to prevent abuse
  if (req.requests.length > 20) {
    throw APIError.invalidArgument("Batch request too large. Maximum 20 requests allowed.");
  }

  requireRole("ADMIN", "MANAGER")(authData);

  const responses: BatchSubResponse[] = [];

  // Process requests sequentially to maintain consistency
  for (const subRequest of req.requests) {
    try {
      const result = await routeBatchRequest(subRequest, authData);

      responses.push({
        id: subRequest.id,
        status: 200, // Assume success for now
        headers: result.headers,
        body: result
      });
    } catch (error: any) {
      // Handle errors gracefully
      let status = 500;
      let errorCode = "INTERNAL_ERROR";
      let message = "Internal server error";

      if (error instanceof APIError) {
        status = error.code === "NOT_FOUND" ? 404 :
                error.code === "UNAUTHENTICATED" ? 401 :
                error.code === "PERMISSION_DENIED" ? 403 :
                error.code === "INVALID_ARGUMENT" ? 400 : 500;
        errorCode = error.code;
        message = error.message;
      }

      responses.push({
        id: subRequest.id,
        status,
        error: {
          code: errorCode,
          message,
          details: error.details
        }
      });
    }
  }

  return { responses };
}

// Batch endpoint - supports combining multiple API calls into one request
export const batch = api<BatchRequest, BatchResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/batch" },
  batchHandler
);

