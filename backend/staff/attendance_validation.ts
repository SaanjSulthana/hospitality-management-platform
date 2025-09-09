import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface ValidateAttendanceRequest {
  staffId: number;
  attendanceDate: Date;
}

export interface ValidateAttendanceResponse {
  isValid: boolean;
  canCheckIn: boolean;
  canCheckOut: boolean;
  existingRecord?: {
    id: number;
    checkInTime?: Date;
    checkOutTime?: Date;
    status: string;
  };
  warnings: string[];
  errors: string[];
}

// Validates attendance operations and provides guidance
export const validateAttendance = api<ValidateAttendanceRequest, ValidateAttendanceResponse>(
  { auth: true, expose: true, method: "POST", path: "/staff/attendance/validate" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { staffId, attendanceDate } = req;
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Verify staff record exists and belongs to organization
      const staff = await staffDB.queryRow`
        SELECT s.id, s.user_id, s.attendance_tracking_enabled, 
               s.max_overtime_hours, s.status as staff_status,
               u.display_name, s.property_id
        FROM staff s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ${staffId} AND s.org_id = ${authData.orgId}
      `;

      if (!staff) {
        errors.push("Staff record not found");
        return {
          isValid: false,
          canCheckIn: false,
          canCheckOut: false,
          warnings,
          errors,
        };
      }

      // Check if staff is active
      if (staff.staff_status !== 'active') {
        errors.push("Staff member is not active");
      }

      // Check if attendance tracking is enabled
      if (!staff.attendance_tracking_enabled) {
        errors.push("Attendance tracking is not enabled for this staff member");
      }

      // Managers can only validate attendance for their assigned properties
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
          errors.push("No access to validate attendance for this staff member");
        }
      }

      // Staff can only validate their own attendance
      if (authData.role === "MANAGER" && authData.userID) {
        if (parseInt(staff.user_id) !== parseInt(authData.userID)) {
          errors.push("You can only validate your own attendance");
        }
      }

      // Check for existing attendance record
      const existingRecord = await staffDB.queryRow`
        SELECT id, check_in_time, check_out_time, status, notes
        FROM staff_attendance
        WHERE org_id = ${authData.orgId} AND staff_id = ${staffId} 
        AND attendance_date = ${attendanceDate}
      `;

      let canCheckIn = true;
      let canCheckOut = false;

      if (existingRecord) {
        if (existingRecord.check_in_time) {
          canCheckIn = false;
          warnings.push("Already checked in today");
        }

        if (existingRecord.check_out_time) {
          canCheckOut = false;
          warnings.push("Already checked out today");
        } else if (existingRecord.check_in_time) {
          canCheckOut = true;
        }
      }

      // Check for future dates
      if (attendanceDate > new Date()) {
        warnings.push("Attendance date is in the future");
      }

      // Check for weekend attendance
      const dayOfWeek = attendanceDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        warnings.push("Attendance on weekend detected");
      }

      // Check for holiday attendance (simplified check)
      const month = attendanceDate.getMonth() + 1;
      const day = attendanceDate.getDate();
      if ((month === 1 && day === 1) || (month === 12 && day === 25)) {
        warnings.push("Attendance on holiday detected");
      }

      // Check for consecutive days without attendance
      const previousDay = new Date(attendanceDate);
      previousDay.setDate(previousDay.getDate() - 1);
      
      const previousAttendance = await staffDB.queryRow`
        SELECT status FROM staff_attendance
        WHERE org_id = ${authData.orgId} AND staff_id = ${staffId} 
        AND attendance_date = ${previousDay}
      `;

      if (!previousAttendance) {
        warnings.push("No attendance record for previous day");
      }

      // Check for overtime limits
      if (staff.max_overtime_hours > 0) {
        const currentOvertime = await staffDB.queryRow`
          SELECT COALESCE(SUM(overtime_hours), 0) as total_overtime
          FROM staff_attendance
          WHERE org_id = ${authData.orgId} AND staff_id = ${staffId}
          AND attendance_date >= DATE_TRUNC('month', CURRENT_DATE)
        `;

        const totalOvertime = parseFloat(currentOvertime?.total_overtime || '0');
        if (totalOvertime >= staff.max_overtime_hours) {
          warnings.push(`Monthly overtime limit (${staff.max_overtime_hours} hours) reached`);
        }
      }

      const isValid = errors.length === 0;

      return {
        isValid,
        canCheckIn,
        canCheckOut,
        existingRecord: existingRecord ? {
          id: existingRecord.id,
          checkInTime: existingRecord.check_in_time ? new Date(existingRecord.check_in_time) : undefined,
          checkOutTime: existingRecord.check_out_time ? new Date(existingRecord.check_out_time) : undefined,
          status: existingRecord.status,
        } : undefined,
        warnings,
        errors,
      };
    } catch (error) {
      console.error('Validate attendance error:', error);
      throw APIError.internal("Failed to validate attendance");
    }
  }
);
