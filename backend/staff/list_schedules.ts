import { api, Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { staffDB } from "./db";

export interface ListSchedulesRequest {
  staffId?: Query<number>;
  propertyId?: Query<number>;
  startDate?: Query<Date>;
  endDate?: Query<Date>;
  status?: Query<string>;
}

export interface ScheduleInfo {
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

export interface ListSchedulesResponse {
  schedules: ScheduleInfo[];
}

// Lists staff schedules with filtering
export const listSchedules = api<ListSchedulesRequest, ListSchedulesResponse>(
  { auth: true, expose: true, method: "GET", path: "/staff/schedules" },
  async (req) => {
    const authData = getAuthData()!;
    const { staffId, propertyId, startDate, endDate, status } = req;

    let query = `
      SELECT 
        ss.id, ss.staff_id, ss.property_id, ss.shift_date, ss.start_time, ss.end_time,
        ss.break_minutes, ss.status, ss.notes, ss.created_at,
        u.display_name as staff_name,
        p.name as property_name
      FROM staff_schedules ss
      JOIN staff s ON ss.staff_id = s.id
      JOIN users u ON s.user_id = u.id
      JOIN properties p ON ss.property_id = p.id
      WHERE ss.org_id = $1
    `;
    const params: any[] = [authData.orgId];
    let paramIndex = 2;

    // Managers can only see schedules for properties they have access to or their own schedules
    if (authData.role === "MANAGER") {
      query += ` AND (
        p.id IN (SELECT property_id FROM user_properties WHERE user_id = $${paramIndex})
        OR s.user_id = $${paramIndex}
      )`;
      params.push(parseInt(authData.userID));
      paramIndex++;
    }

    // Apply filters
    if (staffId) {
      query += ` AND ss.staff_id = $${paramIndex}`;
      params.push(staffId);
      paramIndex++;
    }

    if (propertyId) {
      query += ` AND ss.property_id = $${paramIndex}`;
      params.push(propertyId);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND ss.shift_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND ss.shift_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (status) {
      query += ` AND ss.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY ss.shift_date DESC, ss.start_time ASC`;

    const schedules = await staffDB.rawQueryAll(query, ...params);

    return {
      schedules: schedules.map((schedule) => ({
        id: schedule.id,
        staffId: schedule.staff_id,
        staffName: schedule.staff_name,
        propertyId: schedule.property_id,
        propertyName: schedule.property_name,
        shiftDate: schedule.shift_date,
        startTime: schedule.start_time,
        endTime: schedule.end_time,
        breakMinutes: schedule.break_minutes,
        status: schedule.status,
        notes: schedule.notes,
        createdAt: schedule.created_at,
      })),
    };
  }
);
