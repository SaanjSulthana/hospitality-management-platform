import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface UpdateDepartmentRequest {
  staffId: number;
  department: 'frontdesk' | 'housekeeping' | 'maintenance' | 'fnb' | 'admin';
  reason?: string;
}

export interface UpdateDepartmentResponse {
  success: boolean;
  staffId: number;
  department: string;
  reason?: string;
  updatedAt: Date;
}

// Updates staff department assignment
export const updateDepartment = api<UpdateDepartmentRequest, UpdateDepartmentResponse>(
  { auth: true, expose: true, method: "PUT", path: "/staff/:staffId/department" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const { staffId, department, reason } = req;

    const tx = await staffDB.begin();
    try {
      // Verify staff record exists and belongs to organization
      const existingStaff = await tx.queryRow`
        SELECT s.id, s.user_id, s.department, u.display_name
        FROM staff s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ${staffId} AND s.org_id = ${authData.orgId}
      `;

      if (!existingStaff) {
        throw APIError.notFound("Staff record not found");
      }

      // Check if department is actually changing
      if (existingStaff.department === department) {
        throw APIError.invalidArgument(`Staff member is already in ${department} department`);
      }

      // Update department
      const updatedStaff = await tx.queryRow`
        UPDATE staff 
        SET 
          department = ${department},
          notes = CASE 
            WHEN ${reason} IS NOT NULL THEN 
              COALESCE(notes, '') || '\n' || 'Department changed to ' || ${department} || ': ' || ${reason}
            ELSE notes
          END,
          updated_at = NOW()
        WHERE id = ${staffId} AND org_id = ${authData.orgId}
        RETURNING id, department, notes, updated_at
      `;

      if (!updatedStaff) {
        throw APIError.notFound("Staff record not found or could not be updated");
      }

      await tx.commit();

      return {
        success: true,
        staffId: updatedStaff.id,
        department: updatedStaff.department,
        reason,
        updatedAt: updatedStaff.updated_at,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Update department error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to update staff department");
    }
  }
);
