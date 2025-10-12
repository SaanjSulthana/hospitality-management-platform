import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface ListAttendanceRequest {
  staffId?: number;
  propertyId?: number;
  status?: 'present' | 'absent' | 'late' | 'half_day' | 'leave';
  startDate?: Date;
  endDate?: Date;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'date' | 'staff' | 'status' | 'hours';
  sortOrder?: 'asc' | 'desc';
}

export interface AttendanceRecord {
  id: number;
  staffId: number;
  staffName: string;
  staffEmail: string;
  propertyId?: number;
  propertyName?: string;
  attendanceDate: Date;
  checkInTime?: Date;
  checkOutTime?: Date;
  totalHours: number;
  overtimeHours: number;
  status: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListAttendanceResponse {
  attendance: AttendanceRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    totalRecords: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    halfDayCount: number;
    leaveCount: number;
    totalHours: number;
    totalOvertime: number;
    averageHours: number;
  };
}

// Lists attendance records with filtering and pagination
export const listAttendance = api<ListAttendanceRequest, ListAttendanceResponse>(
  { auth: true, expose: true, method: "GET", path: "/staff/attendance" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { 
      staffId, 
      propertyId, 
      status, 
      startDate, 
      endDate, 
      search, 
      page = 1, 
      limit = 20, 
      sortBy = 'date', 
      sortOrder = 'desc' 
    } = req || {};

    // Validate pagination parameters
    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit));
    const offset = (pageNum - 1) * limitNum;

    try {
      // Build base query
      let baseQuery = `
        SELECT 
          sa.id, sa.staff_id, sa.attendance_date, sa.check_in_time, 
          sa.check_out_time, 
          COALESCE(CAST(sa.total_hours AS FLOAT), 0) as total_hours, 
          COALESCE(CAST(sa.overtime_hours AS FLOAT), 0) as overtime_hours, 
          sa.status, sa.notes, sa.created_at, sa.updated_at,
          u.display_name as staff_name, u.email as staff_email,
          s.property_id, p.name as property_name
        FROM staff_attendance sa
        JOIN staff s ON sa.staff_id = s.id AND s.org_id = $1
        JOIN users u ON s.user_id = u.id AND u.org_id = $1
        LEFT JOIN properties p ON s.property_id = p.id AND p.org_id = $1
        WHERE sa.org_id = $1
      `;
      const params: any[] = [authData.orgId];
      let paramIndex = 2;

      // Managers can only see attendance for their assigned properties
      if (authData.role === "MANAGER") {
        baseQuery += ` AND (
          s.property_id IN (SELECT property_id FROM user_properties WHERE user_id = $${paramIndex})
          OR s.property_id IS NULL
        )`;
        params.push(parseInt(authData.userID));
        paramIndex++;
      }

      // Apply filters
      if (staffId) {
        baseQuery += ` AND sa.staff_id = $${paramIndex}`;
        params.push(staffId);
        paramIndex++;
      }

      if (propertyId) {
        baseQuery += ` AND s.property_id = $${paramIndex}`;
        params.push(propertyId);
        paramIndex++;
      }

      if (status) {
        baseQuery += ` AND sa.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (startDate) {
        baseQuery += ` AND sa.attendance_date >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        baseQuery += ` AND sa.attendance_date <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      // Apply search filter
      if (search) {
        baseQuery += ` AND (
          u.display_name ILIKE $${paramIndex} OR 
          u.email ILIKE $${paramIndex} OR 
          sa.notes ILIKE $${paramIndex} OR
          p.name ILIKE $${paramIndex}
        )`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      // Get total count for pagination
      const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as count_query`;
      const countResult = await staffDB.rawQueryRow(countQuery, ...params);
      const total = parseInt(countResult?.total || '0') || 0;
      const totalPages = Math.ceil(total / limitNum);

      // Apply sorting
      const sortField = {
        'date': 'sa.attendance_date',
        'staff': 'u.display_name',
        'status': 'sa.status',
        'hours': 'sa.total_hours'
      }[sortBy] || 'sa.attendance_date';

      const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
      baseQuery += ` ORDER BY ${sortField} ${orderDirection}`;

      // Apply pagination
      baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limitNum, offset);

      const attendance = await staffDB.rawQueryAll(baseQuery, ...params);

      // Get summary statistics
      let summaryQuery = `
        SELECT 
          COUNT(*) as total_records,
          COUNT(CASE WHEN sa.status = 'present' THEN 1 END) as present_count,
          COUNT(CASE WHEN sa.status = 'absent' THEN 1 END) as absent_count,
          COUNT(CASE WHEN sa.status = 'late' THEN 1 END) as late_count,
          COUNT(CASE WHEN sa.status = 'half_day' THEN 1 END) as half_day_count,
          COUNT(CASE WHEN sa.status = 'leave' THEN 1 END) as leave_count,
          COALESCE(SUM(COALESCE(CAST(sa.total_hours AS FLOAT), 0)), 0) as total_hours,
          COALESCE(SUM(COALESCE(CAST(sa.overtime_hours AS FLOAT), 0)), 0) as total_overtime,
          COALESCE(AVG(COALESCE(CAST(sa.total_hours AS FLOAT), 0)), 0) as average_hours
        FROM staff_attendance sa
        JOIN staff s ON sa.staff_id = s.id AND s.org_id = $1
        WHERE sa.org_id = $1
      `;
      
      const summaryParams: any[] = [authData.orgId];
      let summaryParamIndex = 2;

      // Apply same filters for summary
      if (authData.role === "MANAGER") {
        summaryQuery += ` AND (
          s.property_id IN (SELECT property_id FROM user_properties WHERE user_id = $${summaryParamIndex})
          OR s.property_id IS NULL
        )`;
        summaryParams.push(parseInt(authData.userID));
        summaryParamIndex++;
      }

      if (staffId) {
        summaryQuery += ` AND sa.staff_id = $${summaryParamIndex}`;
        summaryParams.push(staffId);
        summaryParamIndex++;
      }

      if (propertyId) {
        summaryQuery += ` AND s.property_id = $${summaryParamIndex}`;
        summaryParams.push(propertyId);
        summaryParamIndex++;
      }

      if (status) {
        summaryQuery += ` AND sa.status = $${summaryParamIndex}`;
        summaryParams.push(status);
        summaryParamIndex++;
      }

      if (startDate) {
        summaryQuery += ` AND sa.attendance_date >= $${summaryParamIndex}`;
        summaryParams.push(startDate);
        summaryParamIndex++;
      }

      if (endDate) {
        summaryQuery += ` AND sa.attendance_date <= $${summaryParamIndex}`;
        summaryParams.push(endDate);
        summaryParamIndex++;
      }

      const summary = await staffDB.rawQueryRow(summaryQuery, ...summaryParams);

      return {
        attendance: attendance.map((record) => ({
          id: record.id,
          staffId: record.staff_id,
          staffName: record.staff_name,
          staffEmail: record.staff_email,
          propertyId: record.property_id,
          propertyName: record.property_name,
          attendanceDate: record.attendance_date,
          checkInTime: record.check_in_time ? new Date(record.check_in_time) : undefined,
          checkOutTime: record.check_out_time ? new Date(record.check_out_time) : undefined,
          totalHours: parseFloat(record.total_hours) || 0,
          overtimeHours: parseFloat(record.overtime_hours) || 0,
          status: record.status,
          notes: record.notes,
          createdAt: new Date(record.created_at),
          updatedAt: new Date(record.updated_at),
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
        },
        summary: {
          totalRecords: parseInt(summary?.total_records || '0') || 0,
          presentCount: parseInt(summary?.present_count || '0') || 0,
          absentCount: parseInt(summary?.absent_count || '0') || 0,
          lateCount: parseInt(summary?.late_count || '0') || 0,
          halfDayCount: parseInt(summary?.half_day_count || '0') || 0,
          leaveCount: parseInt(summary?.leave_count || '0') || 0,
          totalHours: parseFloat(summary?.total_hours || '0') || 0,
          totalOvertime: parseFloat(summary?.total_overtime || '0') || 0,
          averageHours: parseFloat(summary?.average_hours || '0') || 0,
        },
      };
    } catch (error) {
      console.error('List attendance error:', error);
      
      // Check if it's a column missing error
      if (error instanceof Error && error.message.includes('column') && error.message.includes('does not exist')) {
        console.error('Database schema issue detected:', error.message);
        throw APIError.internal("Database schema issue: Missing required columns. Please run schema fix.");
      }
      
      throw APIError.internal(`Failed to fetch attendance records: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);
