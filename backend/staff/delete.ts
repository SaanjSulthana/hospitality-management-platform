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

    const tx = await staffDB.begin();
    try {
      // Verify staff record exists and belongs to organization
      const existingStaff = await tx.queryRow`
        SELECT s.id, s.user_id, u.display_name
        FROM staff s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ${id} AND s.org_id = ${authData.orgId}
      `;

      if (!existingStaff) {
        throw APIError.notFound("Staff record not found");
      }

      // Count related records before deletion for reporting
      const counts = await tx.queryRow`
        SELECT 
          (SELECT COUNT(*) FROM staff_attendance WHERE staff_id = ${id} AND org_id = ${authData.orgId}) as attendance_count,
          (SELECT COUNT(*) FROM salary_components WHERE staff_id = ${id} AND org_id = ${authData.orgId}) as salary_components_count,
          (SELECT COUNT(*) FROM payslips WHERE staff_id = ${id} AND org_id = ${authData.orgId}) as payslips_count,
          (SELECT COUNT(*) FROM staff_schedules WHERE staff_id = ${id} AND org_id = ${authData.orgId}) as schedules_count,
          (SELECT COUNT(*) FROM leave_requests WHERE staff_id = ${id} AND org_id = ${authData.orgId}) as leave_requests_count,
          (SELECT COUNT(*) FROM schedule_change_requests WHERE staff_id = ${id} AND org_id = ${authData.orgId}) as schedule_change_requests_count
      `;

      // Delete related records in proper order (respecting foreign key constraints)
      
      // 1. Delete schedule change requests (references staff_schedules)
      await tx.exec`
        DELETE FROM schedule_change_requests 
        WHERE staff_id = ${id} AND org_id = ${authData.orgId}
      `;

      // 2. Delete staff schedules
      await tx.exec`
        DELETE FROM staff_schedules 
        WHERE staff_id = ${id} AND org_id = ${authData.orgId}
      `;

      // 3. Delete leave requests
      await tx.exec`
        DELETE FROM leave_requests 
        WHERE staff_id = ${id} AND org_id = ${authData.orgId}
      `;

      // 4. Delete payslips
      await tx.exec`
        DELETE FROM payslips 
        WHERE staff_id = ${id} AND org_id = ${authData.orgId}
      `;

      // 5. Delete salary components
      await tx.exec`
        DELETE FROM salary_components 
        WHERE staff_id = ${id} AND org_id = ${authData.orgId}
      `;

      // 6. Delete attendance records
      await tx.exec`
        DELETE FROM staff_attendance 
        WHERE staff_id = ${id} AND org_id = ${authData.orgId}
      `;

      // 7. Finally, delete the staff record
      await tx.exec`
        DELETE FROM staff 
        WHERE id = ${id} AND org_id = ${authData.orgId}
      `;

      await tx.commit();

      return {
        success: true,
        message: `Staff member ${existingStaff.display_name} and all related data have been successfully deleted`,
        deletedRecords: {
          staff: 1,
          attendance: parseInt(counts?.attendance_count || '0') || 0,
          salaryComponents: parseInt(counts?.salary_components_count || '0') || 0,
          payslips: parseInt(counts?.payslips_count || '0') || 0,
          schedules: parseInt(counts?.schedules_count || '0') || 0,
          leaveRequests: parseInt(counts?.leave_requests_count || '0') || 0,
          scheduleChangeRequests: parseInt(counts?.schedule_change_requests_count || '0') || 0,
        },
      };
    } catch (error) {
      await tx.rollback();
      console.error('Delete staff error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to delete staff record");
    }
  }
);
