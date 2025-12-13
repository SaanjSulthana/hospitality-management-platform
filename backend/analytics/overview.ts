import { api, APIError, Header } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { analyticsDB } from "./db";
import { requireRole } from "../auth/middleware";
import { 
  trackMetrics,
  generateETag,
  checkConditionalGet,
  generateCacheHeaders,
  recordETagCheck
} from "../middleware";

interface OverviewRequest {
  propertyId?: number;
  regionId?: number;
  startDate?: string; // YYYY-MM-DD format
  endDate?: string; // YYYY-MM-DD format
  // Conditional GET headers for cache validation
  ifNoneMatch?: Header<"If-None-Match">;
}

export interface OverviewMetrics {
  occupancyRate: number;
  adr: number; // Average Daily Rate
  revpar: number; // Revenue Per Available Room
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  totalBookings: number;
  totalGuests: number;
  averageStayLength: number;
  taskCompletionRate: number;
  staffUtilization: number;
}

export interface OverviewResponse {
  metrics: OverviewMetrics;
  period: {
    startDate: Date;
    endDate: Date;
  };
  // Cache metadata
  _meta?: {
    etag?: string;
    cacheControl?: string;
    cached?: boolean;  // True if this is a 304-equivalent response
  };
}

// Gets analytics overview with role-based filtering
async function overviewHandler(req: OverviewRequest): Promise<OverviewResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    
    // Wrap with metrics tracking and ETag support
    return trackMetrics('/v1/analytics/overview', async (timer) => {
      timer.checkpoint('auth');
      requireRole("ADMIN", "MANAGER")(authData);

      const { propertyId, regionId, startDate, endDate, ifNoneMatch } = req || {};

      try {
      // Default to last 30 days if no date range provided
      const defaultEndDate = new Date();
      const defaultStartDate = new Date();
      defaultStartDate.setDate(defaultStartDate.getDate() - 30);

      const periodStart = startDate ? new Date(startDate) : defaultStartDate;
      const periodEnd = endDate ? new Date(endDate) : defaultEndDate;

      // Build property filter based on role and filters
      let propertyFilter = "";
      const params: any[] = [authData.orgId, periodStart, periodEnd];
      let paramIndex = 4;

      if (propertyId) {
        propertyFilter += ` AND p.id = $${paramIndex}`;
        params.push(propertyId);
        paramIndex++;
      }

      if (regionId) {
        propertyFilter += ` AND p.region_id = $${paramIndex}`;
        params.push(regionId);
        paramIndex++;
      }

      if (authData.role === "MANAGER") {
        propertyFilter += ` AND p.id IN (
          SELECT property_id FROM user_properties WHERE user_id = $${paramIndex}
        )`;
        params.push(parseInt(authData.userID));
        paramIndex++;
      }

      // Get revenue metrics
      const revenueQuery = `
        SELECT 
          COALESCE(SUM(r.amount_cents), 0) as total_revenue_cents,
          COUNT(DISTINCT b.id) as total_bookings,
          COUNT(DISTINCT b.guest_id) as total_guests,
          COALESCE(AVG(EXTRACT(EPOCH FROM (b.checkout_date - b.checkin_date))/86400), 0) as avg_stay_length
        FROM properties p
        LEFT JOIN revenues r ON p.id = r.property_id AND r.org_id = $1 AND r.occurred_at BETWEEN $2 AND $3
        LEFT JOIN bookings b ON p.id = b.property_id AND b.org_id = $1 AND b.checkin_date BETWEEN $2 AND $3
        WHERE p.org_id = $1 ${propertyFilter}
      `;

      // TODO: Replace with real database query once tables are set up
      const revenueData = {
        total_revenue_cents: "12500000", // $125,000
        total_bookings: "342",
        total_guests: "456",
        avg_stay_length: "2.3"
      };

      // Get expense metrics
      const expenseQuery = `
        SELECT COALESCE(SUM(e.amount_cents), 0) as total_expenses_cents
        FROM properties p
        LEFT JOIN expenses e ON p.id = e.property_id AND e.org_id = $1 AND e.expense_date BETWEEN $2 AND $3 AND e.status = 'approved'
        WHERE p.org_id = $1 ${propertyFilter}
      `;

      // TODO: Replace with real database query once tables are set up
      const expenseData = {
        total_expenses_cents: "8500000" // $85,000
      };

      // Get occupancy metrics
      const occupancyQuery = `
        SELECT 
          COUNT(DISTINCT bu.id) as total_units,
          COUNT(DISTINCT CASE WHEN bu.status = 'occupied' THEN bu.id END) as occupied_units
        FROM properties p
        LEFT JOIN beds_or_units bu ON p.id = bu.property_id AND bu.org_id = $1
        WHERE p.org_id = $1 ${propertyFilter}
      `;

      // TODO: Replace with real database query once tables are set up
      const occupancyData = {
        total_units: "100",
        occupied_units: "80"
      };

      // Get task metrics
      const taskQuery = `
        SELECT 
          COUNT(*) as total_tasks,
          COUNT(CASE WHEN t.status = 'done' THEN 1 END) as completed_tasks
        FROM properties p
        LEFT JOIN tasks t ON p.id = t.property_id AND t.org_id = $1 AND t.created_at BETWEEN $2 AND $3
        WHERE p.org_id = $1 ${propertyFilter}
      `;

      // TODO: Replace with real database query once tables are set up
      const taskData = {
        total_tasks: "45",
        completed_tasks: "38",
        pending_tasks: "7"
      };

      // Calculate metrics
      const totalRevenue = (parseInt(revenueData?.total_revenue_cents) || 0) / 100;
      const totalExpenses = (parseInt(expenseData?.total_expenses_cents) || 0) / 100;
      const netIncome = totalRevenue - totalExpenses;
      const totalBookings = parseInt(revenueData?.total_bookings) || 0;
      const totalGuests = parseInt(revenueData?.total_guests) || 0;
      const averageStayLength = parseFloat(revenueData?.avg_stay_length) || 0;

      const totalUnits = parseInt(occupancyData?.total_units) || 0;
      const occupiedUnits = parseInt(occupancyData?.occupied_units) || 0;
      const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

      const totalTasks = parseInt(taskData?.total_tasks) || 0;
      const completedTasks = parseInt(taskData?.completed_tasks) || 0;
      const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      // Calculate ADR and RevPAR
      const adr = totalBookings > 0 ? totalRevenue / totalBookings : 0;
      const revpar = totalUnits > 0 ? totalRevenue / totalUnits : 0;

      // Staff utilization (placeholder)
      const staffUtilization = 75;

      timer.checkpoint('db_complete');
      
      const response = {
        metrics: {
          occupancyRate: Math.round(occupancyRate * 100) / 100,
          adr: Math.round(adr * 100) / 100,
          revpar: Math.round(revpar * 100) / 100,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalExpenses: Math.round(totalExpenses * 100) / 100,
          netIncome: Math.round(netIncome * 100) / 100,
          totalBookings,
          totalGuests,
          averageStayLength: Math.round(averageStayLength * 10) / 10,
          taskCompletionRate: Math.round(taskCompletionRate * 100) / 100,
          staffUtilization: Math.round(staffUtilization * 100) / 100,
        },
        period: {
          startDate: periodStart,
          endDate: periodEnd,
        },
      };
      
      // Generate ETag for response
      const etag = generateETag(response);
      
      // Check if client has valid cached version
      if (ifNoneMatch && checkConditionalGet(etag, ifNoneMatch)) {
        recordETagCheck('/v1/analytics/overview', true);
        console.log('[Analytics] 304 Not Modified - ETag match:', etag);
        // Return minimal response (zeros signal use cached version)
        return { 
          metrics: {
            occupancyRate: 0,
            adr: 0,
            revpar: 0,
            totalRevenue: 0,
            totalExpenses: 0,
            netIncome: 0,
            totalBookings: 0,
            totalGuests: 0,
            averageStayLength: 0,
            taskCompletionRate: 0,
            staffUtilization: 0,
          },
          period: response.period,
          _meta: { 
            etag, 
            cacheControl: 'public, s-maxage=300, stale-while-revalidate=86400',
            cached: true
          } 
        };
      }
      
      recordETagCheck('/v1/analytics/overview', false);
      
      // Generate cache headers (analytics = 5 min CDN cache)
      const cacheHeaders = generateCacheHeaders('summaries', {
        orgId: authData.orgId,
        propertyId,
      });
      
      return {
        ...response,
        _meta: {
          etag,
          cacheControl: cacheHeaders['Cache-Control']
        }
      };
    } catch (error) {
      console.error('Analytics overview error:', error);
      throw new Error('Failed to fetch analytics data');
    }
  }); // End trackMetrics
}

// LEGACY: Gets analytics overview (keep for backward compatibility)
export const overview = api<OverviewRequest, OverviewResponse>(
  { auth: true, expose: true, method: "GET", path: "/analytics/overview" },
  overviewHandler
);

export const overviewV1 = api<OverviewRequest, OverviewResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/analytics/overview" },
  overviewHandler
);

