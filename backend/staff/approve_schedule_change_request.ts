import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface ApproveScheduleChangeRequest {
  changeRequestId: number;
  action: 'approve' | 'reject';
  approvalNotes?: string;
}

export interface ScheduleChangeRequestApproval {
  id: number;
  staffId: number;
  staffName: string;
  originalScheduleId: number;
  requestedStartTime: Date;
  requestedEndTime: Date;
  reason: string;
  status: string;
  approvedByUserId: number;
  approvedAt: Date;
  approvalNotes?: string;
  updatedAt: Date;
}

export interface ApproveScheduleChangeRequestResponse {
  success: boolean;
  changeRequest: ScheduleChangeRequestApproval;
  message: string;
}

// Shared handler for approving schedule change request
async function approveScheduleChangeRequestHandler(req: ApproveScheduleChangeRequest): Promise<ApproveScheduleChangeRequestResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { changeRequestId, action, approvalNotes } = req;

    const tx = await staffDB.begin();
    try {
      // Get existing change request
      const existingRequest = await tx.queryRow`
        SELECT scr.id, scr.staff_id, scr.original_schedule_id, scr.requested_start_time,
               scr.requested_end_time, scr.reason, scr.status, scr.requested_at,
               u.display_name as staff_name
        FROM schedule_change_requests scr
        JOIN staff s ON scr.staff_id = s.id
        JOIN users u ON s.user_id = u.id
        WHERE scr.id = ${changeRequestId} AND scr.org_id = ${authData.orgId}
      `;

      if (!existingRequest) {
        throw APIError.notFound("Schedule change request not found");
      }

      // Check if request is still pending
      if (existingRequest.status !== 'pending') {
        throw APIError.invalidArgument("Change request is no longer pending");
      }

      // Managers can only approve requests for their assigned properties
      if (authData.role === "MANAGER") {
        const accessCheck = await tx.queryRow`
          SELECT 1 FROM schedule_change_requests scr
          JOIN staff s ON scr.staff_id = s.id
          WHERE scr.id = ${changeRequestId} AND scr.org_id = ${authData.orgId}
          AND (
            s.property_id IN (SELECT property_id FROM user_properties WHERE user_id = ${parseInt(authData.userID)})
            OR s.property_id IS NULL
          )
        `;

        if (!accessCheck) {
          throw APIError.permissionDenied("No access to approve this change request");
        }
      }

      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const approvedAt = new Date();

      // Update change request
      const updatedRequest = await tx.queryRow`
        UPDATE schedule_change_requests 
        SET 
          status = ${newStatus},
          approved_by_user_id = ${parseInt(authData.userID)},
          approved_at = ${approvedAt},
          approval_notes = ${approvalNotes || null},
          updated_at = NOW()
        WHERE id = ${changeRequestId} AND org_id = ${authData.orgId}
        RETURNING id, staff_id, original_schedule_id, requested_start_time,
                  requested_end_time, reason, status, approved_by_user_id,
                  approved_at, approval_notes, updated_at
      `;

      if (!updatedRequest) {
        throw APIError.notFound("Change request not found or could not be updated");
      }

      // If approved, update the original schedule
      if (action === 'approve') {
        await tx.query`
          UPDATE staff_schedules 
          SET 
            start_time = ${updatedRequest.requested_start_time},
            end_time = ${updatedRequest.requested_end_time},
            updated_at = NOW()
          WHERE id = ${updatedRequest.original_schedule_id} AND org_id = ${authData.orgId}
        `;
      }

      await tx.commit();

      return {
        success: true,
        changeRequest: {
          id: updatedRequest.id,
          staffId: updatedRequest.staff_id,
          staffName: existingRequest.staff_name,
          originalScheduleId: updatedRequest.original_schedule_id,
          requestedStartTime: updatedRequest.requested_start_time,
          requestedEndTime: updatedRequest.requested_end_time,
          reason: updatedRequest.reason,
          status: updatedRequest.status,
          approvedByUserId: updatedRequest.approved_by_user_id,
          approvedAt: updatedRequest.approved_at,
          approvalNotes: updatedRequest.approval_notes,
          updatedAt: updatedRequest.updated_at,
        },
        message: `Schedule change request ${action}d successfully`,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Approve schedule change request error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to approve schedule change request");
    }
}

// LEGACY: Approves schedule change request (keep for backward compatibility)
export const approveScheduleChangeRequest = api<ApproveScheduleChangeRequest, ApproveScheduleChangeRequestResponse>(
  { auth: true, expose: true, method: "PUT", path: "/staff/schedule-change-requests/:changeRequestId/approve" },
  approveScheduleChangeRequestHandler
);

// V1: Approves schedule change request
export const approveScheduleChangeRequestV1 = api<ApproveScheduleChangeRequest, ApproveScheduleChangeRequestResponse>(
  { auth: true, expose: true, method: "PUT", path: "/v1/staff/schedule-change-requests/:changeRequestId/approve" },
  approveScheduleChangeRequestHandler
);
