import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface ListLeaveRequestsRequest {
  staffId?: number;
  propertyId?: number;
  leaveType?: 'annual' | 'sick' | 'emergency' | 'personal';
  status?: 'pending' | 'approved' | 'rejected';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  isEmergency?: boolean;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'requested_at' | 'start_date' | 'staff' | 'status' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

export interface LeaveRequestInfo {
  id: number;
  staffId: number;
  staffName: string;
  staffEmail: string;
  propertyId?: number;
  propertyName?: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: string;
  isEmergency: boolean;
  priorityLevel: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  supportingDocuments?: string;
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

export interface ListLeaveRequestsResponse {
  leaveRequests: LeaveRequestInfo[];
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
    emergencyCount: number;
    urgentCount: number;
  };
}

// Shared handler for listing leave requests
async function listLeaveRequestsHandler(req: ListLeaveRequestsRequest): Promise<ListLeaveRequestsResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { 
      staffId, 
      propertyId, 
      leaveType, 
      status, 
      priority,
      isEmergency,
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
      // First, let's check if the table exists and what columns it has
      console.log('=== DEBUG: Checking leave_requests table structure ===');
      const tableCheck = await staffDB.rawQueryRow(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'leave_requests' 
        ORDER BY ordinal_position
      `);
      console.log('Table structure:', tableCheck);

      // Build base query with only the columns that definitely exist
      let baseQuery = `
        SELECT 
          lr.id, lr.staff_id, lr.leave_type, lr.start_date, lr.end_date,
          lr.reason, lr.status, lr.approved_by_user_id, lr.approved_at, lr.created_at,
          u.display_name as staff_name, u.email as staff_email,
          s.property_id,
          p.name as property_name,
          approver.display_name as approved_by_name
        FROM leave_requests lr
        JOIN staff s ON lr.staff_id = s.id AND s.org_id = $1
        JOIN users u ON s.user_id = u.id AND u.org_id = $1
        LEFT JOIN properties p ON s.property_id = p.id AND p.org_id = $1
        LEFT JOIN users approver ON lr.approved_by_user_id = approver.id AND approver.org_id = $1
        WHERE lr.org_id = $1
      `;
      const params: any[] = [authData.orgId];
      let paramIndex = 2;

      // Staff can only see their own leave requests
      if (authData.role === "MANAGER" && authData.userID) {
        baseQuery += ` AND lr.staff_id = $${paramIndex}`;
        params.push(parseInt(authData.userID));
        paramIndex++;
      }

      // Managers can only see leave requests for their assigned properties
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
        baseQuery += ` AND lr.staff_id = $${paramIndex}`;
        params.push(staffId);
        paramIndex++;
      }

      if (propertyId) {
        baseQuery += ` AND s.property_id = $${paramIndex}`;
        params.push(propertyId);
        paramIndex++;
      }

      if (leaveType) {
        baseQuery += ` AND lr.leave_type = $${paramIndex}`;
        params.push(leaveType);
        paramIndex++;
      }

      if (status) {
        baseQuery += ` AND lr.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (priority) {
        baseQuery += ` AND lr.priority_level = $${paramIndex}`;
        params.push(priority);
        paramIndex++;
      }

      if (isEmergency !== undefined) {
        baseQuery += ` AND lr.is_emergency = $${paramIndex}`;
        params.push(isEmergency);
        paramIndex++;
      }

      if (startDate) {
        baseQuery += ` AND lr.start_date >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        baseQuery += ` AND lr.end_date <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      // Apply search filter
      if (search) {
        baseQuery += ` AND (
          u.display_name ILIKE $${paramIndex} OR 
          u.email ILIKE $${paramIndex} OR 
          lr.reason ILIKE $${paramIndex} OR
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
        'requested_at': 'lr.created_at',
        'start_date': 'lr.start_date',
        'staff': 'u.display_name',
        'status': 'lr.status',
        'priority': 'lr.created_at'
      }[sortBy] || 'lr.created_at';

      const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
      baseQuery += ` ORDER BY ${sortField} ${orderDirection}`;

      // Apply pagination
      baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limitNum, offset);

      const leaveRequests = await staffDB.rawQueryAll(baseQuery, ...params);

      // Get summary statistics (using only basic columns that exist)
      let summaryQuery = `
        SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN lr.status = 'pending' THEN 1 END) as pending_count,
          COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_count,
          COUNT(CASE WHEN lr.status = 'rejected' THEN 1 END) as rejected_count,
          0 as emergency_count,
          0 as urgent_count
        FROM leave_requests lr
        JOIN staff s ON lr.staff_id = s.id AND s.org_id = $1
        WHERE lr.org_id = $1
      `;
      
      const summaryParams: any[] = [authData.orgId];
      let summaryParamIndex = 2;

      // Apply same filters for summary
      if (authData.role === "MANAGER" && authData.userID) {
        summaryQuery += ` AND lr.staff_id = $${summaryParamIndex}`;
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
        summaryQuery += ` AND lr.staff_id = $${summaryParamIndex}`;
        summaryParams.push(staffId);
        summaryParamIndex++;
      }

      if (propertyId) {
        summaryQuery += ` AND s.property_id = $${summaryParamIndex}`;
        summaryParams.push(propertyId);
        summaryParamIndex++;
      }

      if (leaveType) {
        summaryQuery += ` AND lr.leave_type = $${summaryParamIndex}`;
        summaryParams.push(leaveType);
        summaryParamIndex++;
      }

      if (status) {
        summaryQuery += ` AND lr.status = $${summaryParamIndex}`;
        summaryParams.push(status);
        summaryParamIndex++;
      }

      if (priority) {
        summaryQuery += ` AND lr.priority_level = $${summaryParamIndex}`;
        summaryParams.push(priority);
        summaryParamIndex++;
      }

      if (isEmergency !== undefined) {
        summaryQuery += ` AND lr.is_emergency = $${summaryParamIndex}`;
        summaryParams.push(isEmergency);
        summaryParamIndex++;
      }

      if (startDate) {
        summaryQuery += ` AND lr.start_date >= $${summaryParamIndex}`;
        summaryParams.push(startDate);
        summaryParamIndex++;
      }

      if (endDate) {
        summaryQuery += ` AND lr.end_date <= $${summaryParamIndex}`;
        summaryParams.push(endDate);
        summaryParamIndex++;
      }

      const summary = await staffDB.rawQueryRow(summaryQuery, ...summaryParams);

      return {
        leaveRequests: leaveRequests.map((request) => ({
          id: request.id,
          staffId: request.staff_id,
          staffName: request.staff_name,
          staffEmail: request.staff_email,
          propertyId: request.property_id,
          propertyName: request.property_name,
          leaveType: request.leave_type,
          startDate: request.start_date,
          endDate: request.end_date,
          reason: request.reason,
          status: request.status,
          isEmergency: request.is_emergency || false,
          priorityLevel: request.priority_level || 'normal',
          emergencyContact: request.emergency_contact || null,
          emergencyPhone: request.emergency_phone || null,
          supportingDocuments: request.supporting_documents || null,
          requestedAt: request.requested_at || request.created_at,
          requestedByUserId: request.requested_by_user_id || request.staff_id,
          requestedByName: request.requested_by_name || request.staff_name,
          approvedByUserId: request.approved_by_user_id,
          approvedByName: request.approved_by_name,
          approvedAt: request.approved_at,
          approvalNotes: request.approval_notes || null,
          createdAt: request.created_at,
          updatedAt: request.updated_at || request.created_at,
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
          emergencyCount: parseInt(summary?.emergency_count || '0') || 0,
          urgentCount: parseInt(summary?.urgent_count || '0') || 0,
        },
      };
    } catch (error) {
      console.error('List leave requests error:', error);
      throw APIError.internal("Failed to fetch leave requests");
    }
}

// LEGACY: Lists leave requests (keep for backward compatibility)
export const listLeaveRequests = api<ListLeaveRequestsRequest, ListLeaveRequestsResponse>(
  { auth: true, expose: true, method: "GET", path: "/staff/leave-requests" },
  listLeaveRequestsHandler
);

// V1: Lists leave requests
export const listLeaveRequestsV1 = api<ListLeaveRequestsRequest, ListLeaveRequestsResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/staff/leave-requests" },
  listLeaveRequestsHandler
);