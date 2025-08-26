import { api, Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { staffDB } from "./db";

export interface ListStaffRequest {
  propertyId?: Query&lt;number&gt;;
  department?: Query&lt;string&gt;;
  status?: Query&lt;string&gt;;
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
export const list = api&lt;ListStaffRequest, ListStaffResponse&gt;(
  { auth: true, expose: true, method: "GET", path: "/staff" },
  async (req) =&gt; {
    const authData = getAuthData()!;
    const { propertyId, department, status } = req || {};

    try {
      let query = `
        SELECT 
          s.id, s.user_id, s.property_id, s.department, s.hourly_rate_cents, 
          s.performance_rating, s.hire_date, s.notes, s.status,
          u.display_name as user_name, u.email as user_email,
          p.name as property_name
        FROM staff s
        JOIN users u ON s.user_id = u.id AND u.org_id = $1
        LEFT JOIN properties p ON s.property_id = p.id AND p.org_id = $1
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
        staff: staff.map((member) =&gt; ({
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
    } catch (error) {
      console.error('List staff error:', error);
      throw new Error('Failed to fetch staff members');
    }
  }
);
