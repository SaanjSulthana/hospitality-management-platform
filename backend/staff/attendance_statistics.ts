import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface AttendanceStatisticsRequest {
  staffId?: number;
  propertyId?: number;
  startDate?: Date;
  endDate?: Date;
  groupBy?: 'day' | 'week' | 'month' | 'staff' | 'property';
}

export interface AttendanceStatisticsResponse {
  overview: {
    totalRecords: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    halfDayCount: number;
    leaveCount: number;
    totalHours: number;
    totalOvertime: number;
    averageHours: number;
    attendanceRate: number;
  };
  byPeriod: {
    period: string;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    totalHours: number;
    averageHours: number;
    attendanceRate: number;
  }[];
  byStaff: {
    staffId: number;
    staffName: string;
    propertyName?: string;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    totalHours: number;
    averageHours: number;
    attendanceRate: number;
  }[];
  byProperty: {
    propertyId: number;
    propertyName: string;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    totalHours: number;
    averageHours: number;
    attendanceRate: number;
  }[];
  trends: {
    date: Date;
    presentCount: number;
    absentCount: number;
    totalHours: number;
    attendanceRate: number;
  }[];
  topPerformers: {
    staffId: number;
    staffName: string;
    propertyName?: string;
    attendanceRate: number;
    totalHours: number;
    averageHours: number;
  }[];
  attendancePatterns: {
    dayOfWeek: string;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    averageHours: number;
  }[];
}

