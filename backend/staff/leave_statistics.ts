import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface LeaveStatisticsRequest {
  propertyId?: number;
  startDate?: Date;
  endDate?: Date;
  groupBy?: 'day' | 'week' | 'month' | 'staff' | 'property';
}

export interface LeaveStatisticsResponse {
  overview: {
    totalRequests: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    emergencyCount: number;
    urgentCount: number;
    approvalRate: number;
    averageLeaveDays: number;
  };
  byPeriod: {
    period: string;
    totalRequests: number;
    approvedCount: number;
    rejectedCount: number;
    emergencyCount: number;
    approvalRate: number;
    averageLeaveDays: number;
  }[];
  byStaff: {
    staffId: number;
    staffName: string;
    propertyName?: string;
    totalRequests: number;
    approvedCount: number;
    rejectedCount: number;
    totalLeaveDays: number;
    averageLeaveDays: number;
    approvalRate: number;
  }[];
  byProperty: {
    propertyId: number;
    propertyName: string;
    totalRequests: number;
    approvedCount: number;
    rejectedCount: number;
    totalLeaveDays: number;
    averageLeaveDays: number;
    approvalRate: number;
  }[];
  trends: {
    date: Date;
    totalRequests: number;
    approvedCount: number;
    rejectedCount: number;
    approvalRate: number;
  }[];
  leaveTypeAnalysis: {
    leaveType: string;
    totalRequests: number;
    approvedCount: number;
    rejectedCount: number;
    averageDays: number;
    approvalRate: number;
  }[];
  emergencyLeaveStats: {
    totalEmergencyRequests: number;
    approvedEmergencyRequests: number;
    rejectedEmergencyRequests: number;
    averageEmergencyDays: number;
    emergencyApprovalRate: number;
  };
  leaveBalanceStats: {
    totalStaff: number;
    averageBalance: number;
    minBalance: number;
    maxBalance: number;
    lowBalanceCount: number;
    highBalanceCount: number;
  };
}

