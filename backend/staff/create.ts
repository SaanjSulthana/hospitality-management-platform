import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { staffDB } from "./db";
import { requireRole } from "../auth/middleware";

export interface CreateStaffRequest {
  userId: number;
  propertyId?: number;
  department: 'frontdesk' | 'housekeeping' | 'maintenance' | 'fnb' | 'admin';
  hourlyRateCents?: number;
  hireDate?: Date;
  notes?: string;
}

export interface CreateStaffResponse {
  id: number;
  userId: number;
  userName: string;
  propertyId?: number;
  propertyName?: string;
  department: string;
  hourlyRateCents: number;
  performanceRating: number;
  hireDate?: Date;
  notes?: string;
  status: string;
}

// Creates a new staff record
export const create = api<CreateStaffRequest, CreateStaffResponse>(
  { auth: true, expose: true, method: "POST", path: "/staff" },
  async (req) => {
    const authData = getAuthData()!;
    requireRole("ADMIN", "MANAGER")(authData);

    const { userId, propertyId, department, hourlyRateCents = 0, hireDate, notes } = req;

    // Validate user exists and belongs to organization
    const userRow = await staffDB.queryRow`
      SELECT id, display_name FROM users 
      WHERE id = ${userId} AND org_id = ${authData.orgId}
    `;

    if (!userRow) {
      throw APIError.notFound("User not found");
    }

    // Validate property if provided
    let propertyName: string | undefined;
    if (propertyId) {
      const propertyRow = await staffDB.queryRow`
        SELECT id, name FROM properties 
        WHERE id = ${propertyId} AND org_id = ${authData.orgId}
      `;

      if (!propertyRow) {
        throw APIError.notFound("Property not found");
      }

      propertyName = propertyRow.name;

      // Managers must have access to the property
      if (authData.role === "MANAGER") {
        const accessCheck = await staffDB.queryRow`
          SELECT 1 FROM user_properties WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${propertyId}
        `;
        if (!accessCheck) {
          throw APIError.permissionDenied("No access to this property");
        }
      }
    }

    // Check if staff record already exists for this user and property
    const existingStaff = await staffDB.queryRow`
      SELECT id FROM staff 
      WHERE user_id = ${userId} AND org_id = ${authData.orgId} 
      AND (property_id = ${propertyId ?? null} OR (property_id IS NULL AND ${propertyId ?? null} IS NULL))
    `;

    if (existingStaff) {
      throw APIError.alreadyExists("Staff record already exists for this user and property");
    }

    // Create staff record
    const staffRow = await staffDB.queryRow`
      INSERT INTO staff (org_id, user_id, property_id, department, hourly_rate_cents, hire_date, notes, status)
      VALUES (${authData.orgId}, ${userId}, ${propertyId ?? null}, ${department}, ${hourlyRateCents}, ${hireDate ?? null}, ${notes ?? null}, 'active')
      RETURNING id, org_id, user_id, property_id, department, hourly_rate_cents, performance_rating, hire_date, notes, status
    `;

    return {
      id: staffRow.id,
      userId: staffRow.user_id,
      userName: userRow.display_name,
      propertyId: staffRow.property_id,
      propertyName,
      department: staffRow.department,
      hourlyRateCents: staffRow.hourly_rate_cents,
      performanceRating: parseFloat(staffRow.performance_rating) || 0,
      hireDate: staffRow.hire_date,
      notes: staffRow.notes,
      status: staffRow.status,
    };
  }
);
