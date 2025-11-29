import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";
import { staffEvents } from "./events";
import { v4 as uuidv4 } from "uuid";

export interface CheckInRequest {
  staffId: number;
  notes?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface CheckInResponse {
  success: boolean;
  attendanceId: number;
  staffId: number;
  checkInTime: Date;
  status: string;
  message: string;
}

// Shared handler for staff check-in
async function checkInHandler(req: CheckInRequest): Promise<CheckInResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { staffId, notes, location } = req;
    const checkInTime = new Date();

    // Create staff_attendance table if it doesn't exist
    try {
      await staffDB.exec`
        CREATE TABLE IF NOT EXISTS staff_attendance (
          id BIGSERIAL PRIMARY KEY,
          org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
          attendance_date DATE NOT NULL,
          check_in_time TIMESTAMP,
          check_out_time TIMESTAMP,
          status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'half_day')) DEFAULT 'present',
          notes TEXT,
          location_latitude DECIMAL(10, 8),
          location_longitude DECIMAL(11, 8),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(org_id, staff_id, attendance_date)
        )`;
    } catch (error) {
      console.log("Table creation skipped (may already exist):", error);
    }

    const tx = await staffDB.begin();
    try {
      // Verify staff record exists and belongs to organization
      const staff = await tx.queryRow`
        SELECT s.id, s.user_id, s.property_id, u.display_name
        FROM staff s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ${staffId} AND s.org_id = ${authData.orgId}
      `;

      if (!staff) {
        throw APIError.notFound("Staff record not found");
      }

      // Attendance tracking is always enabled for basic functionality

      // Managers can only check in staff for their assigned properties
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
          throw APIError.permissionDenied("No access to check in this staff member");
        }
      }

      // Staff can only check themselves in
      if (authData.role === "MANAGER" && authData.userID) {
        const staffUser = await tx.queryRow`
          SELECT user_id FROM staff WHERE id = ${staffId} AND org_id = ${authData.orgId}
        `;
        
        if (!staffUser || parseInt(staffUser.user_id) !== parseInt(authData.userID)) {
          throw APIError.permissionDenied("You can only check yourself in");
        }
      }

      // Check if already checked in today
      const existingAttendance = await tx.queryRow`
        SELECT id, check_in_time, status FROM staff_attendance
        WHERE org_id = ${authData.orgId} AND staff_id = ${staffId} 
        AND attendance_date = CURRENT_DATE
      `;

      if (existingAttendance) {
        if (existingAttendance.check_in_time) {
          throw APIError.alreadyExists("Already checked in today");
        }
      }

      // Determine if late (assuming work starts at 9 AM)
      const workStartTime = new Date();
      workStartTime.setHours(9, 0, 0, 0);
      const isLate = checkInTime > workStartTime;
      const status = isLate ? 'late' : 'present';

      // Insert or update attendance record
      let attendanceId: number;
      if (existingAttendance) {
        // Update existing record
        const updatedAttendance = await tx.queryRow`
          UPDATE staff_attendance 
          SET 
            check_in_time = ${checkInTime},
            status = ${status},
            notes = COALESCE(${notes}, notes),
            updated_at = NOW()
          WHERE id = ${existingAttendance.id}
          RETURNING id
        `;
        attendanceId = updatedAttendance?.id || 0;
      } else {
        // Create new record
        const newAttendance = await tx.queryRow`
          INSERT INTO staff_attendance (
            org_id, staff_id, attendance_date, check_in_time, 
            status, notes, created_at, updated_at
          ) VALUES (
            ${authData.orgId}, ${staffId}, CURRENT_DATE, ${checkInTime},
            ${status}, ${notes}, NOW(), NOW()
          )
          RETURNING id
        `;
        attendanceId = newAttendance?.id || 0;
      }

      await tx.commit();

      // Publish attendance_checked_in event
      try {
        await staffEvents.publish({
          eventId: uuidv4(),
          eventVersion: 'v1',
          eventType: 'attendance_checked_in',
          orgId: authData.orgId,
          propertyId: staff.property_id ?? null,
          userId: parseInt(authData.userID),
          timestamp: new Date(),
          entityId: attendanceId,
          entityType: 'attendance',
          metadata: {
            staffId,
            staffName: staff.display_name,
            attendanceDate: new Date().toISOString().split('T')[0],
            status,
          },
        });
      } catch (e) {
        console.warn("[Staff Events] Failed to publish attendance_checked_in", e);
      }

      return {
        success: true,
        attendanceId,
        staffId,
        checkInTime,
        status,
        message: isLate 
          ? `Checked in successfully (late at ${checkInTime.toLocaleTimeString()})`
          : `Checked in successfully at ${checkInTime.toLocaleTimeString()}`,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Check-in error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to check in staff member");
    }
}

// LEGACY: Staff check-in (keep for backward compatibility)
export const checkIn = api<CheckInRequest, CheckInResponse>(
  { auth: true, expose: true, method: "POST", path: "/staff/:staffId/check-in" },
  checkInHandler
);

// V1: Staff check-in
export const checkInV1 = api<CheckInRequest, CheckInResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/staff/:staffId/check-in" },
  checkInHandler
);