// Shared handler for getting comprehensive leave statistics and analytics
async function getLeaveStatisticsHandler(req: LeaveStatisticsRequest): Promise<LeaveStatisticsResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN", "MANAGER")(authData);

    const { propertyId, startDate, endDate, groupBy = 'day' } = req || {};

    try {
      // Build base WHERE clause
      let whereClause = `WHERE lr.org_id = ${authData.orgId}`;
      const params: any[] = [authData.orgId];
      let paramIndex = 2;

      // Managers can only see statistics for their assigned properties
      if (authData.role === "MANAGER") {
        whereClause += ` AND (
          lr.property_id IN (SELECT property_id FROM user_properties WHERE user_id = $${paramIndex})
          OR lr.property_id IS NULL
        )`;
        params.push(parseInt(authData.userID));
        paramIndex++;
      }

      if (propertyId) {
        whereClause += ` AND lr.property_id = $${paramIndex}`;
        params.push(propertyId);
        paramIndex++;
      }

      if (startDate) {
        whereClause += ` AND lr.start_date >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereClause += ` AND lr.end_date <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      // Get overview statistics
      const overview = await staffDB.rawQueryRow(
        `SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN lr.status = 'pending' THEN 1 END) as pending_count,
          COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_count,
          COUNT(CASE WHEN lr.status = 'rejected' THEN 1 END) as rejected_count,
          COUNT(CASE WHEN lr.is_emergency = true THEN 1 END) as emergency_count,
          COUNT(CASE WHEN lr.priority_level = 'urgent' THEN 1 END) as urgent_count,
          ROUND(
            COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
          ) as approval_rate,
          COALESCE(AVG(EXTRACT(DAY FROM (lr.end_date - lr.start_date)) + 1), 0) as avg_leave_days
        FROM leave_requests lr
        JOIN staff s ON lr.staff_id = s.id
        ${whereClause}`,
        params
      );

      // Get statistics by period
      let periodQuery = '';
      switch (groupBy) {
        case 'day':
          periodQuery = `lr.start_date`;
          break;
        case 'week':
          periodQuery = `DATE_TRUNC('week', lr.start_date)`;
          break;
        case 'month':
          periodQuery = `DATE_TRUNC('month', lr.start_date)`;
          break;
        default:
          periodQuery = `lr.start_date`;
      }

      const byPeriod = await staffDB.rawQueryAll(
        `SELECT 
          ${periodQuery} as period,
          COUNT(*) as total_requests,
          COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_count,
          COUNT(CASE WHEN lr.status = 'rejected' THEN 1 END) as rejected_count,
          COUNT(CASE WHEN lr.is_emergency = true THEN 1 END) as emergency_count,
          ROUND(
            COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
          ) as approval_rate,
          COALESCE(AVG(EXTRACT(DAY FROM (lr.end_date - lr.start_date)) + 1), 0) as avg_leave_days
        FROM leave_requests lr
        JOIN staff s ON lr.staff_id = s.id
        ${whereClause}
        GROUP BY ${periodQuery}
        ORDER BY period DESC`,
        params
      );

      // Get statistics by staff
      const byStaff = await staffDB.rawQueryAll(
        `SELECT 
          lr.staff_id,
          u.display_name as staff_name,
          p.name as property_name,
          COUNT(*) as total_requests,
          COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_count,
          COUNT(CASE WHEN lr.status = 'rejected' THEN 1 END) as rejected_count,
          COALESCE(SUM(EXTRACT(DAY FROM (lr.end_date - lr.start_date)) + 1), 0) as total_leave_days,
          COALESCE(AVG(EXTRACT(DAY FROM (lr.end_date - lr.start_date)) + 1), 0) as avg_leave_days,
          ROUND(
            COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
          ) as approval_rate
        FROM leave_requests lr
        JOIN staff s ON lr.staff_id = s.id
        JOIN users u ON s.user_id = u.id
        LEFT JOIN properties p ON lr.property_id = p.id
        ${whereClause}
        GROUP BY lr.staff_id, u.display_name, p.name
        ORDER BY total_requests DESC, approval_rate DESC`,
        params
      );

      // Get statistics by property
      const byProperty = await staffDB.rawQueryAll(
        `SELECT 
          lr.property_id,
          p.name as property_name,
          COUNT(*) as total_requests,
          COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_count,
          COUNT(CASE WHEN lr.status = 'rejected' THEN 1 END) as rejected_count,
          COALESCE(SUM(EXTRACT(DAY FROM (lr.end_date - lr.start_date)) + 1), 0) as total_leave_days,
          COALESCE(AVG(EXTRACT(DAY FROM (lr.end_date - lr.start_date)) + 1), 0) as avg_leave_days,
          ROUND(
            COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
          ) as approval_rate
        FROM leave_requests lr
        JOIN staff s ON lr.staff_id = s.id
        LEFT JOIN properties p ON lr.property_id = p.id
        ${whereClause}
        GROUP BY lr.property_id, p.name
        ORDER BY total_requests DESC, approval_rate DESC`,
        params
      );

      // Get trends (last 30 days)
      const trends = await staffDB.rawQueryAll(
        `SELECT 
          lr.start_date as date,
          COUNT(*) as total_requests,
          COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_count,
          COUNT(CASE WHEN lr.status = 'rejected' THEN 1 END) as rejected_count,
          ROUND(
            COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
          ) as approval_rate
        FROM leave_requests lr
        JOIN staff s ON lr.staff_id = s.id
        ${whereClause}
        AND lr.start_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY lr.start_date
        ORDER BY lr.start_date DESC`,
        params
      );

      // Get leave type analysis
      const leaveTypeAnalysis = await staffDB.rawQueryAll(
        `SELECT 
          lr.leave_type,
          COUNT(*) as total_requests,
          COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_count,
          COUNT(CASE WHEN lr.status = 'rejected' THEN 1 END) as rejected_count,
          COALESCE(AVG(EXTRACT(DAY FROM (lr.end_date - lr.start_date)) + 1), 0) as avg_days,
          ROUND(
            COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
          ) as approval_rate
        FROM leave_requests lr
        JOIN staff s ON lr.staff_id = s.id
        ${whereClause}
        GROUP BY lr.leave_type
        ORDER BY COUNT(*) DESC`,
        params
      );

      // Get emergency leave statistics
      const emergencyLeaveStats = await staffDB.rawQueryRow(
        `SELECT 
          COUNT(*) as total_emergency_requests,
          COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_emergency_requests,
          COUNT(CASE WHEN lr.status = 'rejected' THEN 1 END) as rejected_emergency_requests,
          COALESCE(AVG(EXTRACT(DAY FROM (lr.end_date - lr.start_date)) + 1), 0) as avg_emergency_days,
          ROUND(
            COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
          ) as emergency_approval_rate
        FROM leave_requests lr
        JOIN staff s ON lr.staff_id = s.id
        ${whereClause}
        AND lr.is_emergency = true`,
        params
      );

      // Get leave balance statistics
      const leaveBalanceStats = await staffDB.rawQueryRow(
        `SELECT 
          COUNT(*) as total_staff,
          COALESCE(AVG(s.leave_balance), 0) as avg_balance,
          COALESCE(MIN(s.leave_balance), 0) as min_balance,
          COALESCE(MAX(s.leave_balance), 0) as max_balance,
          COUNT(CASE WHEN s.leave_balance < 5 THEN 1 END) as low_balance_count,
          COUNT(CASE WHEN s.leave_balance > 20 THEN 1 END) as high_balance_count
        FROM staff s
        WHERE s.org_id = $1`,
        [authData.orgId]
      );

      return {
        overview: {
          totalRequests: parseInt(overview?.total_requests || '0') || 0,
          pendingCount: parseInt(overview?.pending_count || '0') || 0,
          approvedCount: parseInt(overview?.approved_count || '0') || 0,
          rejectedCount: parseInt(overview?.rejected_count || '0') || 0,
          emergencyCount: parseInt(overview?.emergency_count || '0') || 0,
          urgentCount: parseInt(overview?.urgent_count || '0') || 0,
          approvalRate: parseFloat(overview?.approval_rate || '0') || 0,
          averageLeaveDays: parseFloat(overview?.avg_leave_days || '0') || 0,
        },
        byPeriod: byPeriod.map(period => ({
          period: period.period.toISOString().split('T')[0],
          totalRequests: parseInt(period.total_requests) || 0,
          approvedCount: parseInt(period.approved_count) || 0,
          rejectedCount: parseInt(period.rejected_count) || 0,
          emergencyCount: parseInt(period.emergency_count) || 0,
          approvalRate: parseFloat(period.approval_rate) || 0,
          averageLeaveDays: parseFloat(period.avg_leave_days) || 0,
        })),
        byStaff: byStaff.map(staff => ({
          staffId: staff.staff_id,
          staffName: staff.staff_name,
          propertyName: staff.property_name,
          totalRequests: parseInt(staff.total_requests) || 0,
          approvedCount: parseInt(staff.approved_count) || 0,
          rejectedCount: parseInt(staff.rejected_count) || 0,
          totalLeaveDays: parseInt(staff.total_leave_days) || 0,
          averageLeaveDays: parseFloat(staff.avg_leave_days) || 0,
          approvalRate: parseFloat(staff.approval_rate) || 0,
        })),
        byProperty: byProperty.map(property => ({
          propertyId: property.property_id,
          propertyName: property.property_name || 'Unassigned',
          totalRequests: parseInt(property.total_requests) || 0,
          approvedCount: parseInt(property.approved_count) || 0,
          rejectedCount: parseInt(property.rejected_count) || 0,
          totalLeaveDays: parseInt(property.total_leave_days) || 0,
          averageLeaveDays: parseFloat(property.avg_leave_days) || 0,
          approvalRate: parseFloat(property.approval_rate) || 0,
        })),
        trends: trends.map(trend => ({
          date: trend.date,
          totalRequests: parseInt(trend.total_requests) || 0,
          approvedCount: parseInt(trend.approved_count) || 0,
          rejectedCount: parseInt(trend.rejected_count) || 0,
          approvalRate: parseFloat(trend.approval_rate) || 0,
        })),
        leaveTypeAnalysis: leaveTypeAnalysis.map(type => ({
          leaveType: type.leave_type,
          totalRequests: parseInt(type.total_requests) || 0,
          approvedCount: parseInt(type.approved_count) || 0,
          rejectedCount: parseInt(type.rejected_count) || 0,
          averageDays: parseFloat(type.avg_days) || 0,
          approvalRate: parseFloat(type.approval_rate) || 0,
        })),
        emergencyLeaveStats: {
          totalEmergencyRequests: parseInt(emergencyLeaveStats?.total_emergency_requests || '0') || 0,
          approvedEmergencyRequests: parseInt(emergencyLeaveStats?.approved_emergency_requests || '0') || 0,
          rejectedEmergencyRequests: parseInt(emergencyLeaveStats?.rejected_emergency_requests || '0') || 0,
          averageEmergencyDays: parseFloat(emergencyLeaveStats?.avg_emergency_days || '0') || 0,
          emergencyApprovalRate: parseFloat(emergencyLeaveStats?.emergency_approval_rate || '0') || 0,
        },
        leaveBalanceStats: {
          totalStaff: parseInt(leaveBalanceStats?.total_staff || '0') || 0,
          averageBalance: parseFloat(leaveBalanceStats?.avg_balance || '0') || 0,
          minBalance: parseInt(leaveBalanceStats?.min_balance || '0') || 0,
          maxBalance: parseInt(leaveBalanceStats?.max_balance || '0') || 0,
          lowBalanceCount: parseInt(leaveBalanceStats?.low_balance_count || '0') || 0,
          highBalanceCount: parseInt(leaveBalanceStats?.high_balance_count || '0') || 0,
        },
      };
    } catch (error) {
      console.error('Get leave statistics error:', error);
      throw APIError.internal("Failed to get leave statistics");
    }
}

// LEGACY: Gets comprehensive leave statistics and analytics (keep for backward compatibility)
export const getLeaveStatistics = api<LeaveStatisticsRequest, LeaveStatisticsResponse>(
  { auth: true, expose: true, method: "GET", path: "/staff/leave/statistics" },
  getLeaveStatisticsHandler
);

// V1: Gets comprehensive leave statistics and analytics
export const getLeaveStatisticsV1 = api<LeaveStatisticsRequest, LeaveStatisticsResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/staff/leave/statistics" },
  getLeaveStatisticsHandler
);
