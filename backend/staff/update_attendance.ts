import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface UpdateAttendanceRequest {
  attendanceId: number;
  checkInTime?: Date;
  checkOutTime?: Date;
  status?: 'present' | 'absent' | 'late' | 'half_day' | 'leave';
  notes?: string;
  reason?: string;
}

export interface UpdateAttendanceResponse {
  success: boolean;
  attendanceId: number;
  staffId: number;
  staffName: string;
  attendanceDate: Date;
  checkInTime?: Date;
  checkOutTime?: Date;
  totalHours: number;
  overtimeHours: number;
  status: string;
  notes?: string;
  updatedAt: Date;
}

// Shared handler for updating attendance record (Admin only)
async function updateAttendanceHandler(req: UpdateAttendanceRequest): Promise<UpdateAttendanceResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN")(authData);

    const { attendanceId, checkInTime, checkOutTime, status, notes, reason } = req;

    const tx = await staffDB.begin();
    try {
      // Get existing attendance record
      const existingAttendance = await tx.queryRow`
        SELECT sa.id, sa.staff_id, sa.attendance_date, sa.check_in_time, 
               sa.check_out_time, sa.total_hours, sa.overtime_hours, 
               sa.status, sa.notes, u.display_name as staff_name
        FROM staff_attendance sa
        JOIN staff s ON sa.staff_id = s.id
        JOIN users u ON s.user_id = u.id
        WHERE sa.id = ${attendanceId} AND sa.org_id = ${authData.orgId}
      `;

      if (!existingAttendance) {
        throw APIError.notFound("Attendance record not found");
      }

      // Build dynamic update query
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (checkInTime !== undefined) {
        updateFields.push(`check_in_time = $${paramIndex}`);
        updateValues.push(checkInTime);
        paramIndex++;
      }

      if (checkOutTime !== undefined) {
        updateFields.push(`check_out_time = $${paramIndex}`);
        updateValues.push(checkOutTime);
        paramIndex++;
      }

      if (status !== undefined) {
        updateFields.push(`status = $${paramIndex}`);
        updateValues.push(status);
        paramIndex++;
      }

      if (notes !== undefined) {
        updateFields.push(`notes = $${paramIndex}`);
        updateValues.push(notes);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        throw APIError.invalidArgument("No fields to update");
      }

      // Add reason to notes if provided
      if (reason) {
        updateFields.push(`notes = COALESCE(notes, '') || '\n' || 'Updated: ' || $${paramIndex}`);
        updateValues.push(reason);
        paramIndex++;
      }

      // Recalculate hours if times are updated
      if (checkInTime !== undefined || checkOutTime !== undefined) {
        const finalCheckInTime = checkInTime || existingAttendance.check_in_time;
        const finalCheckOutTime = checkOutTime || existingAttendance.check_out_time;
        
        if (finalCheckInTime && finalCheckOutTime) {
          const totalHours = (new Date(finalCheckOutTime).getTime() - new Date(finalCheckInTime).getTime()) / (1000 * 60 * 60);
          const standardHours = 8;
          const overtimeHours = Math.max(0, totalHours - standardHours);
          
          updateFields.push(`total_hours = $${paramIndex}`);
          updateValues.push(totalHours);
          paramIndex++;
          
          updateFields.push(`overtime_hours = $${paramIndex}`);
          updateValues.push(overtimeHours);
          paramIndex++;
        }
      }

      // Add updated_at timestamp
      updateFields.push(`updated_at = NOW()`);
      updateValues.push(attendanceId);

      // Execute update
      const updateQuery = `
        UPDATE staff_attendance 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex} AND org_id = ${authData.orgId}
        RETURNING id, staff_id, attendance_date, check_in_time, check_out_time,
                  total_hours, overtime_hours, status, notes, updated_at
      `;

      const updatedAttendance = await tx.rawQueryRow(updateQuery, ...updateValues);

      if (!updatedAttendance) {
        throw APIError.notFound("Attendance record not found or could not be updated");
      }

      await tx.commit();

      return {
        success: true,
        attendanceId: updatedAttendance.id,
        staffId: updatedAttendance.staff_id,
        staffName: existingAttendance.staff_name,
        attendanceDate: updatedAttendance.attendance_date,
        checkInTime: updatedAttendance.check_in_time ? new Date(updatedAttendance.check_in_time) : undefined,
        checkOutTime: updatedAttendance.check_out_time ? new Date(updatedAttendance.check_out_time) : undefined,
        totalHours: parseFloat(updatedAttendance.total_hours) || 0,
        overtimeHours: parseFloat(updatedAttendance.overtime_hours) || 0,
        status: updatedAttendance.status,
        notes: updatedAttendance.notes,
        updatedAt: new Date(updatedAttendance.updated_at),
      };
    } catch (error) {
      await tx.rollback();
      console.error('Update attendance error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to update attendance record");
    }
}

// LEGACY: Update attendance record (keep for backward compatibility)
export const updateAttendance = api<UpdateAttendanceRequest, UpdateAttendanceResponse>(
  { auth: true, expose: true, method: "PUT", path: "/staff/attendance/:attendanceId" },
  updateAttendanceHandler
);

// V1: Update attendance record
export const updateAttendanceV1 = api<UpdateAttendanceRequest, UpdateAttendanceResponse>(
  { auth: true, expose: true, method: "PUT", path: "/v1/staff/attendance/:attendanceId" },
  updateAttendanceHandler
);