// Gets comprehensive attendance statistics and analytics
export const getAttendanceStatistics = api<AttendanceStatisticsRequest, AttendanceStatisticsResponse>(
  { auth: true, expose: true, method: "GET", path: "/staff/attendance/statistics" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { staffId, propertyId, startDate, endDate, groupBy = 'day' } = req || {};

    try {
      // Build base WHERE clause
      let whereClause = `WHERE sa.org_id = ${authData.orgId}`;
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

      if (staffId) {
        whereClause += ` AND sa.staff_id = $${paramIndex}`;
        params.push(staffId);
        paramIndex++;
      }

      if (propertyId) {
        whereClause += ` AND s.property_id = $${paramIndex}`;
        params.push(propertyId);
        paramIndex++;
      }

      if (startDate) {
        whereClause += ` AND sa.attendance_date >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereClause += ` AND sa.attendance_date <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      // Get overview statistics
      const overview = await staffDB.rawQueryRow(
        `SELECT 
          COUNT(*) as total_records,
          COUNT(CASE WHEN sa.status = 'present' THEN 1 END) as present_count,
          COUNT(CASE WHEN sa.status = 'absent' THEN 1 END) as absent_count,
          COUNT(CASE WHEN sa.status = 'late' THEN 1 END) as late_count,
          COUNT(CASE WHEN sa.status = 'half_day' THEN 1 END) as half_day_count,
          COUNT(CASE WHEN sa.status = 'leave' THEN 1 END) as leave_count,
          COALESCE(SUM(sa.total_hours), 0) as total_hours,
          COALESCE(SUM(sa.overtime_hours), 0) as total_overtime,
          COALESCE(AVG(sa.total_hours), 0) as average_hours,
          ROUND(
            COUNT(CASE WHEN sa.status IN ('present', 'late', 'half_day') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
          ) as attendance_rate
        FROM staff_attendance sa
        JOIN staff s ON sa.staff_id = s.id
        ${whereClause}`,
        params
      );

      // Get statistics by period
      let periodQuery = '';
      switch (groupBy) {
        case 'day':
          periodQuery = `sa.attendance_date`;
          break;
        case 'week':
          periodQuery = `DATE_TRUNC('week', sa.attendance_date)`;
          break;
        case 'month':
          periodQuery = `DATE_TRUNC('month', sa.attendance_date)`;
          break;
        default:
          periodQuery = `sa.attendance_date`;
      }

      const byPeriod = await staffDB.rawQueryAll(
        `SELECT 
          ${periodQuery} as period,
          COUNT(CASE WHEN sa.status = 'present' THEN 1 END) as present_count,
          COUNT(CASE WHEN sa.status = 'absent' THEN 1 END) as absent_count,
          COUNT(CASE WHEN sa.status = 'late' THEN 1 END) as late_count,
          COALESCE(SUM(sa.total_hours), 0) as total_hours,
          COALESCE(AVG(sa.total_hours), 0) as average_hours,
          ROUND(
            COUNT(CASE WHEN sa.status IN ('present', 'late', 'half_day') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
          ) as attendance_rate
        FROM staff_attendance sa
        JOIN staff s ON sa.staff_id = s.id
        ${whereClause}
        GROUP BY ${periodQuery}
        ORDER BY period DESC`,
        params
      );

      // Get statistics by staff
      const byStaff = await staffDB.rawQueryAll(
        `SELECT 
          sa.staff_id,
          u.display_name as staff_name,
          p.name as property_name,
          COUNT(CASE WHEN sa.status = 'present' THEN 1 END) as present_count,
          COUNT(CASE WHEN sa.status = 'absent' THEN 1 END) as absent_count,
          COUNT(CASE WHEN sa.status = 'late' THEN 1 END) as late_count,
          COALESCE(SUM(sa.total_hours), 0) as total_hours,
          COALESCE(AVG(sa.total_hours), 0) as average_hours,
          ROUND(
            COUNT(CASE WHEN sa.status IN ('present', 'late', 'half_day') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
          ) as attendance_rate
        FROM staff_attendance sa
        JOIN staff s ON sa.staff_id = s.id
        JOIN users u ON s.user_id = u.id
        LEFT JOIN properties p ON s.property_id = p.id
        ${whereClause}
        GROUP BY sa.staff_id, u.display_name, p.name
        ORDER BY attendance_rate DESC, total_hours DESC`,
        params
      );

      // Get statistics by property
      const byProperty = await staffDB.rawQueryAll(
        `SELECT 
          s.property_id,
          p.name as property_name,
          COUNT(CASE WHEN sa.status = 'present' THEN 1 END) as present_count,
          COUNT(CASE WHEN sa.status = 'absent' THEN 1 END) as absent_count,
          COUNT(CASE WHEN sa.status = 'late' THEN 1 END) as late_count,
          COALESCE(SUM(sa.total_hours), 0) as total_hours,
          COALESCE(AVG(sa.total_hours), 0) as average_hours,
          ROUND(
            COUNT(CASE WHEN sa.status IN ('present', 'late', 'half_day') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
          ) as attendance_rate
        FROM staff_attendance sa
        JOIN staff s ON sa.staff_id = s.id
        LEFT JOIN properties p ON s.property_id = p.id
        ${whereClause}
        GROUP BY s.property_id, p.name
        ORDER BY attendance_rate DESC, total_hours DESC`,
        params
      );

      // Get trends (last 30 days)
      const trends = await staffDB.rawQueryAll(
        `SELECT 
          sa.attendance_date as date,
          COUNT(CASE WHEN sa.status = 'present' THEN 1 END) as present_count,
          COUNT(CASE WHEN sa.status = 'absent' THEN 1 END) as absent_count,
          COALESCE(SUM(sa.total_hours), 0) as total_hours,
          ROUND(
            COUNT(CASE WHEN sa.status IN ('present', 'late', 'half_day') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
          ) as attendance_rate
        FROM staff_attendance sa
        JOIN staff s ON sa.staff_id = s.id
        ${whereClause}
        AND sa.attendance_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY sa.attendance_date
        ORDER BY sa.attendance_date DESC`,
        params
      );

      // Get top performers
      const topPerformers = await staffDB.rawQueryAll(
        `SELECT 
          sa.staff_id,
          u.display_name as staff_name,
          p.name as property_name,
          ROUND(
            COUNT(CASE WHEN sa.status IN ('present', 'late', 'half_day') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
          ) as attendance_rate,
          COALESCE(SUM(sa.total_hours), 0) as total_hours,
          COALESCE(AVG(sa.total_hours), 0) as average_hours
        FROM staff_attendance sa
        JOIN staff s ON sa.staff_id = s.id
        JOIN users u ON s.user_id = u.id
        LEFT JOIN properties p ON s.property_id = p.id
        ${whereClause}
        GROUP BY sa.staff_id, u.display_name, p.name
        HAVING COUNT(*) >= 5  -- At least 5 attendance records
        ORDER BY attendance_rate DESC, total_hours DESC
        LIMIT 10`,
        params
      );

      // Get attendance patterns by day of week
      const attendancePatterns = await staffDB.rawQueryAll(
        `SELECT 
          TO_CHAR(sa.attendance_date, 'Day') as day_of_week,
          COUNT(CASE WHEN sa.status = 'present' THEN 1 END) as present_count,
          COUNT(CASE WHEN sa.status = 'absent' THEN 1 END) as absent_count,
          COUNT(CASE WHEN sa.status = 'late' THEN 1 END) as late_count,
          COALESCE(AVG(sa.total_hours), 0) as average_hours
        FROM staff_attendance sa
        JOIN staff s ON sa.staff_id = s.id
        ${whereClause}
        GROUP BY TO_CHAR(sa.attendance_date, 'Day')
        ORDER BY 
          CASE TO_CHAR(sa.attendance_date, 'Day')
            WHEN 'Monday   ' THEN 1
            WHEN 'Tuesday  ' THEN 2
            WHEN 'Wednesday' THEN 3
            WHEN 'Thursday ' THEN 4
            WHEN 'Friday   ' THEN 5
            WHEN 'Saturday ' THEN 6
            WHEN 'Sunday   ' THEN 7
          END`,
        params
      );

      return {
        overview: {
          totalRecords: parseInt(overview?.total_records || '0') || 0,
          presentCount: parseInt(overview?.present_count || '0') || 0,
          absentCount: parseInt(overview?.absent_count || '0') || 0,
          lateCount: parseInt(overview?.late_count || '0') || 0,
          halfDayCount: parseInt(overview?.half_day_count || '0') || 0,
          leaveCount: parseInt(overview?.leave_count || '0') || 0,
          totalHours: parseFloat(overview?.total_hours || '0') || 0,
          totalOvertime: parseFloat(overview?.total_overtime || '0') || 0,
          averageHours: parseFloat(overview?.average_hours || '0') || 0,
          attendanceRate: parseFloat(overview?.attendance_rate || '0') || 0,
        },
        byPeriod: byPeriod.map(period => ({
          period: period.period.toISOString().split('T')[0],
          presentCount: parseInt(period.present_count) || 0,
          absentCount: parseInt(period.absent_count) || 0,
          lateCount: parseInt(period.late_count) || 0,
          totalHours: parseFloat(period.total_hours) || 0,
          averageHours: parseFloat(period.average_hours) || 0,
          attendanceRate: parseFloat(period.attendance_rate) || 0,
        })),
        byStaff: byStaff.map(staff => ({
          staffId: staff.staff_id,
          staffName: staff.staff_name,
          propertyName: staff.property_name,
          presentCount: parseInt(staff.present_count) || 0,
          absentCount: parseInt(staff.absent_count) || 0,
          lateCount: parseInt(staff.late_count) || 0,
          totalHours: parseFloat(staff.total_hours) || 0,
          averageHours: parseFloat(staff.average_hours) || 0,
          attendanceRate: parseFloat(staff.attendance_rate) || 0,
        })),
        byProperty: byProperty.map(property => ({
          propertyId: property.property_id,
          propertyName: property.property_name || 'Unassigned',
          presentCount: parseInt(property.present_count) || 0,
          absentCount: parseInt(property.absent_count) || 0,
          lateCount: parseInt(property.late_count) || 0,
          totalHours: parseFloat(property.total_hours) || 0,
          averageHours: parseFloat(property.average_hours) || 0,
          attendanceRate: parseFloat(property.attendance_rate) || 0,
        })),
        trends: trends.map(trend => ({
          date: trend.date,
          presentCount: parseInt(trend.present_count) || 0,
          absentCount: parseInt(trend.absent_count) || 0,
          totalHours: parseFloat(trend.total_hours) || 0,
          attendanceRate: parseFloat(trend.attendance_rate) || 0,
        })),
        topPerformers: topPerformers.map(performer => ({
          staffId: performer.staff_id,
          staffName: performer.staff_name,
          propertyName: performer.property_name,
          attendanceRate: parseFloat(performer.attendance_rate) || 0,
          totalHours: parseFloat(performer.total_hours) || 0,
          averageHours: parseFloat(performer.average_hours) || 0,
        })),
        attendancePatterns: attendancePatterns.map(pattern => ({
          dayOfWeek: pattern.day_of_week.trim(),
          presentCount: parseInt(pattern.present_count) || 0,
          absentCount: parseInt(pattern.absent_count) || 0,
          lateCount: parseInt(pattern.late_count) || 0,
          averageHours: parseFloat(pattern.average_hours) || 0,
        })),
      };
    } catch (error) {
      console.error('Get attendance statistics error:', error);
      throw APIError.internal("Failed to get attendance statistics");
    }
  }
);
