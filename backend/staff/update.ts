import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface UpdateStaffRequest {
  id: number;
  propertyId?: string;
  department?: string;
  hourlyRateCents?: string;
  performanceRating?: string;
  hireDate?: string;
  notes?: string;
  status?: string;
  salaryType?: string;
  baseSalaryCents?: string;
  overtimeRateCents?: string;
  attendanceTrackingEnabled?: boolean;
  maxOvertimeHours?: string;
  leaveBalance?: string;
}

export interface UpdateStaffResponse {
  id: number;
  success: boolean;
  message: string;
}

// Updates an existing staff record with enhanced fields
export const update = api<UpdateStaffRequest, UpdateStaffResponse>(
  { auth: true, expose: true, method: "PUT", path: "/staff/update" },
  async (req) => {
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
      performanceRating, 
      hireDate, 
      notes, 
      status, 
      salaryType, 
      baseSalaryCents, 
      overtimeRateCents, 
      attendanceTrackingEnabled, 
      maxOvertimeHours, 
      leaveBalance 
    } = req;

    try {
      console.log(`Update staff: ID=${id}, Department=${department}, OrgId=${authData.orgId}`);
      
      // Check if staff exists
      const existingStaff = await staffDB.queryRow`
        SELECT id FROM staff WHERE id = ${id} AND org_id = ${authData.orgId}
      `;

      if (!existingStaff) {
        throw APIError.notFound("Staff record not found");
      }

      // Build dynamic update query
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

      if (performanceRating !== undefined) {
        updateFields.push(`performance_rating = $${paramIndex}`);
        updateValues.push(parseFloat(performanceRating) || 0);
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

      if (salaryType !== undefined) {
        updateFields.push(`salary_type = $${paramIndex}`);
        updateValues.push(salaryType);
        paramIndex++;
      }

      if (baseSalaryCents !== undefined) {
        updateFields.push(`base_salary_cents = $${paramIndex}`);
        updateValues.push(parseInt(baseSalaryCents) || 0);
        paramIndex++;
      }

      if (overtimeRateCents !== undefined) {
        updateFields.push(`overtime_rate_cents = $${paramIndex}`);
        updateValues.push(parseInt(overtimeRateCents) || 0);
        paramIndex++;
      }

      if (attendanceTrackingEnabled !== undefined) {
        updateFields.push(`attendance_tracking_enabled = $${paramIndex}`);
        updateValues.push(attendanceTrackingEnabled);
        paramIndex++;
      }

      if (maxOvertimeHours !== undefined) {
        updateFields.push(`max_overtime_hours = $${paramIndex}`);
        updateValues.push(parseFloat(maxOvertimeHours) || 0);
        paramIndex++;
      }

      if (leaveBalance !== undefined) {
        updateFields.push(`leave_balance = $${paramIndex}`);
        updateValues.push(parseInt(leaveBalance) || 0);
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
        WHERE id = $${paramIndex + 1} AND org_id = $${paramIndex + 2}
      `;
      
      updateValues.push(id, authData.orgId);
      
      await staffDB.exec(updateQuery as any, updateValues);

      console.log(`Successfully updated staff record ${id}`);

      return {
        id: id,
        success: true,
        message: "Staff member updated successfully"
      };
    } catch (error) {
      console.error('Update staff error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw APIError.internal(`Failed to update staff: ${errorMessage}`);
    }
  }
);
