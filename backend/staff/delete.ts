import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";
import { staffEvents } from "./events";
import { v4 as uuidv4 } from "uuid";

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

// Shared handler for deleting staff
async function deleteStaffHandler(req: DeleteStaffRequest): Promise<DeleteStaffResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const { id } = req;

    try {
      // Verify staff record exists and belongs to organization
      const existingStaff = await staffDB.queryRow`
        SELECT s.id, s.user_id, s.property_id, u.display_name
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

      // Publish staff_deleted event
      try {
        await staffEvents.publish({
          eventId: uuidv4(),
          eventVersion: 'v1',
          eventType: 'staff_deleted',
          orgId: authData.orgId,
          propertyId: existingStaff.property_id ?? null,
          userId: parseInt(authData.userID),
          timestamp: new Date(),
          entityId: id,
          entityType: 'staff',
          metadata: {
            userId: existingStaff.user_id,
            userName: existingStaff.display_name,
          },
        });
      } catch (e) {
        console.warn("[Staff Events] Failed to publish staff_deleted", e);
      }

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

// LEGACY: Deletes staff record (keep for backward compatibility)
export const deleteStaff = api<DeleteStaffRequest, DeleteStaffResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/staff/:id" },
  deleteStaffHandler
);

// V1: Deletes staff record
export const deleteStaffV1 = api<DeleteStaffRequest, DeleteStaffResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/v1/staff/:id" },
  deleteStaffHandler
);
