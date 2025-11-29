import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface ListSchedulesRequest {
  staffId?: number;
  propertyId?: number;
  status?: 'scheduled' | 'completed' | 'cancelled' | 'in_progress';
  shiftType?: 'day_shift' | 'night_shift' | 'split_shift' | 'overtime';
  startDate?: Date;
  endDate?: Date;
  isRecurring?: boolean;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'date' | 'staff' | 'status' | 'start_time';
  sortOrder?: 'asc' | 'desc';
}

export interface ScheduleInfo {
  id: number;
  staffId: number;
  staffName: string;
  staffEmail: string;
  propertyId?: number;
  propertyName?: string;
  scheduleDate: Date;
  startTime: Date;
  endTime: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  shiftType: string;
  status: string;
  notes?: string;
  completionNotes?: string;
  isRecurring: boolean;
  recurringPattern?: string;
  recurringEndDate?: Date;
  priorityLevel: string;
  createdByUserId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListSchedulesResponse {
  schedules: ScheduleInfo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    totalSchedules: number;
    scheduledCount: number;
    completedCount: number;
    cancelledCount: number;
    inProgressCount: number;
    recurringCount: number;
  };
}

// Lists schedules with advanced filtering and pagination
// Shared handler for listing schedules
async function listSchedulesHandler(req: ListSchedulesRequest): Promise<ListSchedulesResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN", "MANAGER")(authData);

    const { 
      staffId, 
      propertyId, 
      status, 
      shiftType, 
      startDate, 
      endDate, 
      isRecurring,
      priority,
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
      // Build base query with only existing columns
      let baseQuery = `
        SELECT 
          ss.id, ss.staff_id, ss.property_id, ss.shift_date, ss.start_time, ss.end_time,
          ss.break_minutes, ss.status, ss.notes,
          u.display_name as staff_name, u.email as staff_email,
          p.name as property_name
        FROM staff_schedules ss
        JOIN staff s ON ss.staff_id = s.id AND s.org_id = $1
        JOIN users u ON s.user_id = u.id AND u.org_id = $1
        LEFT JOIN properties p ON ss.property_id = p.id AND p.org_id = $1
        WHERE ss.org_id = $1
      `;
      const params: any[] = [authData.orgId];
      let paramIndex = 2;

      // Staff can only see their own schedules
      if (authData.role === "MANAGER" && authData.userID) {
        baseQuery += ` AND ss.staff_id = $${paramIndex}`;
        params.push(parseInt(authData.userID));
        paramIndex++;
      }

      // Managers can only see schedules for their assigned properties
      if (authData.role === "MANAGER") {
        baseQuery += ` AND (
          ss.property_id IN (SELECT property_id FROM user_properties WHERE user_id = $${paramIndex})
          OR ss.property_id IS NULL
        )`;
        params.push(parseInt(authData.userID));
        paramIndex++;
      }

      // Apply filters
      if (staffId) {
        baseQuery += ` AND ss.staff_id = $${paramIndex}`;
        params.push(staffId);
        paramIndex++;
      }

      if (propertyId) {
        baseQuery += ` AND ss.property_id = $${paramIndex}`;
        params.push(propertyId);
        paramIndex++;
      }

      if (status) {
        baseQuery += ` AND ss.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (startDate) {
        baseQuery += ` AND ss.shift_date >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        baseQuery += ` AND ss.shift_date <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      // Apply search filter
      if (search) {
        baseQuery += ` AND (
          u.display_name ILIKE $${paramIndex} OR 
          u.email ILIKE $${paramIndex} OR 
          ss.notes ILIKE $${paramIndex} OR
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
        'date': 'ss.shift_date',
        'staff': 'u.display_name',
        'status': 'ss.status',
        'start_time': 'ss.start_time'
      }[sortBy] || 'ss.shift_date';

      const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
      baseQuery += ` ORDER BY ${sortField} ${orderDirection}`;

      // Apply pagination
      baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limitNum, offset);

      const schedules = await staffDB.rawQueryAll(baseQuery, ...params);

      // Get summary statistics
      let summaryQuery = `
        SELECT 
          COUNT(*) as total_schedules,
          COUNT(CASE WHEN ss.status = 'scheduled' THEN 1 END) as scheduled_count,
          COUNT(CASE WHEN ss.status = 'completed' THEN 1 END) as completed_count,
          COUNT(CASE WHEN ss.status = 'cancelled' THEN 1 END) as cancelled_count,
          COUNT(CASE WHEN ss.status = 'confirmed' THEN 1 END) as confirmed_count,
          0 as recurring_count
        FROM staff_schedules ss
        JOIN staff s ON ss.staff_id = s.id
        WHERE ss.org_id = $1
      `;
      
      const summaryParams: any[] = [authData.orgId];
      let summaryParamIndex = 2;

      // Apply same filters for summary
      if (authData.role === "MANAGER" && authData.userID) {
        summaryQuery += ` AND ss.staff_id = $${summaryParamIndex}`;
        summaryParams.push(parseInt(authData.userID));
        summaryParamIndex++;
      }

      if (authData.role === "MANAGER") {
        summaryQuery += ` AND (
          ss.property_id IN (SELECT property_id FROM user_properties WHERE user_id = $${summaryParamIndex})
          OR ss.property_id IS NULL
        )`;
        summaryParams.push(parseInt(authData.userID));
        summaryParamIndex++;
      }

      if (staffId) {
        summaryQuery += ` AND ss.staff_id = $${summaryParamIndex}`;
        summaryParams.push(staffId);
        summaryParamIndex++;
      }

      if (propertyId) {
        summaryQuery += ` AND ss.property_id = $${summaryParamIndex}`;
        summaryParams.push(propertyId);
        summaryParamIndex++;
      }

      if (status) {
        summaryQuery += ` AND ss.status = $${summaryParamIndex}`;
        summaryParams.push(status);
        summaryParamIndex++;
      }


      if (startDate) {
        summaryQuery += ` AND ss.shift_date >= $${summaryParamIndex}`;
        summaryParams.push(startDate);
        summaryParamIndex++;
      }

      if (endDate) {
        summaryQuery += ` AND ss.shift_date <= $${summaryParamIndex}`;
        summaryParams.push(endDate);
        summaryParamIndex++;
      }



      const summary = await staffDB.rawQueryRow(summaryQuery, ...summaryParams);

      return {
        schedules: schedules.map((schedule) => ({
          id: schedule.id,
          staffId: schedule.staff_id,
          staffName: schedule.staff_name,
          staffEmail: schedule.staff_email,
          propertyId: schedule.property_id,
          propertyName: schedule.property_name,
          scheduleDate: schedule.shift_date,
          startTime: schedule.start_time,
          endTime: schedule.end_time,
          actualStartTime: undefined,
          actualEndTime: undefined,
          shiftType: 'day_shift',
          status: schedule.status,
          notes: schedule.notes,
          completionNotes: undefined,
          isRecurring: false,
          recurringPattern: undefined,
          recurringEndDate: undefined,
          priorityLevel: 'normal',
          createdByUserId: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
        },
        summary: {
          totalSchedules: parseInt(summary?.total_schedules || '0') || 0,
          scheduledCount: parseInt(summary?.scheduled_count || '0') || 0,
          completedCount: parseInt(summary?.completed_count || '0') || 0,
          cancelledCount: parseInt(summary?.cancelled_count || '0') || 0,
          inProgressCount: parseInt(summary?.in_progress_count || '0') || 0,
          recurringCount: parseInt(summary?.recurring_count || '0') || 0,
        },
      };
    } catch (error) {
      console.error('List schedules error:', error);
      throw APIError.internal("Failed to fetch schedules");
    }
}

// LEGACY: Lists schedules (keep for backward compatibility)
export const listSchedules = api<ListSchedulesRequest, ListSchedulesResponse>(
  { auth: true, expose: true, method: "GET", path: "/staff/schedules" },
  listSchedulesHandler
);

// V1: Lists schedules
export const listSchedulesV1 = api<ListSchedulesRequest, ListSchedulesResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/staff/schedules" },
  listSchedulesHandler
);