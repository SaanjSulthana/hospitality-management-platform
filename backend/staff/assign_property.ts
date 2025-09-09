import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface AssignPropertyRequest {
  staffId: number;
  propertyId: number;
}

export interface AssignPropertyResponse {
  success: boolean;
  staffId: number;
  propertyId: number;
  propertyName: string;
  updatedAt: Date;
}

// Assigns a staff member to a property
export const assignProperty = api<AssignPropertyRequest, AssignPropertyResponse>(
  { auth: true, expose: true, method: "PUT", path: "/staff/:staffId/assign-property" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const { staffId, propertyId } = req;

    const tx = await staffDB.begin();
    try {
      // Verify staff record exists and belongs to organization
      const existingStaff = await tx.queryRow`
        SELECT s.id, s.user_id, s.property_id, u.display_name
        FROM staff s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ${staffId} AND s.org_id = ${authData.orgId}
      `;

      if (!existingStaff) {
        throw APIError.notFound("Staff record not found");
      }

      // Verify property exists and belongs to organization
      const property = await tx.queryRow`
        SELECT id, name FROM properties 
        WHERE id = ${propertyId} AND org_id = ${authData.orgId}
      `;

      if (!property) {
        throw APIError.notFound("Property not found");
      }

      // Check if staff is already assigned to this property
      if (existingStaff.property_id === propertyId) {
        throw APIError.invalidArgument("Staff member is already assigned to this property");
      }

      // Update property assignment
      const updatedStaff = await tx.queryRow`
        UPDATE staff 
        SET 
          property_id = ${propertyId},
          updated_at = NOW()
        WHERE id = ${staffId} AND org_id = ${authData.orgId}
        RETURNING id, property_id, updated_at
      `;

      if (!updatedStaff) {
        throw APIError.notFound("Staff record not found or could not be updated");
      }

      await tx.commit();

      return {
        success: true,
        staffId: updatedStaff.id,
        propertyId: updatedStaff.property_id,
        propertyName: property.name,
        updatedAt: updatedStaff.updated_at,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Assign property error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to assign staff to property");
    }
  }
);
