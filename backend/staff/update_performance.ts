import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { staffDB } from "./db";
import { requireRole } from "../auth/middleware";

export interface UpdatePerformanceRequest {
  id: number;
  performanceRating: number;
  notes?: string;
}

export interface UpdatePerformanceResponse {
  success: boolean;
  staffId: number;
  performanceRating: number;
}

// Updates staff performance rating
export const updatePerformance = api<UpdatePerformanceRequest, UpdatePerformanceResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/staff/:id/performance" },
  async (req) => {
    const authData = getAuthData()!;
    requireRole("ADMIN", "MANAGER")(authData);

    const { id, performanceRating, notes } = req;

    if (performanceRating < 0 || performanceRating > 5) {
      throw APIError.invalidArgument("Performance rating must be between 0 and 5");
    }

    // Get staff record and check access
    const staffRow = await staffDB.queryRow`
      SELECT s.id, s.org_id, s.property_id, s.user_id, u.display_name as staff_name
      FROM staff s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ${id} AND s.org_id = ${authData.orgId}
    `;

    if (!staffRow) {
      throw APIError.notFound("Staff member not found");
    }

    // Managers can only update performance for staff they manage
    if (authData.role === "MANAGER" && staffRow.property_id) {
      const accessCheck = await staffDB.queryRow`
        SELECT 1 FROM user_properties WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${staffRow.property_id}
      `;
      if (!accessCheck) {
        throw APIError.permissionDenied("No access to update this staff member's performance");
      }
    }

    // Update performance rating
    await staffDB.exec`
      UPDATE staff 
      SET performance_rating = ${performanceRating}, notes = ${notes || null}
      WHERE id = ${id}
    `;

    // Create notification for the staff member
    await staffDB.exec`
      INSERT INTO notifications (org_id, user_id, type, payload_json)
      VALUES (
        ${authData.orgId},
        ${staffRow.user_id},
        'performance_updated',
        ${JSON.stringify({
          staff_id: id,
          performance_rating: performanceRating,
          updated_by: authData.displayName,
          notes: notes || null,
          message: `Your performance rating has been updated to ${performanceRating}/5`
        })}
      )
    `;

    return {
      success: true,
      staffId: id,
      performanceRating,
    };
  }
);
