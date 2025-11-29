import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface GetLeaveBalanceRequest {
  staffId: number;
}

export interface LeaveBalance {
  staffId: number;
  staffName: string;
  staffEmail: string;
  currentBalance: number;
  usedLeave: {
    annual: number;
    sick: number;
    emergency: number;
    personal: number;
    total: number;
  };
  remainingBalance: number;
  lastUpdated: Date;
}

export interface GetLeaveBalanceResponse {
  balance: LeaveBalance;
  summary: {
    totalLeaveDays: number;
    usedLeaveDays: number;
    remainingLeaveDays: number;
    utilizationRate: number;
  };
}

export interface UpdateLeaveBalanceRequest {
  staffId: number;
  newBalance: number;
  reason: string;
}

export interface UpdateLeaveBalanceResponse {
  success: boolean;
  staffId: number;
  oldBalance: number;
  newBalance: number;
  reason: string;
  updatedAt: Date;
  message: string;
}

// Shared handler for getting leave balance
async function getLeaveBalanceHandler(req: GetLeaveBalanceRequest): Promise<GetLeaveBalanceResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { staffId } = req;

    try {
      // Get staff information
      const staff = await staffDB.queryRow`
        SELECT s.id, s.user_id, s.leave_balance, s.updated_at,
               u.display_name, u.email
        FROM staff s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ${staffId} AND s.org_id = ${authData.orgId}
      `;

      if (!staff) {
        throw APIError.notFound("Staff record not found");
      }

      // Staff can only view their own leave balance
      if (authData.role === "MANAGER" && authData.userID) {
        if (parseInt(staff.user_id) !== parseInt(authData.userID)) {
          throw APIError.permissionDenied("You can only view your own leave balance");
        }
      }

      // Managers can only view leave balance for their assigned properties
      if (authData.role === "MANAGER") {
        const accessCheck = await staffDB.queryRow`
          SELECT 1 FROM staff s
          WHERE s.id = ${staffId} AND s.org_id = ${authData.orgId}
          AND (
            s.property_id IN (SELECT property_id FROM user_properties WHERE user_id = ${parseInt(authData.userID)})
            OR s.property_id IS NULL
          )
        `;

        if (!accessCheck) {
          throw APIError.permissionDenied("No access to view leave balance for this staff member");
        }
      }

      // Get used leave by type
      const usedLeave = await staffDB.queryRow`
        SELECT 
          COALESCE(SUM(
            CASE 
              WHEN leave_type = 'annual' AND status = 'approved' 
              THEN EXTRACT(DAY FROM (end_date - start_date)) + 1
              ELSE 0
            END
          ), 0) as annual_leave,
          COALESCE(SUM(
            CASE 
              WHEN leave_type = 'sick' AND status = 'approved' 
              THEN EXTRACT(DAY FROM (end_date - start_date)) + 1
              ELSE 0
            END
          ), 0) as sick_leave,
          COALESCE(SUM(
            CASE 
              WHEN leave_type = 'emergency' AND status = 'approved' 
              THEN EXTRACT(DAY FROM (end_date - start_date)) + 1
              ELSE 0
            END
          ), 0) as emergency_leave,
          COALESCE(SUM(
            CASE 
              WHEN leave_type = 'personal' AND status = 'approved' 
              THEN EXTRACT(DAY FROM (end_date - start_date)) + 1
              ELSE 0
            END
          ), 0) as personal_leave
        FROM leave_requests
        WHERE org_id = ${authData.orgId} AND staff_id = ${staffId}
        AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM CURRENT_DATE)
      `;

      const annualLeave = parseInt(usedLeave?.annual_leave || '0') || 0;
      const sickLeave = parseInt(usedLeave?.sick_leave || '0') || 0;
      const emergencyLeave = parseInt(usedLeave?.emergency_leave || '0') || 0;
      const personalLeave = parseInt(usedLeave?.personal_leave || '0') || 0;
      const totalUsedLeave = annualLeave + sickLeave + emergencyLeave + personalLeave;

      const currentBalance = staff.leave_balance;
      const remainingBalance = currentBalance - totalUsedLeave;
      const utilizationRate = currentBalance > 0 ? (totalUsedLeave / currentBalance) * 100 : 0;

      return {
        balance: {
          staffId: staff.id,
          staffName: staff.display_name,
          staffEmail: staff.email,
          currentBalance,
          usedLeave: {
            annual: annualLeave,
            sick: sickLeave,
            emergency: emergencyLeave,
            personal: personalLeave,
            total: totalUsedLeave,
          },
          remainingBalance,
          lastUpdated: staff.updated_at,
        },
        summary: {
          totalLeaveDays: currentBalance,
          usedLeaveDays: totalUsedLeave,
          remainingLeaveDays: remainingBalance,
          utilizationRate: Math.round(utilizationRate * 100) / 100,
        },
      };
    } catch (error) {
      console.error('Get leave balance error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to get leave balance");
    }
}

// LEGACY: Gets leave balance (keep for backward compatibility)
export const getLeaveBalance = api<GetLeaveBalanceRequest, GetLeaveBalanceResponse>(
  { auth: true, expose: true, method: "GET", path: "/staff/:staffId/leave-balance" },
  getLeaveBalanceHandler
);

// V1: Gets leave balance
export const getLeaveBalanceV1 = api<GetLeaveBalanceRequest, GetLeaveBalanceResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/staff/:staffId/leave-balance" },
  getLeaveBalanceHandler
);

// Shared handler for updating leave balance
async function updateLeaveBalanceHandler(req: UpdateLeaveBalanceRequest): Promise<UpdateLeaveBalanceResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const { staffId, newBalance, reason } = req;

    const tx = await staffDB.begin();
    try {
      // Get current staff information
      const staff = await tx.queryRow`
        SELECT id, leave_balance, user_id, updated_at
        FROM staff
        WHERE id = ${staffId} AND org_id = ${authData.orgId}
      `;

      if (!staff) {
        throw APIError.notFound("Staff record not found");
      }

      const oldBalance = staff.leave_balance;

      // Update leave balance
      const updatedStaff = await tx.queryRow`
        UPDATE staff 
        SET 
          leave_balance = ${newBalance},
          updated_at = NOW()
        WHERE id = ${staffId} AND org_id = ${authData.orgId}
        RETURNING id, leave_balance, updated_at
      `;

      if (!updatedStaff) {
        throw APIError.notFound("Staff record not found or could not be updated");
      }

      await tx.commit();

      return {
        success: true,
        staffId: updatedStaff.id,
        oldBalance,
        newBalance: updatedStaff.leave_balance,
        reason,
        updatedAt: updatedStaff.updated_at,
        message: `Leave balance updated from ${oldBalance} to ${updatedStaff.leave_balance} days`,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Update leave balance error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to update leave balance");
    }
}

// LEGACY: Updates leave balance (keep for backward compatibility)
export const updateLeaveBalance = api<UpdateLeaveBalanceRequest, UpdateLeaveBalanceResponse>(
  { auth: true, expose: true, method: "PUT", path: "/staff/:staffId/leave-balance" },
  updateLeaveBalanceHandler
);

// V1: Updates leave balance
export const updateLeaveBalanceV1 = api<UpdateLeaveBalanceRequest, UpdateLeaveBalanceResponse>(
  { auth: true, expose: true, method: "PUT", path: "/v1/staff/:staffId/leave-balance" },
  updateLeaveBalanceHandler
);
