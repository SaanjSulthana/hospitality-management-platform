import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface UpdatePerformanceRequest {
  staffId: number;
  performanceRating: number;
  notes?: string;
  reviewDate?: Date;
}

export interface UpdatePerformanceResponse {
  success: boolean;
  staffId: number;
  performanceRating: number;
  notes?: string;
  reviewDate: Date;
  updatedAt: Date;
}

// Updates staff performance rating and review notes
export const updatePerformance = api<UpdatePerformanceRequest, UpdatePerformanceResponse>(
  { auth: true, expose: true, method: "PUT", path: "/staff/:staffId/performance" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { staffId, performanceRating, notes, reviewDate = new Date() } = req;

    // Validate performance rating
    if (performanceRating < 0 || performanceRating > 5) {
      throw APIError.invalidArgument("Performance rating must be between 0 and 5");
    }

    const tx = await staffDB.begin();
    try {
      // Verify staff record exists and belongs to organization
      const existingStaff = await tx.queryRow`
        SELECT s.id, s.user_id, s.performance_rating, u.display_name
        FROM staff s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ${staffId} AND s.org_id = ${authData.orgId}
      `;

      if (!existingStaff) {
        throw APIError.notFound("Staff record not found");
      }

      // Managers can only update performance for staff in their assigned properties
      if (authData.role === "MANAGER") {
        const accessCheck = await tx.queryRow`
          SELECT 1 FROM staff s
          WHERE s.id = ${staffId} AND s.org_id = ${authData.orgId}
          AND (
            s.property_id IN (SELECT property_id FROM user_properties WHERE user_id = ${parseInt(authData.userID)})
            OR s.property_id IS NULL
          )
        `;

        if (!accessCheck) {
          throw APIError.permissionDenied("No access to update performance for this staff member");
        }
      }

      // Update performance rating
      const updatedStaff = await tx.queryRow`
        UPDATE staff 
        SET 
          performance_rating = ${performanceRating},
          notes = COALESCE(${notes}, notes),
          updated_at = NOW()
        WHERE id = ${staffId} AND org_id = ${authData.orgId}
        RETURNING id, performance_rating, notes, updated_at
      `;

      if (!updatedStaff) {
        throw APIError.notFound("Staff record not found or could not be updated");
      }

      await tx.commit();

      return {
        success: true,
        staffId: updatedStaff.id,
        performanceRating: parseFloat(updatedStaff.performance_rating),
        notes: updatedStaff.notes,
        reviewDate: reviewDate,
        updatedAt: updatedStaff.updated_at,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Update performance error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to update staff performance");
    }
  }
);