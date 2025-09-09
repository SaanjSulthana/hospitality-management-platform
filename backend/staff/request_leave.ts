import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface RequestLeaveRequest {
  leaveType: 'vacation' | 'sick' | 'personal' | 'emergency';
  startDate: Date;
  endDate: Date;
  reason?: string;
}

export interface RequestLeaveResponse {
  id: number;
  staffId: number;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
  status: string;
  createdAt: Date;
}

// Creates a leave request for the current user
export const requestLeave = api<RequestLeaveRequest, RequestLeaveResponse>(
  { auth: true, expose: true, method: "POST", path: "/staff/leave-requests" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { leaveType, startDate, endDate, reason } = req;

    // Validate dates
    if (new Date(startDate) > new Date(endDate)) {
      throw APIError.invalidArgument("Start date must be before or equal to end date");
    }

    if (new Date(startDate) < new Date()) {
      throw APIError.invalidArgument("Cannot request leave for past dates");
    }

    // Find staff record for current user
    const staffRow = await staffDB.queryRow`
      SELECT id FROM staff 
      WHERE user_id = ${parseInt(authData.userID)} AND org_id = ${authData.orgId} AND status = 'active'
      LIMIT 1
    `;

    if (!staffRow) {
      throw APIError.notFound("Staff record not found. You must be assigned as staff to request leave.");
    }

    // Check for overlapping leave requests
    const overlappingLeave = await staffDB.queryRow`
      SELECT id FROM leave_requests 
      WHERE staff_id = ${staffRow.id} AND status IN ('pending', 'approved')
      AND (
        (start_date <= ${startDate} AND end_date >= ${startDate})
        OR (start_date <= ${endDate} AND end_date >= ${endDate})
        OR (start_date >= ${startDate} AND end_date <= ${endDate})
      )
    `;

    if (overlappingLeave) {
      throw APIError.alreadyExists("You already have a leave request that overlaps with these dates");
    }

    // Create leave request
    const leaveRequestRow = await staffDB.queryRow`
      INSERT INTO leave_requests (org_id, staff_id, leave_type, start_date, end_date, reason, status)
      VALUES (${authData.orgId}, ${staffRow.id}, ${leaveType}, ${startDate}, ${endDate}, ${reason || null}, 'pending')
      RETURNING id, staff_id, leave_type, start_date, end_date, reason, status, created_at
    `;

    if (!leaveRequestRow) {
      throw new Error('Failed to create leave request');
    }

    // Notify admins about the leave request
    const admins = await staffDB.queryAll`
      SELECT id FROM users WHERE org_id = ${authData.orgId} AND role = 'ADMIN'
    `;

    for (const admin of admins) {
      await staffDB.exec`
        INSERT INTO notifications (org_id, user_id, type, payload_json)
        VALUES (
          ${authData.orgId},
          ${admin.id},
          'leave_request',
          ${JSON.stringify({
            leave_request_id: leaveRequestRow.id,
            staff_name: authData.displayName,
            leave_type: leaveType,
            start_date: startDate,
            end_date: endDate,
            reason: reason || null,
            message: `${authData.displayName} has requested ${leaveType} leave from ${startDate} to ${endDate}`
          })}
        )
      `;
    }

    return {
      id: leaveRequestRow.id,
      staffId: leaveRequestRow.staff_id,
      leaveType: leaveRequestRow.leave_type,
      startDate: leaveRequestRow.start_date,
      endDate: leaveRequestRow.end_date,
      reason: leaveRequestRow.reason,
      status: leaveRequestRow.status,
      createdAt: leaveRequestRow.created_at,
    };
  }
);

