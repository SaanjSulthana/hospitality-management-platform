import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface StaffStatisticsRequest {
  propertyId?: number;
  department?: string;
  // Flattened date range for GET query compatibility
  startDate?: string; // ISO string 'YYYY-MM-DD' or full ISO
  endDate?: string;   // ISO string
}

export interface StaffStatisticsResponse {
  overview: {
    totalStaff: number;
    activeStaff: number;
    inactiveStaff: number;
    averagePerformance: number;
    averageSalary: number;
  };
  byDepartment: {
    department: string;
    count: number;
    averagePerformance: number;
    averageSalary: number;
    activeCount: number;
  }[];
  byProperty: {
    propertyId: number;
    propertyName: string;
    count: number;
    averagePerformance: number;
    averageSalary: number;
  }[];
  byStatus: {
    status: string;
    count: number;
    percentage: number;
  }[];
  performanceDistribution: {
    range: string;
    count: number;
    percentage: number;
  }[];
  salaryDistribution: {
    range: string;
    count: number;
    percentage: number;
  }[];
  attendanceTracking: {
    enabled: number;
    disabled: number;
    percentage: number;
  };
  leaveBalance: {
    average: number;
    total: number;
    distribution: {
      range: string;
      count: number;
      percentage: number;
    }[];
  };
  recentHires: {
    id: number;
    userName: string;
    department: string;
    hireDate: Date;
    performanceRating: number;
  }[];
  topPerformers: {
    id: number;
    userName: string;
    department: string;
    performanceRating: number;
    propertyName?: string;
  }[];
}

