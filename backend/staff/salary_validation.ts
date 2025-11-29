import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface ValidateSalaryRequest {
  staffId: number;
  payPeriodStart: Date;
  payPeriodEnd: Date;
}

export interface ValidateSalaryResponse {
  isValid: boolean;
  canGeneratePayslip: boolean;
  warnings: string[];
  errors: string[];
  salaryComponent?: {
    id: number;
    baseSalaryCents: number;
    hourlyRateCents: number;
    overtimeRateCents: number;
    effectiveFrom: Date;
    effectiveTo?: Date;
  };
  attendanceSummary?: {
    daysPresent: number;
    daysAbsent: number;
    totalHours: number;
    overtimeHours: number;
    attendanceRate: number;
  };
  estimatedSalary?: {
    baseSalary: number;
    overtimePay: number;
    totalEarnings: number;
    netPay: number;
  };
}

// Shared handler for validating salary calculation and providing guidance
async function validateSalaryHandler(req: ValidateSalaryRequest): Promise<ValidateSalaryResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN", "MANAGER")(authData);

    const { staffId, payPeriodStart, payPeriodEnd } = req;
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Validate date range
      if (payPeriodEnd <= payPeriodStart) {
        errors.push("Pay period end must be after start date");
      }

      // Get staff information
      const staff = await staffDB.queryRow`
        SELECT s.id, s.user_id, s.salary_type, s.base_salary_cents,
               s.hourly_rate_cents, s.overtime_rate_cents, s.status,
               u.display_name
        FROM staff s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ${staffId} AND s.org_id = ${authData.orgId}
      `;

      if (!staff) {
        errors.push("Staff record not found");
        return {
          isValid: false,
          canGeneratePayslip: false,
          warnings,
          errors,
        };
      }

      // Check if staff is active
      if (staff.status !== 'active') {
        errors.push("Staff member is not active");
      }

      // Managers can only validate salary for their assigned properties
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
          errors.push("No access to validate salary for this staff member");
        }
      }

      // Get active salary components for the period
      const salaryComponent = await staffDB.queryRow`
        SELECT id, base_salary_cents, hourly_rate_cents, overtime_rate_cents,
               effective_from, effective_to
        FROM salary_components
        WHERE org_id = ${authData.orgId} AND staff_id = ${staffId} AND is_active = true
        AND effective_from <= ${payPeriodEnd}
        AND (effective_to IS NULL OR effective_to >= ${payPeriodStart})
        ORDER BY effective_from DESC
        LIMIT 1
      `;

      if (!salaryComponent) {
        warnings.push("No active salary component found for this period");
      }

      // Get attendance data for the period
      const attendanceData = await staffDB.queryRow`
        SELECT 
          COUNT(CASE WHEN status = 'present' THEN 1 END) as days_present,
          COUNT(CASE WHEN status = 'absent' THEN 1 END) as days_absent,
          COALESCE(SUM(total_hours), 0) as total_hours,
          COALESCE(SUM(overtime_hours), 0) as overtime_hours
        FROM staff_attendance
        WHERE org_id = ${authData.orgId} AND staff_id = ${staffId}
        AND attendance_date >= ${payPeriodStart} AND attendance_date <= ${payPeriodEnd}
      `;

      const daysPresent = parseInt(attendanceData?.days_present || '0') || 0;
      const daysAbsent = parseInt(attendanceData?.days_absent || '0') || 0;
      const totalHours = parseFloat(attendanceData?.total_hours || '0') || 0;
      const overtimeHours = parseFloat(attendanceData?.overtime_hours || '0') || 0;

      // Calculate working days in period
      const workingDays = await staffDB.queryRow`
        SELECT COUNT(*) as working_days
        FROM generate_series(${payPeriodStart}::date, ${payPeriodEnd}::date, '1 day'::interval) as day
        WHERE EXTRACT(DOW FROM day) NOT IN (0, 6)  -- Exclude weekends
      `;

      const totalWorkingDays = parseInt(workingDays?.working_days || '0') || 0;
      const attendanceRate = totalWorkingDays > 0 ? (daysPresent / totalWorkingDays) * 100 : 0;

      // Check for low attendance
      if (attendanceRate < 50) {
        warnings.push(`Low attendance rate: ${attendanceRate.toFixed(1)}%`);
      }

      // Check for no attendance
      if (daysPresent === 0) {
        warnings.push("No attendance records found for this period");
      }

      // Check for future dates
      if (payPeriodStart > new Date()) {
        warnings.push("Pay period start is in the future");
      }

      // Check for overlapping payslips
      const existingPayslip = await staffDB.queryRow`
        SELECT id, status FROM payslips
        WHERE org_id = ${authData.orgId} AND staff_id = ${staffId}
        AND pay_period_start = ${payPeriodStart} AND pay_period_end = ${payPeriodEnd}
      `;

      if (existingPayslip) {
        errors.push(`Payslip already exists for this period (Status: ${existingPayslip.status})`);
      }

      // Calculate estimated salary if we have the data
      let estimatedSalary;
      if (salaryComponent) {
        const baseSalaryCents = salaryComponent.base_salary_cents || 0;
        const hourlyRateCents = salaryComponent.hourly_rate_cents || 0;
        const overtimeRateCents = salaryComponent.overtime_rate_cents || 0;

        let calculatedBaseSalary = baseSalaryCents;
        if (baseSalaryCents === 0 && hourlyRateCents > 0) {
          calculatedBaseSalary = totalHours * hourlyRateCents;
        }

        const overtimePay = overtimeHours * overtimeRateCents;
        const totalEarnings = calculatedBaseSalary + overtimePay;
        const netPay = totalEarnings; // Assuming no deductions for estimation

        estimatedSalary = {
          baseSalary: calculatedBaseSalary,
          overtimePay,
          totalEarnings,
          netPay,
        };
      }

      const isValid = errors.length === 0;
      const canGeneratePayslip = isValid && salaryComponent !== null;

      return {
        isValid,
        canGeneratePayslip,
        warnings,
        errors,
        salaryComponent: salaryComponent ? {
          id: salaryComponent.id,
          baseSalaryCents: salaryComponent.base_salary_cents,
          hourlyRateCents: salaryComponent.hourly_rate_cents,
          overtimeRateCents: salaryComponent.overtime_rate_cents,
          effectiveFrom: salaryComponent.effective_from,
          effectiveTo: salaryComponent.effective_to,
        } : undefined,
        attendanceSummary: {
          daysPresent,
          daysAbsent,
          totalHours,
          overtimeHours,
          attendanceRate: Math.round(attendanceRate * 100) / 100,
        },
        estimatedSalary,
      };
    } catch (error) {
      console.error('Validate salary error:', error);
      throw APIError.internal("Failed to validate salary");
    }
}

// LEGACY: Validates salary (keep for backward compatibility)
export const validateSalary = api<ValidateSalaryRequest, ValidateSalaryResponse>(
  { auth: true, expose: true, method: "POST", path: "/staff/salary/validate" },
  validateSalaryHandler
);

// V1: Validates salary
export const validateSalaryV1 = api<ValidateSalaryRequest, ValidateSalaryResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/staff/salary/validate" },
  validateSalaryHandler
);
