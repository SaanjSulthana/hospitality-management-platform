import { api, Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { staffDB } from "./db";

export interface ListStaffRequest {
  propertyId?: Query<number>;
  department?: Query<string>;
  status?: Query<string>;
}

export interface StaffInfo {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  propertyId?: number;
  propertyName?: string;
  department: string;
  hourlyRateCents: number;
  performanceRating: number;
  hireDate?: Date;
  notes?: string;
  status: string;
}

export interface ListStaffResponse {
  staff: StaffInfo[];
}

// Lists staff members with filtering
export const list = api<ListStaffRequest, ListStaffResponse>(
  { auth: true, expose: true, method: "GET", path: "/staff" },
  async (req) => {
    const authData = getAuthData()!;
    const { propertyId, department, status } = req;

    let query = `
      SELECT 
        s.id, s.user_id, s.property_id, s.department, s.hourly_rate_cents, 
        s.performance_rating, s.hire_date, s.notes, s.status,
        u.display_name as user_name, u.email as user_email,
        p.name as property_name
      FROM staff s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN properties p ON s.property_id = p.id
      WHERE s.org_id = $1
    `;
    const params: any[] = [authData.orgId];
    let paramIndex = 2;

    // Managers can only see staff for properties they have access to
    if (authData.role === "MANAGER") {
      query += ` AND (
        s.property_id IN (SELECT property_id FROM user_properties WHERE user_id = $${paramIndex})
        OR s.property_id IS NULL
      )`;
      params.push(parseInt(authData.userID));
      paramIndex++;
    }

    // Apply filters
    if (propertyId) {
      query += ` AND s.property_id = $${paramIndex}`;
      params.push(propertyId);
      paramIndex++;
    }

    if (department) {
      query += ` AND s.department = $${paramIndex}`;
      params.push(department);
      paramIndex++;
    }

    if (status) {
      query += ` AND s.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY u.display_name ASC`;

    const staff = await staffDB.rawQueryAll(query, ...params);

    return {
      staff: staff.map((member) => ({
        id: member.id,
        userId: member.user_id,
        userName: member.user_name,
        userEmail: member.user_email,
        propertyId: member.property_id,
        propertyName: member.property_name,
        department: member.department,
        hourlyRateCents: parseInt(member.hourly_rate_cents) || 0,
        performanceRating: parseFloat(member.performance_rating) || 0,
        hireDate: member.hire_date,
        notes: member.notes,
        status: member.status,
      })),
    };
  }
);
