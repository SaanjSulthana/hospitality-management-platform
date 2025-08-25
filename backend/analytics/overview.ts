import { api, Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { analyticsDB } from "./db";

export interface OverviewRequest {
  propertyId?: Query<number>;
  regionId?: Query<number>;
  startDate?: Query<Date>;
  endDate?: Query<Date>;
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
}

// Gets analytics overview with role-based filtering
export const overview = api<OverviewRequest, OverviewResponse>(
  { auth: true, expose: true, method: "GET", path: "/analytics/overview" },
  async (req) => {
    const authData = getAuthData()!;
    const { propertyId, regionId, startDate, endDate } = req;

    try {
      // Default to last 30 days if no date range provided
      const defaultEndDate = new Date();
      const defaultStartDate = new Date();
      defaultStartDate.setDate(defaultStartDate.getDate() - 30);

      const periodStart = startDate || defaultStartDate;
      const periodEnd = endDate || defaultEndDate;

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

      const revenueData = await analyticsDB.rawQueryRow(revenueQuery, ...params);

      // Get expense metrics
      const expenseQuery = `
        SELECT COALESCE(SUM(e.amount_cents), 0) as total_expenses_cents
        FROM properties p
        LEFT JOIN expenses e ON p.id = e.property_id AND e.org_id = $1 AND e.expense_date BETWEEN $2 AND $3 AND e.status = 'approved'
        WHERE p.org_id = $1 ${propertyFilter}
      `;

      const expenseData = await analyticsDB.rawQueryRow(expenseQuery, ...params);

      // Get occupancy metrics
      const occupancyQuery = `
        SELECT 
          COUNT(DISTINCT bu.id) as total_units,
          COUNT(DISTINCT CASE WHEN bu.status = 'occupied' THEN bu.id END) as occupied_units
        FROM properties p
        LEFT JOIN beds_or_units bu ON p.id = bu.property_id AND bu.org_id = $1
        WHERE p.org_id = $1 ${propertyFilter}
      `;

      const occupancyData = await analyticsDB.rawQueryRow(occupancyQuery, ...params);

      // Get task metrics
      const taskQuery = `
        SELECT 
          COUNT(*) as total_tasks,
          COUNT(CASE WHEN t.status = 'done' THEN 1 END) as completed_tasks
        FROM properties p
        LEFT JOIN tasks t ON p.id = t.property_id AND t.org_id = $1 AND t.created_at BETWEEN $2 AND $3
        WHERE p.org_id = $1 ${propertyFilter}
      `;

      const taskData = await analyticsDB.rawQueryRow(taskQuery, ...params);

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

      return {
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
    } catch (error) {
      console.error('Analytics overview error:', error);
      throw new Error('Failed to fetch analytics data');
    }
  }
);
