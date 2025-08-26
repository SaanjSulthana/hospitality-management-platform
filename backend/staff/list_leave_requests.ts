import { api, Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { staffDB } from "./db";

export interface ListLeaveRequestsRequest {
  staffId?: Query&lt;number&gt;;
  status?: Query&lt;string&gt;;
  leaveType?: Query&lt;string&gt;;
}

export interface LeaveRequestInfo {
  id: number;
  staffId: number;
  staffName: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
  status: string;
  approvedByUserId?: number;
  approvedByName?: string;
  approvedAt?: Date;
  createdAt: Date;
}

export interface ListLeaveRequestsResponse {
  leaveRequests: LeaveRequestInfo[];
}

// Lists leave requests with filtering
export const listLeaveRequests = api&lt;ListLeaveRequestsRequest, ListLeaveRequestsResponse&gt;(
  { auth: true, expose: true, method: "GET", path: "/staff/leave-requests" },
  async (req) =&gt; {
    const authData = getAuthData()!;
    const { staffId, status, leaveType } = req || {};

    let query = `
      SELECT 
        lr.id, lr.staff_id, lr.leave_type, lr.start_date, lr.end_date, lr.reason,
        lr.status, lr.approved_by_user_id, lr.approved_at, lr.created_at,
        u.display_name as staff_name,
        au.display_name as approved_by_name
      FROM leave_requests lr
      JOIN staff s ON lr.staff_id = s.id
      JOIN users u ON s.user_id = u.id
      LEFT JOIN users au ON lr.approved_by_user_id = au.id
      WHERE lr.org_id = $1
    `;
    const params: any[] = [authData.orgId];
    let paramIndex = 2;

    // Managers can only see leave requests for staff they manage or their own requests
    if (authData.role === "MANAGER") {
      query += ` AND (
        s.property_id IN (SELECT property_id FROM user_properties WHERE user_id = $${paramIndex})
        OR s.user_id = $${paramIndex}
      )`;
      params.push(parseInt(authData.userID));
      paramIndex++;
    }

    // Apply filters
    if (staffId) {
      query += ` AND lr.staff_id = $${paramIndex}`;
      params.push(staffId);
      paramIndex++;
    }

    if (status) {
      query += ` AND lr.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (leaveType) {
      query += ` AND lr.leave_type = $${paramIndex}`;
      params.push(leaveType);
      paramIndex++;
    }

    query += ` ORDER BY lr.created_at DESC`;

    const leaveRequests = await staffDB.rawQueryAll(query, ...params);

    return {
      leaveRequests: leaveRequests.map((request) =&gt; ({
        id: request.id,
        staffId: request.staff_id,
        staffName: request.staff_name,
        leaveType: request.leave_type,
        startDate: request.start_date,
        endDate: request.end_date,
        reason: request.reason,
        status: request.status,
        approvedByUserId: request.approved_by_user_id,
        approvedByName: request.approved_by_name,
        approvedAt: request.approved_at,
        createdAt: request.created_at,
      })),
    };
  }
);
