import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface ValidateLeaveRequest {
  staffId: number;
  leaveType: 'annual' | 'sick' | 'emergency' | 'personal';
  startDate: Date;
  endDate: Date;
  reason: string;
}

export interface ValidateLeaveResponse {
  isValid: boolean;
  canCreateLeave: boolean;
  warnings: string[];
  errors: string[];
  conflicts?: {
    leaveRequestId: number;
    startDate: Date;
    endDate: Date;
    status: string;
  }[];
  leaveBalance?: {
    currentBalance: number;
    requestedDays: number;
    remainingBalance: number;
    isSufficient: boolean;
  };
  businessRules?: {
    isWeekend: boolean;
    isHoliday: boolean;
    isEmergency: boolean;
    maxConsecutiveDays: number;
    minNoticePeriod: number;
  };
}

// Shared handler for validating leave request creation and providing guidance
async function validateLeaveRequestHandler(req: ValidateLeaveRequest): Promise<ValidateLeaveResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN", "MANAGER")(authData);

    const { staffId, leaveType, startDate, endDate, reason } = req;
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Validate date range
      if (endDate <= startDate) {
        errors.push("End date must be after start date");
      }

      // Get staff information
      const staff = await staffDB.queryRow`
        SELECT s.id, s.user_id, s.leave_balance, s.status,
               u.display_name
        FROM staff s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ${staffId} AND s.org_id = ${authData.orgId}
      `;

      if (!staff) {
        errors.push("Staff record not found");
        return {
          isValid: false,
          canCreateLeave: false,
          warnings,
          errors,
        };
      }

      // Check if staff is active
      if (staff.status !== 'active') {
        errors.push("Staff member is not active");
      }

      // Staff can only validate leave requests for themselves
      if (authData.role === "MANAGER" && authData.userID) {
        if (parseInt(staff.user_id) !== parseInt(authData.userID)) {
          errors.push("You can only validate leave requests for yourself");
        }
      }

      // Managers can only validate leave requests for their assigned properties
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
          errors.push("No access to validate leave requests for this staff member");
        }
      }

      // Check for overlapping leave requests
      const conflicts = await staffDB.queryAll`
        SELECT id, start_date, end_date, status
        FROM leave_requests
        WHERE org_id = ${authData.orgId} AND staff_id = ${staffId}
        AND status IN ('pending', 'approved')
        AND (
          (start_date <= ${endDate} AND end_date >= ${startDate})
        )
      `;

      if (conflicts.length > 0) {
        errors.push(`Found ${conflicts.length} conflicting leave request(s)`);
      }

      // Calculate leave days
      const requestedDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const currentBalance = staff.leave_balance;
      const remainingBalance = currentBalance - requestedDays;
      const isSufficient = remainingBalance >= 0;

      if (!isSufficient && leaveType === 'annual') {
        errors.push(`Insufficient leave balance. Current: ${currentBalance} days, Requested: ${requestedDays} days`);
      }

      // Check for weekend leave
      const startDay = startDate.getDay();
      const endDay = endDate.getDay();
      if (startDay === 0 || startDay === 6 || endDay === 0 || endDay === 6) {
        warnings.push("Leave period includes weekend days");
      }

      // Check for holiday leave (simplified check)
      const startMonth = startDate.getMonth() + 1;
      const startDayOfMonth = startDate.getDate();
      const endMonth = endDate.getMonth() + 1;
      const endDayOfMonth = endDate.getDate();
      
      if ((startMonth === 1 && startDayOfMonth === 1) || (endMonth === 1 && endDayOfMonth === 1) ||
          (startMonth === 12 && startDayOfMonth === 25) || (endMonth === 12 && endDayOfMonth === 25)) {
        warnings.push("Leave period includes holiday");
      }

      // Check for future dates
      if (startDate < new Date()) {
        warnings.push("Leave start date is in the past");
      }

      // Check notice period
      const noticePeriod = (startDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
      const minNoticePeriod = leaveType === 'emergency' ? 0 : 2; // 2 days notice for non-emergency

      if (noticePeriod < minNoticePeriod && leaveType !== 'emergency') {
        warnings.push(`Leave request should be submitted at least ${minNoticePeriod} days in advance`);
      }

      // Check for consecutive long leave
      if (requestedDays > 10) {
        warnings.push("Long leave period requested (more than 10 days)");
      }

      // Check for emergency leave
      const isEmergency = leaveType === 'emergency';
      if (isEmergency && !reason.toLowerCase().includes('emergency')) {
        warnings.push("Reason should indicate emergency nature");
      }

      // Check for sick leave
      if (leaveType === 'sick' && requestedDays > 3) {
        warnings.push("Sick leave longer than 3 days may require medical certificate");
      }

      // Check for annual leave during peak season (simplified)
      const peakStartMonth = startDate.getMonth() + 1;
      if (leaveType === 'annual' && (peakStartMonth === 12 || peakStartMonth === 1)) {
        warnings.push("Annual leave during peak season may have restrictions");
      }

      // Check for too many leave requests in a month
      const monthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
      
      const monthlyRequests = await staffDB.queryRow`
        SELECT COUNT(*) as request_count
        FROM leave_requests
        WHERE org_id = ${authData.orgId} AND staff_id = ${staffId}
        AND start_date >= ${monthStart} AND start_date <= ${monthEnd}
        AND status IN ('pending', 'approved')
      `;

      const monthlyCount = parseInt(monthlyRequests?.request_count || '0') || 0;
      if (monthlyCount >= 3) {
        warnings.push("Multiple leave requests in the same month");
      }

      // Check for leave during scheduled shifts
      const scheduledShifts = await staffDB.queryRow`
        SELECT COUNT(*) as shift_count
        FROM staff_schedules
        WHERE org_id = ${authData.orgId} AND staff_id = ${staffId}
        AND schedule_date >= ${startDate} AND schedule_date <= ${endDate}
        AND status IN ('scheduled', 'in_progress')
      `;

      const shiftCount = parseInt(scheduledShifts?.shift_count || '0') || 0;
      if (shiftCount > 0) {
        warnings.push(`Leave period conflicts with ${shiftCount} scheduled shift(s)`);
      }

      const isValid = errors.length === 0;
      const canCreateLeave = isValid && conflicts.length === 0;

      return {
        isValid,
        canCreateLeave,
        warnings,
        errors,
        conflicts: conflicts.map(conflict => ({
          leaveRequestId: conflict.id,
          startDate: conflict.start_date,
          endDate: conflict.end_date,
          status: conflict.status,
        })),
        leaveBalance: {
          currentBalance,
          requestedDays,
          remainingBalance,
          isSufficient,
        },
        businessRules: {
          isWeekend: startDay === 0 || startDay === 6 || endDay === 0 || endDay === 6,
          isHoliday: (startMonth === 1 && startDayOfMonth === 1) || (startMonth === 12 && startDayOfMonth === 25),
          isEmergency,
          maxConsecutiveDays: 30, // Maximum consecutive leave days
          minNoticePeriod,
        },
      };
    } catch (error) {
      console.error('Validate leave request error:', error);
      throw APIError.internal("Failed to validate leave request");
    }
}

// LEGACY: Validates leave request creation and provides guidance (keep for backward compatibility)
export const validateLeaveRequest = api<ValidateLeaveRequest, ValidateLeaveResponse>(
  { auth: true, expose: true, method: "POST", path: "/staff/leave/validate" },
  validateLeaveRequestHandler
);

// V1: Validates leave request creation and provides guidance
export const validateLeaveRequestV1 = api<ValidateLeaveRequest, ValidateLeaveResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/staff/leave/validate" },
  validateLeaveRequestHandler
);
