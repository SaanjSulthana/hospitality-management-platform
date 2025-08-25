import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { staffDB } from "./db";
import { requireRole } from "../auth/middleware";

export interface ApproveLeaveRequest {
  id: number;
  approved: boolean;
}

export interface ApproveLeaveResponse {
  success: boolean;
  leaveRequestId: number;
  status: string;
}

// Approves or rejects a leave request
export const approveLeave = api<ApproveLeaveRequest, ApproveLeaveResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/staff/leave-requests/:id/approve" },
  async (req) => {
    const authData = getAuthData()!;
    requireRole("ADMIN", "MANAGER")(authData);

    const { id, approved } = req;

    // Get leave request and check access
    const leaveRequestRow = await staffDB.queryRow`
      SELECT lr.id, lr.org_id, lr.staff_id, lr.status, lr.start_date, lr.end_date, lr.leave_type,
             s.user_id as staff_user_id, u.display_name as staff_name
      FROM leave_requests lr
      JOIN staff s ON lr.staff_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE lr.id = ${id} AND lr.org_id = ${authData.orgId}
    `;

    if (!leaveRequestRow) {
      throw APIError.notFound("Leave request not found");
    }

    if (leaveRequestRow.status !== 'pending') {
      throw APIError.failedPrecondition(`Cannot approve leave request with status: ${leaveRequestRow.status}`);
    }

    // Managers can only approve leave for staff they manage
    if (authData.role === "MANAGER") {
      const accessCheck = await staffDB.queryRow`
        SELECT 1 FROM staff s
        JOIN user_properties up ON s.property_id = up.property_id
        WHERE s.id = ${leaveRequestRow.staff_id} AND up.user_id = ${parseInt(authData.userID)}
      `;
      if (!accessCheck) {
        throw APIError.permissionDenied("No access to approve this leave request");
      }
    }

    const newStatus = approved ? 'approved' : 'rejected';

    // Update leave request status
    await staffDB.exec`
      UPDATE leave_requests 
      SET status = ${newStatus}, approved_by_user_id = ${parseInt(authData.userID)}, approved_at = NOW()
      WHERE id = ${id}
    `;

    // Create notification for the staff member
    await staffDB.exec`
      INSERT INTO notifications (org_id, user_id, type, payload_json)
      VALUES (
        ${authData.orgId},
        ${leaveRequestRow.staff_user_id},
        'leave_${newStatus}',
        ${JSON.stringify({
          leave_request_id: id,
          status: newStatus,
          approved_by: authData.displayName,
          leave_type: leaveRequestRow.leave_type,
          start_date: leaveRequestRow.start_date,
          end_date: leaveRequestRow.end_date,
          message: `Your ${leaveRequestRow.leave_type} leave request has been ${newStatus}`
        })}
      )
    `;

    return {
      success: true,
      leaveRequestId: id,
      status: newStatus,
    };
  }
);
