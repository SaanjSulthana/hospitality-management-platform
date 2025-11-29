import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface ScheduleStatisticsRequest {
  propertyId?: number;
  startDate?: Date;
  endDate?: Date;
  groupBy?: 'day' | 'week' | 'month' | 'staff' | 'property';
}

export interface ScheduleStatisticsResponse {
  overview: {
    totalSchedules: number;
    scheduledCount: number;
    completedCount: number;
    cancelledCount: number;
    inProgressCount: number;
    recurringCount: number;
    completionRate: number;
    averageHoursPerSchedule: number;
  };
  byPeriod: {
    period: string;
    scheduledCount: number;
    completedCount: number;
    cancelledCount: number;
    completionRate: number;
    averageHours: number;
  }[];
  byStaff: {
    staffId: number;
    staffName: string;
    propertyName?: string;
    scheduledCount: number;
    completedCount: number;
    cancelledCount: number;
    completionRate: number;
    averageHours: number;
  }[];
  byProperty: {
    propertyId: number;
    propertyName: string;
    scheduledCount: number;
    completedCount: number;
    cancelledCount: number;
    completionRate: number;
    averageHours: number;
  }[];
  trends: {
    date: Date;
    scheduledCount: number;
    completedCount: number;
    cancelledCount: number;
    completionRate: number;
  }[];
  topPerformers: {
    staffId: number;
    staffName: string;
    propertyName?: string;
    completionRate: number;
    totalSchedules: number;
    averageHours: number;
  }[];
  schedulePatterns: {
    shiftType: string;
    scheduledCount: number;
    completedCount: number;
    averageHours: number;
    completionRate: number;
  }[];
  changeRequestStats: {
    totalRequests: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    approvalRate: number;
    urgentCount: number;
  };
}

