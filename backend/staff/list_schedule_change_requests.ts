import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface ListScheduleChangeRequestsRequest {
  staffId?: number;
  propertyId?: number;
  status?: 'pending' | 'approved' | 'rejected';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  startDate?: Date;
  endDate?: Date;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'requested_at' | 'staff' | 'status' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

export interface ScheduleChangeRequestInfo {
  id: number;
  staffId: number;
  staffName: string;
  staffEmail: string;
  propertyId?: number;
  propertyName?: string;
  originalScheduleId: number;
  originalScheduleDate: Date;
  originalStartTime: Date;
  originalEndTime: Date;
  requestedStartTime: Date;
  requestedEndTime: Date;
  reason: string;
  priority: string;
  status: string;
  requestedAt: Date;
  requestedByUserId: number;
  requestedByName: string;
  approvedByUserId?: number;
  approvedByName?: string;
  approvedAt?: Date;
  approvalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListScheduleChangeRequestsResponse {
  changeRequests: ScheduleChangeRequestInfo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    totalRequests: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    urgentCount: number;
  };
}

// Lists schedule change requests with filtering and pagination
export const listScheduleChangeRequests = api<ListScheduleChangeRequestsRequest, ListScheduleChangeRequestsResponse>(
  { auth: true, expose: true, method: "GET", path: "/staff/schedule-change-requests" },
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
      priority,
      startDate, 
      endDate, 
      search, 
      page = 1, 
      limit = 20, 
      sortBy = 'requested_at', 
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
          scr.id, scr.staff_id, scr.original_schedule_id, scr.requested_start_time,
          scr.requested_end_time, scr.reason, scr.priority, scr.status, scr.requested_at,
          scr.requested_by_user_id, scr.approved_by_user_id, scr.approved_at,
          scr.approval_notes, scr.created_at, scr.updated_at,
          u.display_name as staff_name, u.email as staff_email,
          s.property_id, p.name as property_name,
          ss.schedule_date as original_schedule_date, ss.start_time as original_start_time,
          ss.end_time as original_end_time,
          requester.display_name as requested_by_name,
          approver.display_name as approved_by_name
        FROM schedule_change_requests scr
        JOIN staff s ON scr.staff_id = s.id AND s.org_id = $1
        JOIN users u ON s.user_id = u.id AND u.org_id = $1
        LEFT JOIN properties p ON s.property_id = p.id AND p.org_id = $1
        LEFT JOIN staff_schedules ss ON scr.original_schedule_id = ss.id AND ss.org_id = $1
        LEFT JOIN users requester ON scr.requested_by_user_id = requester.id AND requester.org_id = $1
        LEFT JOIN users approver ON scr.approved_by_user_id = approver.id AND approver.org_id = $1
        WHERE scr.org_id = $1
      `;
      const params: any[] = [authData.orgId];
      let paramIndex = 2;

      // Staff can only see their own change requests
      if (authData.role === "MANAGER" && authData.userID) {
        baseQuery += ` AND scr.staff_id = $${paramIndex}`;
        params.push(parseInt(authData.userID));
        paramIndex++;
      }

      // Managers can only see change requests for their assigned properties
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
        baseQuery += ` AND scr.staff_id = $${paramIndex}`;
        params.push(staffId);
        paramIndex++;
      }

      if (propertyId) {
        baseQuery += ` AND s.property_id = $${paramIndex}`;
        params.push(propertyId);
        paramIndex++;
      }

      if (status) {
        baseQuery += ` AND scr.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (priority) {
        baseQuery += ` AND scr.priority = $${paramIndex}`;
        params.push(priority);
        paramIndex++;
      }

      if (startDate) {
        baseQuery += ` AND scr.requested_at >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        baseQuery += ` AND scr.requested_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      // Apply search filter
      if (search) {
        baseQuery += ` AND (
          u.display_name ILIKE $${paramIndex} OR 
          u.email ILIKE $${paramIndex} OR 
          scr.reason ILIKE $${paramIndex} OR
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
        'requested_at': 'scr.requested_at',
        'staff': 'u.display_name',
        'status': 'scr.status',
        'priority': 'scr.priority'
      }[sortBy] || 'scr.requested_at';

      const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
      baseQuery += ` ORDER BY ${sortField} ${orderDirection}`;

      // Apply pagination
      baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limitNum, offset);

      const changeRequests = await staffDB.rawQueryAll(baseQuery, ...params);

      // Get summary statistics
      let summaryQuery = `
        SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
          COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_count
        FROM schedule_change_requests scr
        JOIN staff s ON scr.staff_id = s.id
        WHERE scr.org_id = $1
      `;
      
      const summaryParams: any[] = [authData.orgId];
      let summaryParamIndex = 2;

      // Apply same filters for summary
      if (authData.role === "MANAGER" && authData.userID) {
        summaryQuery += ` AND scr.staff_id = $${summaryParamIndex}`;
        summaryParams.push(parseInt(authData.userID));
        summaryParamIndex++;
      }

      if (authData.role === "MANAGER") {
        summaryQuery += ` AND (
          s.property_id IN (SELECT property_id FROM user_properties WHERE user_id = $${summaryParamIndex})
          OR s.property_id IS NULL
        )`;
        summaryParams.push(parseInt(authData.userID));
        summaryParamIndex++;
      }

      if (staffId) {
        summaryQuery += ` AND scr.staff_id = $${summaryParamIndex}`;
        summaryParams.push(staffId);
        summaryParamIndex++;
      }

      if (propertyId) {
        summaryQuery += ` AND s.property_id = $${summaryParamIndex}`;
        summaryParams.push(propertyId);
        summaryParamIndex++;
      }

      if (status) {
        summaryQuery += ` AND scr.status = $${summaryParamIndex}`;
        summaryParams.push(status);
        summaryParamIndex++;
      }

      if (priority) {
        summaryQuery += ` AND scr.priority = $${summaryParamIndex}`;
        summaryParams.push(priority);
        summaryParamIndex++;
      }

      if (startDate) {
        summaryQuery += ` AND scr.requested_at >= $${summaryParamIndex}`;
        summaryParams.push(startDate);
        summaryParamIndex++;
      }

      if (endDate) {
        summaryQuery += ` AND scr.requested_at <= $${summaryParamIndex}`;
        summaryParams.push(endDate);
        summaryParamIndex++;
      }

      const summary = await staffDB.rawQueryRow(summaryQuery, ...summaryParams);

      return {
        changeRequests: changeRequests.map((request) => ({
          id: request.id,
          staffId: request.staff_id,
          staffName: request.staff_name,
          staffEmail: request.staff_email,
          propertyId: request.property_id,
          propertyName: request.property_name,
          originalScheduleId: request.original_schedule_id,
          originalScheduleDate: request.original_schedule_date,
          originalStartTime: request.original_start_time,
          originalEndTime: request.original_end_time,
          requestedStartTime: request.requested_start_time,
          requestedEndTime: request.requested_end_time,
          reason: request.reason,
          priority: request.priority,
          status: request.status,
          requestedAt: request.requested_at,
          requestedByUserId: request.requested_by_user_id,
          requestedByName: request.requested_by_name,
          approvedByUserId: request.approved_by_user_id,
          approvedByName: request.approved_by_name,
          approvedAt: request.approved_at,
          approvalNotes: request.approval_notes,
          createdAt: request.created_at,
          updatedAt: request.updated_at,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
        },
        summary: {
          totalRequests: parseInt(summary?.total_requests || '0') || 0,
          pendingCount: parseInt(summary?.pending_count || '0') || 0,
          approvedCount: parseInt(summary?.approved_count || '0') || 0,
          rejectedCount: parseInt(summary?.rejected_count || '0') || 0,
          urgentCount: parseInt(summary?.urgent_count || '0') || 0,
        },
      };
    } catch (error) {
      console.error('List schedule change requests error:', error);
      throw APIError.internal("Failed to fetch schedule change requests");
    }
  }
);
