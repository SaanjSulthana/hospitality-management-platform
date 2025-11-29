import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface UpdateStaffSimpleRequest {
  id: number;
  propertyId?: string;
  department?: string;
  hourlyRateCents?: string;
  hireDate?: string;
  notes?: string;
  status?: string;
}

export interface UpdateStaffSimpleResponse {
  id: number;
  success: boolean;
  message: string;
}

// Shared handler for simple staff update
async function updateSimpleHandler(req: UpdateStaffSimpleRequest): Promise<UpdateStaffSimpleResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const { 
      id, 
      propertyId, 
      department, 
      hourlyRateCents, 
      hireDate, 
      notes, 
      status
    } = req;

    try {
      console.log(`Update staff simple: ID=${id}, Department=${department}, OrgId=${authData.orgId}`);
      
      // Check if staff exists
      const existingStaff = await staffDB.queryRow`
        SELECT id FROM staff WHERE id = ${id} AND org_id = ${authData.orgId}
      `;

      if (!existingStaff) {
        throw APIError.notFound("Staff record not found");
      }

      // Build dynamic update query for basic fields only
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (propertyId !== undefined) {
        const propId = propertyId === 'none' ? null : parseInt(propertyId);
        updateFields.push(`property_id = $${paramIndex}`);
        updateValues.push(propId);
        paramIndex++;
      }

      if (department !== undefined) {
        updateFields.push(`department = $${paramIndex}`);
        updateValues.push(department);
        paramIndex++;
      }

      if (hourlyRateCents !== undefined) {
        updateFields.push(`hourly_rate_cents = $${paramIndex}`);
        updateValues.push(parseInt(hourlyRateCents) || 0);
        paramIndex++;
      }

      if (hireDate !== undefined) {
        updateFields.push(`hire_date = $${paramIndex}`);
        updateValues.push(hireDate ? new Date(hireDate) : null);
        paramIndex++;
      }

      if (notes !== undefined) {
        updateFields.push(`notes = $${paramIndex}`);
        updateValues.push(notes);
        paramIndex++;
      }

      if (status !== undefined) {
        updateFields.push(`status = $${paramIndex}`);
        updateValues.push(status);
        paramIndex++;
      }

      // Add updated_at timestamp
      updateFields.push(`updated_at = NOW()`);

      if (updateFields.length === 1) { // Only updated_at
        throw APIError.invalidArgument("No fields to update");
      }

      // Execute update
      const updateQuery = `
        UPDATE staff 
        SET ${updateFields.join(', ')} 
        WHERE id = $${paramIndex} AND org_id = $${paramIndex + 1}
      `;
      
      updateValues.push(id, authData.orgId);
      
      await staffDB.exec(updateQuery, updateValues);

      console.log(`Successfully updated staff record ${id}`);

      return {
        id: id,
        success: true,
        message: "Staff member updated successfully"
      };
    } catch (error) {
      console.error('Update staff simple error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal(`Failed to update staff: ${error.message}`);
    }
}

// LEGACY: Simple staff update (keep for backward compatibility)
export const updateSimple = api<UpdateStaffSimpleRequest, UpdateStaffSimpleResponse>(
  { auth: true, expose: true, method: "PUT", path: "/staff/update-simple" },
  updateSimpleHandler
);

// V1: Simple staff update
export const updateSimpleV1 = api<UpdateStaffSimpleRequest, UpdateStaffSimpleResponse>(
  { auth: true, expose: true, method: "PUT", path: "/v1/staff/update-simple" },
  updateSimpleHandler
);
