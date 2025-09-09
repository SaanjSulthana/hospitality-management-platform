import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface UpdateStaffRequest {
  id: number;
  propertyId?: number;
  department?: 'frontdesk' | 'housekeeping' | 'maintenance' | 'fnb' | 'admin';
  hourlyRateCents?: number;
  performanceRating?: number;
  hireDate?: Date;
  notes?: string;
  status?: 'active' | 'inactive';
  // Enhanced fields
  salaryType?: 'hourly' | 'monthly' | 'daily';
  baseSalaryCents?: number;
  overtimeRateCents?: number;
  attendanceTrackingEnabled?: boolean;
  maxOvertimeHours?: number;
  leaveBalance?: number;
}

export interface UpdateStaffResponse {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  propertyId?: number;
  propertyName?: string;
  department: string;
  hourlyRateCents: number;
  performanceRating: number;
  hireDate?: Date;
  notes?: string;
  status: string;
  // Enhanced fields
  salaryType: string;
  baseSalaryCents: number;
  overtimeRateCents: number;
  attendanceTrackingEnabled: boolean;
  maxOvertimeHours: number;
  leaveBalance: number;
}

// Updates an existing staff record with enhanced fields
export const update = api<UpdateStaffRequest, UpdateStaffResponse>(
  { auth: true, expose: true, method: "PUT", path: "/staff/:id" },
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

    const tx = await staffDB.begin();
    try {
      // Verify staff record exists and belongs to organization
      const existingStaff = await tx.queryRow`
        SELECT s.id, s.user_id, s.property_id, s.department, s.hourly_rate_cents,
               s.performance_rating, s.hire_date, s.notes, s.status,
               s.salary_type, s.base_salary_cents, s.overtime_rate_cents,
               s.attendance_tracking_enabled, s.max_overtime_hours, s.leave_balance,
               u.display_name, u.email
        FROM staff s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ${id} AND s.org_id = ${authData.orgId}
      `;

      if (!existingStaff) {
        throw APIError.notFound("Staff record not found");
      }

      // Validate property if provided
      let propertyName: string | undefined;
      if (propertyId !== undefined) {
        if (propertyId === null) {
          propertyName = undefined;
        } else {
          const propertyRow = await tx.queryRow`
            SELECT id, name FROM properties 
            WHERE id = ${propertyId} AND org_id = ${authData.orgId}
          `;

          if (!propertyRow) {
            throw APIError.notFound("Property not found");
          }
          propertyName = propertyRow.name;
        }
      }

      // Build dynamic update query
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (propertyId !== undefined) {
        updateFields.push(`property_id = $${paramIndex}`);
        updateValues.push(propertyId);
        paramIndex++;
      }

      if (department !== undefined) {
        updateFields.push(`department = $${paramIndex}`);
        updateValues.push(department);
        paramIndex++;
      }

      if (hourlyRateCents !== undefined) {
        updateFields.push(`hourly_rate_cents = $${paramIndex}`);
        updateValues.push(hourlyRateCents);
        paramIndex++;
      }

      if (performanceRating !== undefined) {
        updateFields.push(`performance_rating = $${paramIndex}`);
        updateValues.push(performanceRating);
        paramIndex++;
      }

      if (hireDate !== undefined) {
        updateFields.push(`hire_date = $${paramIndex}`);
        updateValues.push(hireDate);
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

      // Enhanced fields
      if (salaryType !== undefined) {
        updateFields.push(`salary_type = $${paramIndex}`);
        updateValues.push(salaryType);
        paramIndex++;
      }

      if (baseSalaryCents !== undefined) {
        updateFields.push(`base_salary_cents = $${paramIndex}`);
        updateValues.push(baseSalaryCents);
        paramIndex++;
      }

      if (overtimeRateCents !== undefined) {
        updateFields.push(`overtime_rate_cents = $${paramIndex}`);
        updateValues.push(overtimeRateCents);
        paramIndex++;
      }

      if (attendanceTrackingEnabled !== undefined) {
        updateFields.push(`attendance_tracking_enabled = $${paramIndex}`);
        updateValues.push(attendanceTrackingEnabled);
        paramIndex++;
      }

      if (maxOvertimeHours !== undefined) {
        updateFields.push(`max_overtime_hours = $${paramIndex}`);
        updateValues.push(maxOvertimeHours);
        paramIndex++;
      }

      if (leaveBalance !== undefined) {
        updateFields.push(`leave_balance = $${paramIndex}`);
        updateValues.push(leaveBalance);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        throw APIError.invalidArgument("No fields to update");
      }

      // Add updated_at timestamp
      updateFields.push(`updated_at = NOW()`);
      updateValues.push(id);

      // Execute update
      const updateQuery = `
        UPDATE staff 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex} AND org_id = ${authData.orgId}
        RETURNING id, user_id, property_id, department, hourly_rate_cents,
                  performance_rating, hire_date, notes, status,
                  salary_type, base_salary_cents, overtime_rate_cents,
                  attendance_tracking_enabled, max_overtime_hours, leave_balance
      `;

      const updatedStaff = await tx.rawQueryRow(updateQuery, ...updateValues);

      if (!updatedStaff) {
        throw APIError.notFound("Staff record not found or could not be updated");
      }

      await tx.commit();

      return {
        id: updatedStaff.id,
        userId: updatedStaff.user_id,
        userName: existingStaff.display_name,
        userEmail: existingStaff.email,
        propertyId: updatedStaff.property_id,
        propertyName,
        department: updatedStaff.department,
        hourlyRateCents: parseInt(updatedStaff.hourly_rate_cents) || 0,
        performanceRating: parseFloat(updatedStaff.performance_rating) || 0,
        hireDate: updatedStaff.hire_date,
        notes: updatedStaff.notes,
        status: updatedStaff.status,
        // Enhanced fields
        salaryType: updatedStaff.salary_type || 'hourly',
        baseSalaryCents: parseInt(updatedStaff.base_salary_cents) || 0,
        overtimeRateCents: parseInt(updatedStaff.overtime_rate_cents) || 0,
        attendanceTrackingEnabled: updatedStaff.attendance_tracking_enabled || false,
        maxOvertimeHours: parseFloat(updatedStaff.max_overtime_hours) || 0,
        leaveBalance: parseInt(updatedStaff.leave_balance) || 0,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Update staff error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to update staff record");
    }
  }
);
