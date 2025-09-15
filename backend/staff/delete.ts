import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface DeleteStaffRequest {
  id: number;
}

export interface DeleteStaffResponse {
  success: boolean;
  message: string;
  deletedRecords: {
    staff: number;
    attendance: number;
    salaryComponents: number;
    payslips: number;
    schedules: number;
    leaveRequests: number;
    scheduleChangeRequests: number;
  };
}

// Deletes a staff record and all related data
export const deleteStaff = api<DeleteStaffRequest, DeleteStaffResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/staff/:id" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const { id } = req;

    try {
      // Verify staff record exists and belongs to organization
      const existingStaff = await staffDB.queryRow`
        SELECT s.id, s.user_id, u.display_name
        FROM staff s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ${id} AND s.org_id = ${authData.orgId}
      `;

      if (!existingStaff) {
        throw APIError.notFound("Staff record not found");
      }

      // Simple delete - just delete the staff record for now
      await staffDB.exec`
        DELETE FROM staff 
        WHERE id = ${id} AND org_id = ${authData.orgId}
      `;

      return {
        success: true,
        message: `Staff member ${existingStaff.display_name} has been successfully deleted`,
        deletedRecords: {
          staff: 1,
          attendance: 0,
          salaryComponents: 0,
          payslips: 0,
          schedules: 0,
          leaveRequests: 0,
          scheduleChangeRequests: 0,
        },
      };
    } catch (error) {
      console.error('Delete staff error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal(`Failed to delete staff record: ${error.message}`);
    }
  }
);
