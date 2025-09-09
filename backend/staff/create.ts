import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

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
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const { userId, propertyId, department, hourlyRateCents = 0, hireDate, notes } = req;

    const tx = await staffDB.begin();
    try {
      // Validate user exists and belongs to organization
      const userRow = await tx.queryRow`
        SELECT id, display_name FROM users 
        WHERE id = ${userId} AND org_id = ${authData.orgId}
      `;

      if (!userRow) {
        throw APIError.notFound("User not found");
      }

      // Validate property if provided
      let propertyName: string | undefined;
      if (propertyId) {
        const propertyRow = await tx.queryRow`
          SELECT id, name FROM properties 
          WHERE id = ${propertyId} AND org_id = ${authData.orgId}
        `;

        if (!propertyRow) {
          throw APIError.notFound("Property not found");
        }

        propertyName = propertyRow.name;

        // Managers must have access to the property
        if (authData.role === "MANAGER") {
          const accessCheck = await tx.queryRow`
            SELECT 1 FROM user_properties WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${propertyId}
          `;
          if (!accessCheck) {
            throw APIError.permissionDenied("No access to this property");
          }
        }
      }

      // Check if staff record already exists for this user and property
      const existingStaff = await tx.queryRow`
        SELECT id FROM staff 
        WHERE user_id = ${userId} AND org_id = ${authData.orgId} 
        AND (property_id = ${propertyId ?? null}::bigint OR (property_id IS NULL AND ${propertyId ?? null}::bigint IS NULL))
      `;

      if (existingStaff) {
        throw APIError.alreadyExists("Staff record already exists for this user and property");
      }

      // Create staff record
      const staffRow = await tx.queryRow`
        INSERT INTO staff (org_id, user_id, property_id, department, hourly_rate_cents, hire_date, notes, status)
        VALUES (
          ${authData.orgId}, 
          ${userId}, 
          ${propertyId ?? null}::bigint, 
          ${department}, 
          ${hourlyRateCents}, 
          ${hireDate ?? null}::date, 
          ${notes ?? null}::text, 
          'active'
        )
        RETURNING id, org_id, user_id, property_id, department, hourly_rate_cents, hire_date, notes, status
      `;

      if (!staffRow) {
        throw new Error("Failed to create staff record");
      }

      await tx.commit();

      return {
        id: staffRow.id,
        userId: staffRow.user_id,
        userName: userRow.display_name,
        propertyId: staffRow.property_id,
        propertyName,
        department: staffRow.department,
        hourlyRateCents: staffRow.hourly_rate_cents,
        performanceRating: 0,
        hireDate: staffRow.hire_date,
        notes: staffRow.notes,
        status: staffRow.status,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Create staff error:', error);
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      throw APIError.internal("Failed to create staff record");
    }
  }
);