// Shared handler for getting comprehensive schedule statistics and analytics
async function getScheduleStatisticsHandler(req: ScheduleStatisticsRequest): Promise<ScheduleStatisticsResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN", "MANAGER")(authData);

    const { propertyId, startDate, endDate, groupBy = 'day' } = req || {};

    try {
      // Build base WHERE clause
      let whereClause = `WHERE ss.org_id = ${authData.orgId}`;
      const params: any[] = [authData.orgId];
      let paramIndex = 2;

      // Managers can only see statistics for their assigned properties
      if (authData.role === "MANAGER") {
        whereClause += ` AND (
          ss.property_id IN (SELECT property_id FROM user_properties WHERE user_id = $${paramIndex})
          OR ss.property_id IS NULL
        )`;
        params.push(parseInt(authData.userID));
        paramIndex++;
      }

      if (propertyId) {
        whereClause += ` AND ss.property_id = $${paramIndex}`;
        params.push(propertyId);
        paramIndex++;
      }

      if (startDate) {
        whereClause += ` AND ss.schedule_date >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereClause += ` AND ss.schedule_date <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      // Get overview statistics
      const overview = await staffDB.rawQueryRow(
        `SELECT 
          COUNT(*) as total_schedules,
          COUNT(CASE WHEN ss.status = 'scheduled' THEN 1 END) as scheduled_count,
          COUNT(CASE WHEN ss.status = 'completed' THEN 1 END) as completed_count,
          COUNT(CASE WHEN ss.status = 'cancelled' THEN 1 END) as cancelled_count,
          COUNT(CASE WHEN ss.status = 'in_progress' THEN 1 END) as in_progress_count,
          COUNT(CASE WHEN ss.is_recurring = true THEN 1 END) as recurring_count,
          ROUND(
            COUNT(CASE WHEN ss.status = 'completed' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
          ) as completion_rate,
          COALESCE(AVG(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 3600), 0) as avg_hours
        FROM staff_schedules ss
        JOIN staff s ON ss.staff_id = s.id
        ${whereClause}`,
        params
      );

      // Get statistics by period
      let periodQuery = '';
      switch (groupBy) {
        case 'day':
          periodQuery = `ss.schedule_date`;
          break;
        case 'week':
          periodQuery = `DATE_TRUNC('week', ss.schedule_date)`;
          break;
        case 'month':
          periodQuery = `DATE_TRUNC('month', ss.schedule_date)`;
          break;
        default:
          periodQuery = `ss.schedule_date`;
      }

      const byPeriod = await staffDB.rawQueryAll(
        `SELECT 
          ${periodQuery} as period,
          COUNT(CASE WHEN ss.status = 'scheduled' THEN 1 END) as scheduled_count,
          COUNT(CASE WHEN ss.status = 'completed' THEN 1 END) as completed_count,
          COUNT(CASE WHEN ss.status = 'cancelled' THEN 1 END) as cancelled_count,
          ROUND(
            COUNT(CASE WHEN ss.status = 'completed' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
          ) as completion_rate,
          COALESCE(AVG(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 3600), 0) as avg_hours
        FROM staff_schedules ss
        JOIN staff s ON ss.staff_id = s.id
        ${whereClause}
        GROUP BY ${periodQuery}
        ORDER BY period DESC`,
        params
      );

      // Get statistics by staff
      const byStaff = await staffDB.rawQueryAll(
        `SELECT 
          ss.staff_id,
          u.display_name as staff_name,
          p.name as property_name,
          COUNT(CASE WHEN ss.status = 'scheduled' THEN 1 END) as scheduled_count,
          COUNT(CASE WHEN ss.status = 'completed' THEN 1 END) as completed_count,
          COUNT(CASE WHEN ss.status = 'cancelled' THEN 1 END) as cancelled_count,
          ROUND(
            COUNT(CASE WHEN ss.status = 'completed' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
          ) as completion_rate,
          COALESCE(AVG(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 3600), 0) as avg_hours
        FROM staff_schedules ss
        JOIN staff s ON ss.staff_id = s.id
        JOIN users u ON s.user_id = u.id
        LEFT JOIN properties p ON ss.property_id = p.id
        ${whereClause}
        GROUP BY ss.staff_id, u.display_name, p.name
        ORDER BY completion_rate DESC, COUNT(*) DESC`,
        params
      );

      // Get statistics by property
      const byProperty = await staffDB.rawQueryAll(
        `SELECT 
          ss.property_id,
          p.name as property_name,
          COUNT(CASE WHEN ss.status = 'scheduled' THEN 1 END) as scheduled_count,
          COUNT(CASE WHEN ss.status = 'completed' THEN 1 END) as completed_count,
          COUNT(CASE WHEN ss.status = 'cancelled' THEN 1 END) as cancelled_count,
          ROUND(
            COUNT(CASE WHEN ss.status = 'completed' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
          ) as completion_rate,
          COALESCE(AVG(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 3600), 0) as avg_hours
        FROM staff_schedules ss
        JOIN staff s ON ss.staff_id = s.id
        LEFT JOIN properties p ON ss.property_id = p.id
        ${whereClause}
        GROUP BY ss.property_id, p.name
        ORDER BY completion_rate DESC, COUNT(*) DESC`,
        params
      );

      // Get trends (last 30 days)
      const trends = await staffDB.rawQueryAll(
        `SELECT 
          ss.schedule_date as date,
          COUNT(CASE WHEN ss.status = 'scheduled' THEN 1 END) as scheduled_count,
          COUNT(CASE WHEN ss.status = 'completed' THEN 1 END) as completed_count,
          COUNT(CASE WHEN ss.status = 'cancelled' THEN 1 END) as cancelled_count,
          ROUND(
            COUNT(CASE WHEN ss.status = 'completed' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
          ) as completion_rate
        FROM staff_schedules ss
        JOIN staff s ON ss.staff_id = s.id
        ${whereClause}
        AND ss.schedule_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY ss.schedule_date
        ORDER BY ss.schedule_date DESC`,
        params
      );

      // Get top performers
      const topPerformers = await staffDB.rawQueryAll(
        `SELECT 
          ss.staff_id,
          u.display_name as staff_name,
          p.name as property_name,
          ROUND(
            COUNT(CASE WHEN ss.status = 'completed' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
          ) as completion_rate,
          COUNT(*) as total_schedules,
          COALESCE(AVG(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 3600), 0) as avg_hours
        FROM staff_schedules ss
        JOIN staff s ON ss.staff_id = s.id
        JOIN users u ON s.user_id = u.id
        LEFT JOIN properties p ON ss.property_id = p.id
        ${whereClause}
        GROUP BY ss.staff_id, u.display_name, p.name
        HAVING COUNT(*) >= 5  -- At least 5 schedules
        ORDER BY completion_rate DESC, COUNT(*) DESC
        LIMIT 10`,
        params
      );

      // Get schedule patterns by shift type
      const schedulePatterns = await staffDB.rawQueryAll(
        `SELECT 
          ss.shift_type,
          COUNT(CASE WHEN ss.status = 'scheduled' THEN 1 END) as scheduled_count,
          COUNT(CASE WHEN ss.status = 'completed' THEN 1 END) as completed_count,
          COALESCE(AVG(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 3600), 0) as avg_hours,
          ROUND(
            COUNT(CASE WHEN ss.status = 'completed' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
          ) as completion_rate
        FROM staff_schedules ss
        JOIN staff s ON ss.staff_id = s.id
        ${whereClause}
        GROUP BY ss.shift_type
        ORDER BY COUNT(*) DESC`,
        params
      );

      // Get change request statistics
      const changeRequestStats = await staffDB.rawQueryRow(
        `SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN scr.status = 'pending' THEN 1 END) as pending_count,
          COUNT(CASE WHEN scr.status = 'approved' THEN 1 END) as approved_count,
          COUNT(CASE WHEN scr.status = 'rejected' THEN 1 END) as rejected_count,
          ROUND(
            COUNT(CASE WHEN scr.status = 'approved' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
          ) as approval_rate,
          COUNT(CASE WHEN scr.priority = 'urgent' THEN 1 END) as urgent_count
        FROM schedule_change_requests scr
        JOIN staff s ON scr.staff_id = s.id
        WHERE scr.org_id = $1`,
        [authData.orgId]
      );

      return {
        overview: {
          totalSchedules: parseInt(overview?.total_schedules || '0') || 0,
          scheduledCount: parseInt(overview?.scheduled_count || '0') || 0,
          completedCount: parseInt(overview?.completed_count || '0') || 0,
          cancelledCount: parseInt(overview?.cancelled_count || '0') || 0,
          inProgressCount: parseInt(overview?.in_progress_count || '0') || 0,
          recurringCount: parseInt(overview?.recurring_count || '0') || 0,
          completionRate: parseFloat(overview?.completion_rate || '0') || 0,
          averageHoursPerSchedule: parseFloat(overview?.avg_hours || '0') || 0,
        },
        byPeriod: byPeriod.map(period => ({
          period: period.period.toISOString().split('T')[0],
          scheduledCount: parseInt(period.scheduled_count) || 0,
          completedCount: parseInt(period.completed_count) || 0,
          cancelledCount: parseInt(period.cancelled_count) || 0,
          completionRate: parseFloat(period.completion_rate) || 0,
          averageHours: parseFloat(period.avg_hours) || 0,
        })),
        byStaff: byStaff.map(staff => ({
          staffId: staff.staff_id,
          staffName: staff.staff_name,
          propertyName: staff.property_name,
          scheduledCount: parseInt(staff.scheduled_count) || 0,
          completedCount: parseInt(staff.completed_count) || 0,
          cancelledCount: parseInt(staff.cancelled_count) || 0,
          completionRate: parseFloat(staff.completion_rate) || 0,
          averageHours: parseFloat(staff.avg_hours) || 0,
        })),
        byProperty: byProperty.map(property => ({
          propertyId: property.property_id,
          propertyName: property.property_name || 'Unassigned',
          scheduledCount: parseInt(property.scheduled_count) || 0,
          completedCount: parseInt(property.completed_count) || 0,
          cancelledCount: parseInt(property.cancelled_count) || 0,
          completionRate: parseFloat(property.completion_rate) || 0,
          averageHours: parseFloat(property.avg_hours) || 0,
        })),
        trends: trends.map(trend => ({
          date: trend.date,
          scheduledCount: parseInt(trend.scheduled_count) || 0,
          completedCount: parseInt(trend.completed_count) || 0,
          cancelledCount: parseInt(trend.cancelled_count) || 0,
          completionRate: parseFloat(trend.completion_rate) || 0,
        })),
        topPerformers: topPerformers.map(performer => ({
          staffId: performer.staff_id,
          staffName: performer.staff_name,
          propertyName: performer.property_name,
          completionRate: parseFloat(performer.completion_rate) || 0,
          totalSchedules: parseInt(performer.total_schedules) || 0,
          averageHours: parseFloat(performer.avg_hours) || 0,
        })),
        schedulePatterns: schedulePatterns.map(pattern => ({
          shiftType: pattern.shift_type,
          scheduledCount: parseInt(pattern.scheduled_count) || 0,
          completedCount: parseInt(pattern.completed_count) || 0,
          averageHours: parseFloat(pattern.avg_hours) || 0,
          completionRate: parseFloat(pattern.completion_rate) || 0,
        })),
        changeRequestStats: {
          totalRequests: parseInt(changeRequestStats?.total_requests || '0') || 0,
          pendingCount: parseInt(changeRequestStats?.pending_count || '0') || 0,
          approvedCount: parseInt(changeRequestStats?.approved_count || '0') || 0,
          rejectedCount: parseInt(changeRequestStats?.rejected_count || '0') || 0,
          approvalRate: parseFloat(changeRequestStats?.approval_rate || '0') || 0,
          urgentCount: parseInt(changeRequestStats?.urgent_count || '0') || 0,
        },
      };
    } catch (error) {
      console.error('Get schedule statistics error:', error);
      throw APIError.internal("Failed to get schedule statistics");
    }
}

// LEGACY: Gets comprehensive schedule statistics and analytics (keep for backward compatibility)
export const getScheduleStatistics = api<ScheduleStatisticsRequest, ScheduleStatisticsResponse>(
  { auth: true, expose: true, method: "GET", path: "/staff/schedules/statistics" },
  getScheduleStatisticsHandler
);

// V1: Gets comprehensive schedule statistics and analytics
export const getScheduleStatisticsV1 = api<ScheduleStatisticsRequest, ScheduleStatisticsResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/staff/schedules/statistics" },
  getScheduleStatisticsHandler
);
