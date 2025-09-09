import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface CreateScheduleRequest {
  staffId: number;
  propertyId: number;
  shiftDate: Date;
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  breakMinutes?: number;
  notes?: string;
}

export interface CreateScheduleResponse {
  id: number;
  staffId: number;
  staffName: string;
  propertyId: number;
  propertyName: string;
  shiftDate: Date;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  status: string;
  notes?: string;
  createdAt: Date;
}

// Creates a new staff schedule
export const createSchedule = api<CreateScheduleRequest, CreateScheduleResponse>(
  { auth: true, expose: true, method: "POST", path: "/staff/schedules" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { staffId, propertyId, shiftDate, startTime, endTime, breakMinutes = 0, notes } = req;

    // Validate staff member
    const staffRow = await staffDB.queryRow`
      SELECT s.id, s.org_id, s.property_id, u.display_name as staff_name
      FROM staff s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ${staffId} AND s.org_id = ${authData.orgId} AND s.status = 'active'
    `;

    if (!staffRow) {
      throw APIError.notFound("Staff member not found");
    }

    // Validate property
    const propertyRow = await staffDB.queryRow`
      SELECT id, name FROM properties 
      WHERE id = ${propertyId} AND org_id = ${authData.orgId}
    `;

    if (!propertyRow) {
      throw APIError.notFound("Property not found");
    }

    // Managers must have access to the property
    if (authData.role === "MANAGER") {
      const accessCheck = await staffDB.queryRow`
        SELECT 1 FROM user_properties WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${propertyId}
      `;
      if (!accessCheck) {
        throw APIError.permissionDenied("No access to this property");
      }
    }

    // Validate time format and logic
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      throw APIError.invalidArgument("Invalid time format. Use HH:MM format");
    }

    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) {
      throw APIError.invalidArgument("End time must be after start time");
    }

    // Check for overlapping schedules
    const overlappingSchedule = await staffDB.queryRow`
      SELECT id FROM staff_schedules 
      WHERE staff_id = ${staffId} AND shift_date = ${shiftDate} 
      AND status IN ('scheduled', 'confirmed')
      AND (
        (start_time <= ${startTime} AND end_time > ${startTime})
        OR (start_time < ${endTime} AND end_time >= ${endTime})
        OR (start_time >= ${startTime} AND end_time <= ${endTime})
      )
    `;

    if (overlappingSchedule) {
      throw APIError.alreadyExists("Staff member already has a schedule that overlaps with this time");
    }

    // Create schedule
    const scheduleRow = await staffDB.queryRow`
      INSERT INTO staff_schedules (org_id, staff_id, property_id, shift_date, start_time, end_time, break_minutes, notes, status)
      VALUES (${authData.orgId}, ${staffId}, ${propertyId}, ${shiftDate}, ${startTime}, ${endTime}, ${breakMinutes}, ${notes || null}, 'scheduled')
      RETURNING id, staff_id, property_id, shift_date, start_time, end_time, break_minutes, status, notes, created_at
    `;

    if (!scheduleRow) {
      throw new Error('Failed to create schedule');
    }

    return {
      id: scheduleRow.id,
      staffId: scheduleRow.staff_id,
      staffName: staffRow.staff_name,
      propertyId: scheduleRow.property_id,
      propertyName: propertyRow.name,
      shiftDate: scheduleRow.shift_date,
      startTime: scheduleRow.start_time,
      endTime: scheduleRow.end_time,
      breakMinutes: scheduleRow.break_minutes,
      status: scheduleRow.status,
      notes: scheduleRow.notes,
      createdAt: scheduleRow.created_at,
    };
  }
);

