import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface CreateScheduleChangeRequest {
  staffId: number;
  originalScheduleId: number;
  requestedStartTime: Date;
  requestedEndTime: Date;
  reason: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface ScheduleChangeRequest {
  id: number;
  staffId: number;
  staffName: string;
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
  approvedByUserId?: number;
  approvedAt?: Date;
  approvalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateScheduleChangeRequestResponse {
  success: boolean;
  changeRequest: ScheduleChangeRequest;
  message: string;
}

// Creates a schedule change request
export const createScheduleChangeRequest = api<CreateScheduleChangeRequest, CreateScheduleChangeRequestResponse>(
  { auth: true, expose: true, method: "POST", path: "/staff/schedule-change-requests" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { 
      staffId, 
      originalScheduleId, 
      requestedStartTime, 
      requestedEndTime, 
      reason,
      priority = 'normal'
    } = req;

    // Validate requested times
    if (requestedEndTime <= requestedStartTime) {
      throw APIError.invalidArgument("Requested end time must be after start time");
    }

    const tx = await staffDB.begin();
    try {
      // Verify staff record exists and belongs to organization
      const staff = await tx.queryRow`
        SELECT s.id, s.user_id, u.display_name
        FROM staff s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ${staffId} AND s.org_id = ${authData.orgId}
      `;

      if (!staff) {
        throw APIError.notFound("Staff record not found");
      }

      // Staff can only create change requests for themselves
      if (authData.role === "MANAGER" && authData.userID) {
        if (parseInt(staff.user_id) !== parseInt(authData.userID)) {
          throw APIError.permissionDenied("You can only create change requests for yourself");
        }
      }

      // Managers can only create change requests for their assigned properties
      if (authData.role === "MANAGER") {
        const accessCheck = await tx.queryRow`
          SELECT 1 FROM staff s
          WHERE s.id = ${staffId} AND s.org_id = ${authData.orgId}
          AND (
            s.property_id IN (SELECT property_id FROM user_properties WHERE user_id = ${parseInt(authData.userID)})
            OR s.property_id IS NULL
          )
        `;

        if (!accessCheck) {
          throw APIError.permissionDenied("No access to create change requests for this staff member");
        }
      }

      // Verify original schedule exists and belongs to the staff member
      const originalSchedule = await tx.queryRow`
        SELECT id, staff_id, schedule_date, start_time, end_time, status
        FROM staff_schedules
        WHERE id = ${originalScheduleId} AND staff_id = ${staffId} AND org_id = ${authData.orgId}
      `;

      if (!originalSchedule) {
        throw APIError.notFound("Original schedule not found");
      }

      // Check if schedule is already completed or cancelled
      if (originalSchedule.status === 'completed' || originalSchedule.status === 'cancelled') {
        throw APIError.invalidArgument("Cannot create change request for completed or cancelled schedule");
      }

      // Check for existing pending change request for the same schedule
      const existingRequest = await tx.queryRow`
        SELECT id FROM schedule_change_requests
        WHERE org_id = ${authData.orgId} AND original_schedule_id = ${originalScheduleId}
        AND status = 'pending'
      `;

      if (existingRequest) {
        throw APIError.alreadyExists("Pending change request already exists for this schedule");
      }

      // Create schedule change request
      const changeRequest = await tx.queryRow`
        INSERT INTO schedule_change_requests (
          org_id, staff_id, original_schedule_id, requested_start_time,
          requested_end_time, reason, priority, status, requested_by_user_id,
          created_at, updated_at
        ) VALUES (
          ${authData.orgId}, ${staffId}, ${originalScheduleId}, ${requestedStartTime},
          ${requestedEndTime}, ${reason}, ${priority}, 'pending', ${parseInt(authData.userID)},
          NOW(), NOW()
        )
        RETURNING id, staff_id, original_schedule_id, requested_start_time,
                  requested_end_time, reason, priority, status, requested_at,
                  requested_by_user_id, approved_by_user_id, approved_at,
                  approval_notes, created_at, updated_at
      `;

      if (!changeRequest) {
        throw new Error("Failed to create schedule change request");
      }

      await tx.commit();

      return {
        success: true,
        changeRequest: {
          id: changeRequest.id,
          staffId: changeRequest.staff_id,
          staffName: staff.display_name,
          originalScheduleId: changeRequest.original_schedule_id,
          originalScheduleDate: originalSchedule.schedule_date,
          originalStartTime: originalSchedule.start_time,
          originalEndTime: originalSchedule.end_time,
          requestedStartTime: changeRequest.requested_start_time,
          requestedEndTime: changeRequest.requested_end_time,
          reason: changeRequest.reason,
          priority: changeRequest.priority,
          status: changeRequest.status,
          requestedAt: changeRequest.requested_at,
          requestedByUserId: changeRequest.requested_by_user_id,
          approvedByUserId: changeRequest.approved_by_user_id,
          approvedAt: changeRequest.approved_at,
          approvalNotes: changeRequest.approval_notes,
          createdAt: changeRequest.created_at,
          updatedAt: changeRequest.updated_at,
        },
        message: `Schedule change request created successfully`,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Create schedule change request error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to create schedule change request");
    }
  }
);