// Shared handler for getting comprehensive staff statistics and analytics
async function getStatisticsHandler(req: StaffStatisticsRequest): Promise<StaffStatisticsResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN", "MANAGER")(authData);

    const { propertyId, department, startDate, endDate } = req || {};

    try {
      // Build base WHERE clause
      let whereClause = `WHERE s.org_id = ${authData.orgId}`;
      const params: any[] = [authData.orgId];
      let paramIndex = 2;

      // Managers can only see statistics for their assigned properties
      if (authData.role === "MANAGER") {
        whereClause += ` AND (
          s.property_id IN (SELECT property_id FROM user_properties WHERE user_id = $${paramIndex})
          OR s.property_id IS NULL
        )`;
        params.push(parseInt(authData.userID));
        paramIndex++;
      }

      if (propertyId) {
        whereClause += ` AND s.property_id = $${paramIndex}`;
        params.push(propertyId);
        paramIndex++;
      }

      if (department) {
        whereClause += ` AND s.department = $${paramIndex}`;
        params.push(department);
        paramIndex++;
      }

      if (startDate && endDate) {
        whereClause += ` AND s.hire_date >= $${paramIndex} AND s.hire_date <= $${paramIndex + 1}`;
        params.push(startDate, endDate);
        paramIndex += 2;
      }

      // Get overview statistics
      const overview = await staffDB.rawQueryRow(
        `SELECT 
          COUNT(*) as total_staff,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_staff,
          COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_staff,
          AVG(performance_rating) as avg_performance,
          AVG(base_salary_cents) as avg_salary
        FROM staff s
        ${whereClause}`,
        params
      );

      // Get statistics by department
      const byDepartment = await staffDB.rawQueryAll(
        `SELECT 
          s.department,
          COUNT(*) as count,
          AVG(s.performance_rating) as avg_performance,
          AVG(s.base_salary_cents) as avg_salary,
          COUNT(CASE WHEN s.status = 'active' THEN 1 END) as active_count
        FROM staff s
        ${whereClause}
        GROUP BY s.department
        ORDER BY count DESC`,
        params
      );

      // Get statistics by property
      const byProperty = await staffDB.rawQueryAll(
        `SELECT 
          s.property_id,
          p.name as property_name,
          COUNT(*) as count,
          AVG(s.performance_rating) as avg_performance,
          AVG(s.base_salary_cents) as avg_salary
        FROM staff s
        LEFT JOIN properties p ON s.property_id = p.id AND p.org_id = $${paramIndex}
        ${whereClause}
        GROUP BY s.property_id, p.name
        ORDER BY count DESC`,
        [...params, authData.orgId]
      );

      // Get statistics by status
      const byStatus = await staffDB.rawQueryAll(
        `SELECT 
          s.status,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
        FROM staff s
        ${whereClause}
        GROUP BY s.status
        ORDER BY count DESC`,
        params
      );

      // Get performance distribution
      const performanceDistribution = await staffDB.rawQueryAll(
        `SELECT 
          CASE 
            WHEN performance_rating >= 4.5 THEN 'Excellent (4.5-5.0)'
            WHEN performance_rating >= 3.5 THEN 'Good (3.5-4.4)'
            WHEN performance_rating >= 2.5 THEN 'Average (2.5-3.4)'
            WHEN performance_rating >= 1.5 THEN 'Below Average (1.5-2.4)'
            ELSE 'Poor (0-1.4)'
          END as range,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
        FROM staff s
        ${whereClause}
        GROUP BY 
          CASE 
            WHEN performance_rating >= 4.5 THEN 'Excellent (4.5-5.0)'
            WHEN performance_rating >= 3.5 THEN 'Good (3.5-4.4)'
            WHEN performance_rating >= 2.5 THEN 'Average (2.5-3.4)'
            WHEN performance_rating >= 1.5 THEN 'Below Average (1.5-2.4)'
            ELSE 'Poor (0-1.4)'
          END
        ORDER BY count DESC`,
        params
      );

      // Get salary distribution
      const salaryDistribution = await staffDB.rawQueryAll(
        `SELECT 
          CASE 
            WHEN base_salary_cents >= 1000000 THEN 'High (100k+)'
            WHEN base_salary_cents >= 500000 THEN 'Medium (50k-99k)'
            WHEN base_salary_cents >= 250000 THEN 'Low (25k-49k)'
            ELSE 'Very Low (<25k)'
          END as range,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
        FROM staff s
        ${whereClause}
        GROUP BY 
          CASE 
            WHEN base_salary_cents >= 1000000 THEN 'High (100k+)'
            WHEN base_salary_cents >= 500000 THEN 'Medium (50k-99k)'
            WHEN base_salary_cents >= 250000 THEN 'Low (25k-49k)'
            ELSE 'Very Low (<25k)'
          END
        ORDER BY count DESC`,
        params
      );

      // Get attendance tracking statistics
      const attendanceTracking = await staffDB.rawQueryRow(
        `SELECT 
          COUNT(CASE WHEN attendance_tracking_enabled = true THEN 1 END) as enabled,
          COUNT(CASE WHEN attendance_tracking_enabled = false THEN 1 END) as disabled,
          ROUND(COUNT(CASE WHEN attendance_tracking_enabled = true THEN 1 END) * 100.0 / COUNT(*), 2) as percentage
        FROM staff s
        ${whereClause}`,
        params
      );

      // Get leave balance statistics
      const leaveBalance = await staffDB.rawQueryRow(
        `SELECT 
          AVG(leave_balance) as average,
          SUM(leave_balance) as total
        FROM staff s
        ${whereClause}`,
        params
      );

      const leaveBalanceDistribution = await staffDB.rawQueryAll(
        `SELECT 
          CASE 
            WHEN leave_balance >= 30 THEN 'High (30+)'
            WHEN leave_balance >= 20 THEN 'Medium (20-29)'
            WHEN leave_balance >= 10 THEN 'Low (10-19)'
            ELSE 'Very Low (<10)'
          END as range,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
        FROM staff s
        ${whereClause}
        GROUP BY 
          CASE 
            WHEN leave_balance >= 30 THEN 'High (30+)'
            WHEN leave_balance >= 20 THEN 'Medium (20-29)'
            WHEN leave_balance >= 10 THEN 'Low (10-19)'
            ELSE 'Very Low (<10)'
          END
        ORDER BY count DESC`,
        params
      );

      // Get recent hires
      const recentHires = await staffDB.rawQueryAll(
        `SELECT 
          s.id, u.display_name as user_name, s.department, s.hire_date, s.performance_rating
        FROM staff s
        JOIN users u ON s.user_id = u.id
        ${whereClause}
        ORDER BY s.hire_date DESC
        LIMIT 10`,
        params
      );

      // Get top performers
      const topPerformers = await staffDB.rawQueryAll(
        `SELECT 
          s.id, u.display_name as user_name, s.department, s.performance_rating, p.name as property_name
        FROM staff s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN properties p ON s.property_id = p.id
        ${whereClause}
        ORDER BY s.performance_rating DESC
        LIMIT 10`,
        params
      );

      return {
        overview: {
          totalStaff: parseInt(overview?.total_staff || '0') || 0,
          activeStaff: parseInt(overview?.active_staff || '0') || 0,
          inactiveStaff: parseInt(overview?.inactive_staff || '0') || 0,
          averagePerformance: parseFloat(overview?.avg_performance || '0') || 0,
          averageSalary: parseInt(overview?.avg_salary || '0') || 0,
        },
        byDepartment: byDepartment.map(dept => ({
          department: dept.department,
          count: parseInt(dept.count) || 0,
          averagePerformance: parseFloat(dept.avg_performance) || 0,
          averageSalary: parseInt(dept.avg_salary) || 0,
          activeCount: parseInt(dept.active_count) || 0,
        })),
        byProperty: byProperty.map(prop => ({
          propertyId: prop.property_id,
          propertyName: prop.property_name || 'Unassigned',
          count: parseInt(prop.count) || 0,
          averagePerformance: parseFloat(prop.avg_performance) || 0,
          averageSalary: parseInt(prop.avg_salary) || 0,
        })),
        byStatus: byStatus.map(status => ({
          status: status.status,
          count: parseInt(status.count) || 0,
          percentage: parseFloat(status.percentage) || 0,
        })),
        performanceDistribution: performanceDistribution.map(perf => ({
          range: perf.range,
          count: parseInt(perf.count) || 0,
          percentage: parseFloat(perf.percentage) || 0,
        })),
        salaryDistribution: salaryDistribution.map(sal => ({
          range: sal.range,
          count: parseInt(sal.count) || 0,
          percentage: parseFloat(sal.percentage) || 0,
        })),
        attendanceTracking: {
          enabled: parseInt(attendanceTracking?.enabled || '0') || 0,
          disabled: parseInt(attendanceTracking?.disabled || '0') || 0,
          percentage: parseFloat(attendanceTracking?.percentage || '0') || 0,
        },
        leaveBalance: {
          average: parseFloat(leaveBalance?.average || '0') || 0,
          total: parseInt(leaveBalance?.total || '0') || 0,
          distribution: leaveBalanceDistribution.map(leave => ({
            range: leave.range,
            count: parseInt(leave.count) || 0,
            percentage: parseFloat(leave.percentage) || 0,
          })),
        },
        recentHires: recentHires.map(hire => ({
          id: hire.id,
          userName: hire.user_name,
          department: hire.department,
          hireDate: hire.hire_date,
          performanceRating: parseFloat(hire.performance_rating) || 0,
        })),
        topPerformers: topPerformers.map(performer => ({
          id: performer.id,
          userName: performer.user_name,
          department: performer.department,
          performanceRating: parseFloat(performer.performance_rating) || 0,
          propertyName: performer.property_name,
        })),
      };
    } catch (error) {
      console.error('Get staff statistics error:', error);
      throw APIError.internal("Failed to get staff statistics");
    }
}

// LEGACY: Gets comprehensive staff statistics and analytics (keep for backward compatibility)
export const getStatistics = api<StaffStatisticsRequest, StaffStatisticsResponse>(
  { auth: true, expose: true, method: "GET", path: "/staff/statistics" },
  getStatisticsHandler
);

// V1: Gets comprehensive staff statistics and analytics
export const getStatisticsV1 = api<StaffStatisticsRequest, StaffStatisticsResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/staff/statistics" },
  getStatisticsHandler
);
