import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface UpdateStatusRequest {
  staffId: number;
  status: 'active' | 'inactive';
  reason?: string;
}

export interface UpdateStatusResponse {
  success: boolean;
  staffId: number;
  status: string;
  reason?: string;
  updatedAt: Date;
}

// Shared handler for updating staff status
async function updateStatusHandler(req: UpdateStatusRequest): Promise<UpdateStatusResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const { staffId, status, reason } = req;

    const tx = await staffDB.begin();
    try {
      // Verify staff record exists and belongs to organization
      const existingStaff = await tx.queryRow`
        SELECT s.id, s.user_id, s.status, u.display_name
        FROM staff s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ${staffId} AND s.org_id = ${authData.orgId}
      `;

      if (!existingStaff) {
        throw APIError.notFound("Staff record not found");
      }

      // Check if status is actually changing
      if (existingStaff.status === status) {
        throw APIError.invalidArgument(`Staff member is already ${status}`);
      }

      // Update status
      const updatedStaff = await tx.queryRow`
        UPDATE staff 
        SET 
          status = ${status},
          notes = CASE 
            WHEN ${reason} IS NOT NULL THEN 
              COALESCE(notes, '') || '\n' || 'Status changed to ' || ${status} || ': ' || ${reason}
            ELSE notes
          END,
          updated_at = NOW()
        WHERE id = ${staffId} AND org_id = ${authData.orgId}
        RETURNING id, status, notes, updated_at
      `;

      if (!updatedStaff) {
        throw APIError.notFound("Staff record not found or could not be updated");
      }

      await tx.commit();

      return {
        success: true,
        staffId: updatedStaff.id,
        status: updatedStaff.status,
        reason,
        updatedAt: updatedStaff.updated_at,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Update status error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to update staff status");
    }
}

// LEGACY: Updates staff status (keep for backward compatibility)
export const updateStatus = api<UpdateStatusRequest, UpdateStatusResponse>(
  { auth: true, expose: true, method: "PUT", path: "/staff/:staffId/status" },
  updateStatusHandler
);

// V1: Updates staff status
export const updateStatusV1 = api<UpdateStatusRequest, UpdateStatusResponse>(
  { auth: true, expose: true, method: "PUT", path: "/v1/staff/:staffId/status" },
  updateStatusHandler
);
