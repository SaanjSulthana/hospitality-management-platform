import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface ValidateScheduleRequest {
  staffId: number;
  scheduleDate: Date;
  startTime: Date;
  endTime: Date;
}

export interface ValidateScheduleResponse {
  isValid: boolean;
  canCreateSchedule: boolean;
  warnings: string[];
  errors: string[];
  conflicts?: {
    scheduleId: number;
    startTime: Date;
    endTime: Date;
    status: string;
  }[];
  workingHours?: {
    totalHours: number;
    isOvertime: boolean;
    maxHours: number;
  };
}

// Shared handler for validating schedule creation and providing guidance
async function validateScheduleHandler(req: ValidateScheduleRequest): Promise<ValidateScheduleResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN", "MANAGER")(authData);

    const { staffId, scheduleDate, startTime, endTime } = req;
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Validate time range
      if (endTime <= startTime) {
        errors.push("End time must be after start time");
      }

      // Get staff information
      const staff = await staffDB.queryRow`
        SELECT s.id, s.user_id, s.max_overtime_hours, s.status,
               u.display_name
        FROM staff s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ${staffId} AND s.org_id = ${authData.orgId}
      `;

      if (!staff) {
        errors.push("Staff record not found");
        return {
          isValid: false,
          canCreateSchedule: false,
          warnings,
          errors,
        };
      }

      // Check if staff is active
      if (staff.status !== 'active') {
        errors.push("Staff member is not active");
      }

      // Staff can only validate schedules for themselves
      if (authData.role === "MANAGER" && authData.userID) {
        if (parseInt(staff.user_id) !== parseInt(authData.userID)) {
          errors.push("You can only validate schedules for yourself");
        }
      }

      // Managers can only validate schedules for their assigned properties
      if (authData.role === "MANAGER") {
        const accessCheck = await staffDB.queryRow`
          SELECT 1 FROM staff s
          WHERE s.id = ${staffId} AND s.org_id = ${authData.orgId}
          AND (
            s.property_id IN (SELECT property_id FROM user_properties WHERE user_id = ${parseInt(authData.userID)})
            OR s.property_id IS NULL
          )
        `;

        if (!accessCheck) {
          errors.push("No access to validate schedules for this staff member");
        }
      }

      // Check for conflicting schedules
      const conflicts = await staffDB.queryAll`
        SELECT id, start_time, end_time, status
        FROM staff_schedules
        WHERE org_id = ${authData.orgId} AND staff_id = ${staffId}
        AND schedule_date = ${scheduleDate}
        AND status IN ('scheduled', 'in_progress')
        AND (
          (start_time < ${endTime} AND end_time > ${startTime})
        )
      `;

      if (conflicts.length > 0) {
        errors.push(`Found ${conflicts.length} conflicting schedule(s)`);
      }

      // Check for weekend schedules
      const dayOfWeek = scheduleDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        warnings.push("Schedule is on weekend");
      }

      // Check for holiday schedules (simplified check)
      const month = scheduleDate.getMonth() + 1;
      const day = scheduleDate.getDate();
      if ((month === 1 && day === 1) || (month === 12 && day === 25)) {
        warnings.push("Schedule is on holiday");
      }

      // Check for future dates
      if (scheduleDate < new Date()) {
        warnings.push("Schedule date is in the past");
      }

      // Calculate working hours
      const totalHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      const maxHours = 8; // Standard work day
      const isOvertime = totalHours > maxHours;

      if (isOvertime) {
        warnings.push(`Schedule exceeds standard work day (${totalHours.toFixed(1)} hours)`);
      }

      // Check against max overtime hours
      const maxOvertimeHours = parseFloat(staff.max_overtime_hours) || 0;
      if (maxOvertimeHours > 0 && totalHours > maxOvertimeHours) {
        errors.push(`Schedule hours (${totalHours.toFixed(1)}) exceed maximum allowed (${maxOvertimeHours})`);
      }

      // Check for consecutive long shifts
      const previousDay = new Date(scheduleDate);
      previousDay.setDate(previousDay.getDate() - 1);
      
      const previousSchedule = await staffDB.queryRow`
        SELECT end_time FROM staff_schedules
        WHERE org_id = ${authData.orgId} AND staff_id = ${staffId}
        AND schedule_date = ${previousDay}
        AND status IN ('scheduled', 'completed')
        ORDER BY end_time DESC
        LIMIT 1
      `;

      if (previousSchedule) {
        const previousEndTime = new Date(previousSchedule.end_time);
        const timeBetweenShifts = (startTime.getTime() - previousEndTime.getTime()) / (1000 * 60 * 60);
        
        if (timeBetweenShifts < 8) {
          warnings.push(`Less than 8 hours between shifts (${timeBetweenShifts.toFixed(1)} hours)`);
        }
      }

      // Check for too many hours in the week
      const weekStart = new Date(scheduleDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      
      const weekHours = await staffDB.queryRow`
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600), 0) as total_hours
        FROM staff_schedules
        WHERE org_id = ${authData.orgId} AND staff_id = ${staffId}
        AND schedule_date >= ${weekStart} AND schedule_date < ${weekStart} + INTERVAL '7 days'
        AND status IN ('scheduled', 'completed')
      `;

      const totalWeekHours = parseFloat(weekHours?.total_hours || '0') + totalHours;
      if (totalWeekHours > 40) {
        warnings.push(`Weekly hours will exceed 40 hours (${totalWeekHours.toFixed(1)} hours)`);
      }

      const isValid = errors.length === 0;
      const canCreateSchedule = isValid && conflicts.length === 0;

      return {
        isValid,
        canCreateSchedule,
        warnings,
        errors,
        conflicts: conflicts.map(conflict => ({
          scheduleId: conflict.id,
          startTime: conflict.start_time,
          endTime: conflict.end_time,
          status: conflict.status,
        })),
        workingHours: {
          totalHours,
          isOvertime,
          maxHours,
        },
      };
    } catch (error) {
      console.error('Validate schedule error:', error);
      throw APIError.internal("Failed to validate schedule");
    }
}

// LEGACY: Validates schedule creation and provides guidance (keep for backward compatibility)
export const validateSchedule = api<ValidateScheduleRequest, ValidateScheduleResponse>(
  { auth: true, expose: true, method: "POST", path: "/staff/schedules/validate" },
  validateScheduleHandler
);

// V1: Validates schedule creation and provides guidance
export const validateScheduleV1 = api<ValidateScheduleRequest, ValidateScheduleResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/staff/schedules/validate" },
  validateScheduleHandler
);
