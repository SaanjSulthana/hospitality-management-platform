import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";
import { staffEvents } from "./events";
import { v4 as uuidv4 } from "uuid";

export interface CheckOutRequest {
  staffId: number;
  notes?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface CheckOutResponse {
  success: boolean;
  attendanceId: number;
  staffId: number;
  checkInTime: Date;
  checkOutTime: Date;
  totalHours: number;
  overtimeHours: number;
  status: string;
  message: string;
}

// Shared handler for staff check-out
async function checkOutHandler(req: CheckOutRequest): Promise<CheckOutResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { staffId, notes, location } = req;
    const checkOutTime = new Date();

    const tx = await staffDB.begin();
    try {
      // Verify staff record exists and belongs to organization
      const staff = await tx.queryRow`
        SELECT s.id, s.user_id, s.property_id, s.hourly_rate_cents, u.display_name
        FROM staff s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ${staffId} AND s.org_id = ${authData.orgId}
      `;

      if (!staff) {
        throw APIError.notFound("Staff record not found");
      }

      // Attendance tracking is always enabled for basic functionality

      // Managers can only check out staff for their assigned properties
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
          throw APIError.permissionDenied("No access to check out this staff member");
        }
      }

      // Staff can only check themselves out
      if (authData.role === "MANAGER" && authData.userID) {
        const staffUser = await tx.queryRow`
          SELECT user_id FROM staff WHERE id = ${staffId} AND org_id = ${authData.orgId}
        `;
        
        if (!staffUser || parseInt(staffUser.user_id) !== parseInt(authData.userID)) {
          throw APIError.permissionDenied("You can only check yourself out");
        }
      }

      // Get today's attendance record
      const attendance = await tx.queryRow`
        SELECT id, check_in_time, check_out_time, status, notes
        FROM staff_attendance
        WHERE org_id = ${authData.orgId} AND staff_id = ${staffId} 
        AND attendance_date = CURRENT_DATE
      `;

      if (!attendance) {
        throw APIError.notFound("No check-in record found for today");
      }

      if (!attendance.check_in_time) {
        throw APIError.invalidArgument("Must check in before checking out");
      }

      if (attendance.check_out_time) {
        throw APIError.alreadyExists("Already checked out today");
      }

      // Calculate hours worked
      const checkInTime = new Date(attendance.check_in_time);
      const totalHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
      
      // Calculate overtime (assuming 8 hours is standard work day)
      const standardHours = 8;
      const overtimeHours = Math.max(0, totalHours - standardHours);
      
      // Check against max overtime hours
      const maxOvertimeHours = 0; // Default value since column doesn't exist
      if (maxOvertimeHours > 0 && overtimeHours > maxOvertimeHours) {
        throw APIError.invalidArgument(`Overtime hours (${overtimeHours.toFixed(2)}) exceed maximum allowed (${maxOvertimeHours})`);
      }

      // Determine final status
      let status = attendance.status;
      if (totalHours < 4) {
        status = 'half_day';
      } else if (totalHours >= standardHours) {
        status = 'present';
      }

      // Update attendance record
      const updatedAttendance = await tx.queryRow`
        UPDATE staff_attendance 
        SET 
          check_out_time = ${checkOutTime},
          total_hours = ${totalHours},
          overtime_hours = ${overtimeHours},
          status = ${status},
          notes = CASE 
            WHEN ${notes} IS NOT NULL THEN 
              COALESCE(notes, '') || '\n' || 'Check-out: ' || ${notes}
            ELSE notes
          END,
          updated_at = NOW()
        WHERE id = ${attendance.id}
        RETURNING id, check_in_time, check_out_time, total_hours, overtime_hours, status
      `;

      if (!updatedAttendance) {
        throw APIError.notFound("Attendance record not found or could not be updated");
      }

      await tx.commit();

      // Publish attendance_checked_out event
      try {
        await staffEvents.publish({
          eventId: uuidv4(),
          eventVersion: 'v1',
          eventType: 'attendance_checked_out',
          orgId: authData.orgId,
          propertyId: staff.property_id ?? null,
          userId: parseInt(authData.userID),
          timestamp: new Date(),
          entityId: updatedAttendance.id,
          entityType: 'attendance',
          metadata: {
            staffId,
            staffName: staff.display_name,
            attendanceDate: new Date().toISOString().split('T')[0],
            totalHours,
            overtimeHours,
            status: updatedAttendance.status,
          },
        });
      } catch (e) {
        console.warn("[Staff Events] Failed to publish attendance_checked_out", e);
      }

      return {
        success: true,
        attendanceId: updatedAttendance.id,
        staffId,
        checkInTime: new Date(updatedAttendance.check_in_time),
        checkOutTime: new Date(updatedAttendance.check_out_time),
        totalHours: parseFloat(updatedAttendance.total_hours),
        overtimeHours: parseFloat(updatedAttendance.overtime_hours),
        status: updatedAttendance.status,
        message: `Checked out successfully. Worked ${totalHours.toFixed(2)} hours${overtimeHours > 0 ? ` (${overtimeHours.toFixed(2)} overtime)` : ''}`,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Check-out error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to check out staff member");
    }
}

// LEGACY: Staff check-out (keep for backward compatibility)
export const checkOut = api<CheckOutRequest, CheckOutResponse>(
  { auth: true, expose: true, method: "POST", path: "/staff/:staffId/check-out" },
  checkOutHandler
);

// V1: Staff check-out
export const checkOutV1 = api<CheckOutRequest, CheckOutResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/staff/:staffId/check-out" },
  checkOutHandler
);
