import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface GeneratePayslipRequest {
  staffId: number;
  payPeriodStart: Date;
  payPeriodEnd: Date;
  generatePDF?: boolean;
}

export interface Payslip {
  id: number;
  staffId: number;
  staffName: string;
  staffEmail: string;
  propertyName?: string;
  payPeriodStart: Date;
  payPeriodEnd: Date;
  baseSalaryCents: number;
  overtimePayCents: number;
  bonusCents: number;
  allowanceCents: number;
  deductionCents: number;
  totalEarningsCents: number;
  netPayCents: number;
  hoursWorked: number;
  overtimeHours: number;
  daysPresent: number;
  daysAbsent: number;
  leaveDays: number;
  status: string;
  pdfFilePath?: string;
  generatedAt?: Date;
  generatedByUserId?: number;
  createdAt: Date;
}

export interface GeneratePayslipResponse {
  payslip: Payslip;
  calculation: {
    grossEarnings: number;
    totalDeductions: number;
    netPay: number;
    attendanceRate: number;
  };
  message: string;
}

// Generates payslip for a staff member
export const generatePayslip = api<GeneratePayslipRequest, GeneratePayslipResponse>(
  { auth: true, expose: true, method: "POST", path: "/staff/generate-payslip" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const { staffId, payPeriodStart, payPeriodEnd, generatePDF = false } = req;

    // Validate date range
    if (payPeriodEnd <= payPeriodStart) {
      throw APIError.invalidArgument("Pay period end must be after start date");
    }

    const tx = await staffDB.begin();
    try {
      // Check if payslip already exists for this period
      const existingPayslip = await tx.queryRow`
        SELECT id, status FROM payslips
        WHERE org_id = ${authData.orgId} AND staff_id = ${staffId}
        AND pay_period_start = ${payPeriodStart} AND pay_period_end = ${payPeriodEnd}
      `;

      if (existingPayslip) {
        throw APIError.alreadyExists("Payslip already exists for this period");
      }

      // Get staff information
      const staff = await tx.queryRow`
        SELECT s.id, s.user_id, s.salary_type, s.base_salary_cents,
               s.hourly_rate_cents, s.overtime_rate_cents,
               u.display_name, u.email, s.property_id, p.name as property_name
        FROM staff s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN properties p ON s.property_id = p.id
        WHERE s.id = ${staffId} AND s.org_id = ${authData.orgId}
      `;

      if (!staff) {
        throw APIError.notFound("Staff record not found");
      }

      // Get active salary components for the period
      const salaryComponent = await tx.queryRow`
        SELECT base_salary_cents, hourly_rate_cents, overtime_rate_cents,
               bonus_cents, allowance_cents, deduction_cents
        FROM salary_components
        WHERE org_id = ${authData.orgId} AND staff_id = ${staffId} AND is_active = true
        AND effective_from <= ${payPeriodEnd}
        AND (effective_to IS NULL OR effective_to >= ${payPeriodStart})
        ORDER BY effective_from DESC
        LIMIT 1
      `;

      // Get attendance data for the period
      const attendanceData = await tx.queryRow`
        SELECT 
          COUNT(CASE WHEN status = 'present' THEN 1 END) as days_present,
          COUNT(CASE WHEN status = 'absent' THEN 1 END) as days_absent,
          COUNT(CASE WHEN status = 'leave' THEN 1 END) as leave_days,
          COALESCE(SUM(total_hours), 0) as total_hours,
          COALESCE(SUM(overtime_hours), 0) as overtime_hours
        FROM staff_attendance
        WHERE org_id = ${authData.orgId} AND staff_id = ${staffId}
        AND attendance_date >= ${payPeriodStart} AND attendance_date <= ${payPeriodEnd}
      `;

      // Calculate working days in period
      const workingDays = await tx.queryRow`
        SELECT COUNT(*) as working_days
        FROM generate_series(${payPeriodStart}::date, ${payPeriodEnd}::date, '1 day'::interval) as day
        WHERE EXTRACT(DOW FROM day) NOT IN (0, 6)  -- Exclude weekends
      `;

      const totalWorkingDays = parseInt(workingDays?.working_days || '0') || 0;
      const daysPresent = parseInt(attendanceData?.days_present || '0') || 0;
      const daysAbsent = parseInt(attendanceData?.days_absent || '0') || 0;
      const leaveDays = parseInt(attendanceData?.leave_days || '0') || 0;
      const totalHours = parseFloat(attendanceData?.total_hours || '0') || 0;
      const overtimeHours = parseFloat(attendanceData?.overtime_hours || '0') || 0;

      // Use salary component data if available, otherwise use staff defaults
      const baseSalaryCents = salaryComponent?.base_salary_cents || staff.base_salary_cents || 0;
      const hourlyRateCents = salaryComponent?.hourly_rate_cents || staff.hourly_rate_cents || 0;
      const overtimeRateCents = salaryComponent?.overtime_rate_cents || staff.overtime_rate_cents || 0;
      const bonusCents = salaryComponent?.bonus_cents || 0;
      const allowanceCents = salaryComponent?.allowance_cents || 0;
      const deductionCents = salaryComponent?.deduction_cents || 0;

      // Calculate base salary
      let calculatedBaseSalary = baseSalaryCents;
      if (baseSalaryCents === 0 && hourlyRateCents > 0) {
        calculatedBaseSalary = totalHours * hourlyRateCents;
      }

      // Calculate overtime pay
      const overtimePayCents = overtimeHours * overtimeRateCents;

      // Calculate totals
      const totalEarningsCents = calculatedBaseSalary + overtimePayCents + bonusCents + allowanceCents;
      const netPayCents = totalEarningsCents - deductionCents;

      // Calculate attendance rate
      const attendanceRate = totalWorkingDays > 0 ? (daysPresent / totalWorkingDays) * 100 : 0;

      // Generate PDF if requested (placeholder for now)
      let pdfFilePath: string | undefined;
      if (generatePDF) {
        pdfFilePath = `/payslips/${staffId}_${payPeriodStart.toISOString().split('T')[0]}_${payPeriodEnd.toISOString().split('T')[0]}.pdf`;
      }

      // Create payslip record
      const payslip = await tx.queryRow`
        INSERT INTO payslips (
          org_id, staff_id, pay_period_start, pay_period_end,
          base_salary_cents, overtime_pay_cents, bonus_cents,
          allowance_cents, deduction_cents, total_earnings_cents,
          net_pay_cents, hours_worked, overtime_hours,
          days_present, days_absent, leave_days, status,
          pdf_file_path, generated_at, generated_by_user_id,
          created_at
        ) VALUES (
          ${authData.orgId}, ${staffId}, ${payPeriodStart}, ${payPeriodEnd},
          ${calculatedBaseSalary}, ${overtimePayCents}, ${bonusCents},
          ${allowanceCents}, ${deductionCents}, ${totalEarningsCents},
          ${netPayCents}, ${totalHours}, ${overtimeHours},
          ${daysPresent}, ${daysAbsent}, ${leaveDays}, 'generated',
          ${pdfFilePath || null}, NOW(), ${parseInt(authData.userID)},
          NOW()
        )
        RETURNING id, staff_id, pay_period_start, pay_period_end,
                  base_salary_cents, overtime_pay_cents, bonus_cents,
                  allowance_cents, deduction_cents, total_earnings_cents,
                  net_pay_cents, hours_worked, overtime_hours,
                  days_present, days_absent, leave_days, status,
                  pdf_file_path, generated_at, generated_by_user_id, created_at
      `;

      if (!payslip) {
        throw new Error("Failed to create payslip");
      }

      await tx.commit();

      const payslipResponse: Payslip = {
        id: payslip.id,
        staffId: payslip.staff_id,
        staffName: staff.display_name,
        staffEmail: staff.email,
        propertyName: staff.property_name,
        payPeriodStart: payslip.pay_period_start,
        payPeriodEnd: payslip.pay_period_end,
        baseSalaryCents: payslip.base_salary_cents,
        overtimePayCents: payslip.overtime_pay_cents,
        bonusCents: payslip.bonus_cents,
        allowanceCents: payslip.allowance_cents,
        deductionCents: payslip.deduction_cents,
        totalEarningsCents: payslip.total_earnings_cents,
        netPayCents: payslip.net_pay_cents,
        hoursWorked: payslip.hours_worked,
        overtimeHours: payslip.overtime_hours,
        daysPresent: payslip.days_present,
        daysAbsent: payslip.days_absent,
        leaveDays: payslip.leave_days,
        status: payslip.status,
        pdfFilePath: payslip.pdf_file_path,
        generatedAt: payslip.generated_at,
        generatedByUserId: payslip.generated_by_user_id,
        createdAt: payslip.created_at,
      };

      return {
        payslip: payslipResponse,
        calculation: {
          grossEarnings: totalEarningsCents,
          totalDeductions: deductionCents,
          netPay: netPayCents,
          attendanceRate: Math.round(attendanceRate * 100) / 100,
        },
        message: `Payslip generated successfully for ${staff.display_name} for period ${payPeriodStart.toISOString().split('T')[0]} to ${payPeriodEnd.toISOString().split('T')[0]}`,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Generate payslip error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to generate payslip");
    }
  }
);
