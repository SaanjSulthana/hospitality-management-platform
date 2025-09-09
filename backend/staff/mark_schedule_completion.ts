import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface MarkScheduleCompletionRequest {
  scheduleId: number;
  actualStartTime?: Date;
  actualEndTime?: Date;
  completionNotes?: string;
  status: 'completed' | 'cancelled' | 'in_progress';
}

export interface ScheduleCompletion {
  id: number;
  staffId: number;
  staffName: string;
  scheduleDate: Date;
  scheduledStartTime: Date;
  scheduledEndTime: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  status: string;
  completionNotes?: string;
  updatedAt: Date;
}

export interface MarkScheduleCompletionResponse {
  success: boolean;
  schedule: ScheduleCompletion;
  message: string;
}

// Marks schedule as completed with actual times
export const markScheduleCompletion = api<MarkScheduleCompletionRequest, MarkScheduleCompletionResponse>(
  { auth: true, expose: true, method: "PUT", path: "/staff/schedules/:scheduleId/completion" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { scheduleId, actualStartTime, actualEndTime, completionNotes, status } = req;

    const tx = await staffDB.begin();
    try {
      // Get existing schedule
      const existingSchedule = await tx.queryRow`
        SELECT ss.id, ss.staff_id, ss.schedule_date, ss.start_time, ss.end_time,
               ss.status, ss.notes, u.display_name as staff_name
        FROM staff_schedules ss
        JOIN staff s ON ss.staff_id = s.id
        JOIN users u ON s.user_id = u.id
        WHERE ss.id = ${scheduleId} AND ss.org_id = ${authData.orgId}
      `;

      if (!existingSchedule) {
        throw APIError.notFound("Schedule not found");
      }

      // Staff can only mark their own schedules
      if (authData.role === "MANAGER" && authData.userID) {
        const staffUser = await tx.queryRow`
          SELECT user_id FROM staff WHERE id = ${existingSchedule.staff_id} AND org_id = ${authData.orgId}
        `;
        
        if (!staffUser || parseInt(staffUser.user_id) !== parseInt(authData.userID)) {
          throw APIError.permissionDenied("You can only mark your own schedules as completed");
        }
      }

      // Managers can only mark schedules for their assigned properties
      if (authData.role === "MANAGER") {
        const accessCheck = await tx.queryRow`
          SELECT 1 FROM staff_schedules ss
          JOIN staff s ON ss.staff_id = s.id
          WHERE ss.id = ${scheduleId} AND ss.org_id = ${authData.orgId}
          AND (
            s.property_id IN (SELECT property_id FROM user_properties WHERE user_id = ${parseInt(authData.userID)})
            OR s.property_id IS NULL
          )
        `;

        if (!accessCheck) {
          throw APIError.permissionDenied("No access to mark this schedule as completed");
        }
      }

      // Validate status transition
      const currentStatus = existingSchedule.status;
      if (currentStatus === 'completed' && status !== 'completed') {
        throw APIError.invalidArgument("Cannot change status from completed");
      }

      if (currentStatus === 'cancelled' && status !== 'cancelled') {
        throw APIError.invalidArgument("Cannot change status from cancelled");
      }

      // Validate actual times if provided
      if (actualStartTime && actualEndTime && actualStartTime >= actualEndTime) {
        throw APIError.invalidArgument("Actual end time must be after start time");
      }

      // Update schedule
      const updatedSchedule = await tx.queryRow`
        UPDATE staff_schedules 
        SET 
          status = ${status},
          actual_start_time = ${actualStartTime || null},
          actual_end_time = ${actualEndTime || null},
          completion_notes = ${completionNotes || null},
          updated_at = NOW()
        WHERE id = ${scheduleId} AND org_id = ${authData.orgId}
        RETURNING id, staff_id, schedule_date, start_time, end_time,
                  actual_start_time, actual_end_time, status, completion_notes, updated_at
      `;

      if (!updatedSchedule) {
        throw APIError.notFound("Schedule not found or could not be updated");
      }

      await tx.commit();

      return {
        success: true,
        schedule: {
          id: updatedSchedule.id,
          staffId: updatedSchedule.staff_id,
          staffName: existingSchedule.staff_name,
          scheduleDate: updatedSchedule.schedule_date,
          scheduledStartTime: updatedSchedule.start_time,
          scheduledEndTime: updatedSchedule.end_time,
          actualStartTime: updatedSchedule.actual_start_time ? new Date(updatedSchedule.actual_start_time) : undefined,
          actualEndTime: updatedSchedule.actual_end_time ? new Date(updatedSchedule.actual_end_time) : undefined,
          status: updatedSchedule.status,
          completionNotes: updatedSchedule.completion_notes,
          updatedAt: updatedSchedule.updated_at,
        },
        message: `Schedule ${status} successfully`,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Mark schedule completion error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to mark schedule completion");
    }
  }
);
