import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface ApproveLeaveRequest {
  leaveRequestId: number;
  action: 'approve' | 'reject';
  approvalNotes?: string;
}

export interface LeaveRequestApproval {
  id: number;
  staffId: number;
  staffName: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: string;
  isEmergency: boolean;
  priorityLevel: string;
  approvedByUserId: number;
  approvedAt: Date;
  approvalNotes?: string;
  updatedAt: Date;
}

export interface ApproveLeaveRequestResponse {
  success: boolean;
  leaveRequest: LeaveRequestApproval;
  message: string;
}

// Shared handler for approving leave request
async function approveLeaveRequestHandler(req: ApproveLeaveRequest): Promise<ApproveLeaveRequestResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { leaveRequestId, action, approvalNotes } = req;

    const tx = await staffDB.begin();
    try {
      // Get existing leave request
      const existingRequest = await tx.queryRow`
        SELECT lr.id, lr.staff_id, lr.leave_type, lr.start_date, lr.end_date,
               lr.reason, lr.status, lr.is_emergency, lr.priority_level,
               lr.requested_at, u.display_name as staff_name
        FROM leave_requests lr
        JOIN staff s ON lr.staff_id = s.id
        JOIN users u ON s.user_id = u.id
        WHERE lr.id = ${leaveRequestId} AND lr.org_id = ${authData.orgId}
      `;

      if (!existingRequest) {
        throw APIError.notFound("Leave request not found");
      }

      // Check if request is still pending
      if (existingRequest.status !== 'pending') {
        throw APIError.invalidArgument("Leave request is no longer pending");
      }

      // Managers can only approve leave requests for their assigned properties
      if (authData.role === "MANAGER") {
        const accessCheck = await tx.queryRow`
          SELECT 1 FROM leave_requests lr
          JOIN staff s ON lr.staff_id = s.id
          WHERE lr.id = ${leaveRequestId} AND lr.org_id = ${authData.orgId}
          AND (
            s.property_id IN (SELECT property_id FROM user_properties WHERE user_id = ${parseInt(authData.userID)})
            OR s.property_id IS NULL
          )
        `;

        if (!accessCheck) {
          throw APIError.permissionDenied("No access to approve this leave request");
        }
      }

      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const approvedAt = new Date();

      // Update leave request
      const updatedRequest = await tx.queryRow`
        UPDATE leave_requests 
        SET 
          status = ${newStatus},
          approved_by_user_id = ${parseInt(authData.userID)},
          approved_at = ${approvedAt},
          approval_notes = ${approvalNotes || null},
          updated_at = NOW()
        WHERE id = ${leaveRequestId} AND org_id = ${authData.orgId}
        RETURNING id, staff_id, leave_type, start_date, end_date,
                  reason, status, is_emergency, priority_level,
                  approved_by_user_id, approved_at, approval_notes, updated_at
      `;

      if (!updatedRequest) {
        throw APIError.notFound("Leave request not found or could not be updated");
      }

      // If approved, update leave balance
      if (action === 'approve') {
        const leaveDays = Math.ceil((updatedRequest.end_date.getTime() - updatedRequest.start_date.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        // Check if staff has sufficient leave balance
        const staffBalance = await tx.queryRow`
          SELECT leave_balance FROM staff
          WHERE id = ${updatedRequest.staff_id} AND org_id = ${authData.orgId}
        `;

        if (!staffBalance) {
          throw APIError.notFound("Staff record not found");
        }

        const currentBalance = staffBalance.leave_balance;
        if (currentBalance < leaveDays) {
          throw APIError.invalidArgument(`Insufficient leave balance. Current: ${currentBalance} days, Requested: ${leaveDays} days`);
        }

        // Update leave balance
        await tx.query`
          UPDATE staff 
          SET 
            leave_balance = leave_balance - ${leaveDays},
            updated_at = NOW()
          WHERE id = ${updatedRequest.staff_id} AND org_id = ${authData.orgId}
        `;
      }

      await tx.commit();

      return {
        success: true,
        leaveRequest: {
          id: updatedRequest.id,
          staffId: updatedRequest.staff_id,
          staffName: existingRequest.staff_name,
          leaveType: updatedRequest.leave_type,
          startDate: updatedRequest.start_date,
          endDate: updatedRequest.end_date,
          reason: updatedRequest.reason,
          status: updatedRequest.status,
          isEmergency: updatedRequest.is_emergency,
          priorityLevel: updatedRequest.priority_level,
          approvedByUserId: updatedRequest.approved_by_user_id,
          approvedAt: updatedRequest.approved_at,
          approvalNotes: updatedRequest.approval_notes,
          updatedAt: updatedRequest.updated_at,
        },
        message: `Leave request ${action}d successfully`,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Approve leave request error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to approve leave request");
    }
}

// LEGACY: Approves leave request (keep for backward compatibility)
export const approveLeaveRequest = api<ApproveLeaveRequest, ApproveLeaveRequestResponse>(
  { auth: true, expose: true, method: "PUT", path: "/staff/leave-requests/:leaveRequestId/approve" },
  approveLeaveRequestHandler
);

// V1: Approves leave request
export const approveLeaveRequestV1 = api<ApproveLeaveRequest, ApproveLeaveRequestResponse>(
  { auth: true, expose: true, method: "PUT", path: "/v1/staff/leave-requests/:leaveRequestId/approve" },
  approveLeaveRequestHandler
);
