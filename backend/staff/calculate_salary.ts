import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface CalculateSalaryRequest {
  staffId: number;
  payPeriodStart: Date;
  payPeriodEnd: Date;
  includeOvertime?: boolean;
  includeBonuses?: boolean;
  includeAllowances?: boolean;
  includeDeductions?: boolean;
}

export interface SalaryCalculation {
  staffId: number;
  staffName: string;
  payPeriodStart: Date;
  payPeriodEnd: Date;
  baseSalary: {
    type: 'monthly' | 'hourly';
    amount: number;
    hours?: number;
  };
  overtime: {
    hours: number;
    rate: number;
    amount: number;
  };
  bonuses: {
    amount: number;
    description?: string;
  };
  allowances: {
    amount: number;
    description?: string;
  };
  deductions: {
    amount: number;
    description?: string;
  };
  totals: {
    grossEarnings: number;
    totalDeductions: number;
    netPay: number;
  };
  attendance: {
    daysPresent: number;
    daysAbsent: number;
    totalHours: number;
    overtimeHours: number;
    leaveDays: number;
  };
}

export interface CalculateSalaryResponse {
  calculation: SalaryCalculation;
  breakdown: {
    period: string;
    workingDays: number;
    actualDays: number;
    attendanceRate: number;
    hourlyRate: number;
    overtimeRate: number;
  };
}

// Calculates salary based on attendance and salary components
export const calculateSalary = api<CalculateSalaryRequest, CalculateSalaryResponse>(
  { auth: true, expose: true, method: "POST", path: "/staff/calculate-salary" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { 
      staffId, 
      payPeriodStart, 
      payPeriodEnd, 
      includeOvertime = true,
      includeBonuses = true,
      includeAllowances = true,
      includeDeductions = true
    } = req;

    // Validate date range
    if (payPeriodEnd <= payPeriodStart) {
      throw APIError.invalidArgument("Pay period end must be after start date");
    }

    const tx = await staffDB.begin();
    try {
      // Get staff information
      const staff = await tx.queryRow`
        SELECT s.id, s.user_id, s.salary_type, s.base_salary_cents,
               s.hourly_rate_cents, s.overtime_rate_cents,
               u.display_name, u.email
        FROM staff s
        JOIN users u ON s.user_id = u.id
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

      // Determine salary type and calculate base salary
      let baseSalary: { type: 'monthly' | 'hourly'; amount: number; hours?: number };
      
      if (baseSalaryCents > 0) {
        // Monthly salary
        baseSalary = {
          type: 'monthly',
          amount: baseSalaryCents,
        };
      } else if (hourlyRateCents > 0) {
        // Hourly salary
        const hourlyAmount = totalHours * hourlyRateCents;
        baseSalary = {
          type: 'hourly',
          amount: hourlyAmount,
          hours: totalHours,
        };
      } else {
        baseSalary = {
          type: 'monthly',
          amount: 0,
        };
      }

      // Calculate overtime
      const overtime = {
        hours: overtimeHours,
        rate: overtimeRateCents,
        amount: includeOvertime ? overtimeHours * overtimeRateCents : 0,
      };

      // Calculate bonuses
      const bonuses = {
        amount: includeBonuses ? bonusCents : 0,
        description: 'Monthly bonus',
      };

      // Calculate allowances
      const allowances = {
        amount: includeAllowances ? allowanceCents : 0,
        description: 'Monthly allowance',
      };

      // Calculate deductions
      const deductions = {
        amount: includeDeductions ? deductionCents : 0,
        description: 'Monthly deductions',
      };

      // Calculate totals
      const grossEarnings = baseSalary.amount + overtime.amount + bonuses.amount + allowances.amount;
      const totalDeductions = deductions.amount;
      const netPay = grossEarnings - totalDeductions;

      // Calculate attendance rate
      const attendanceRate = totalWorkingDays > 0 ? (daysPresent / totalWorkingDays) * 100 : 0;

      await tx.commit();

      const calculation: SalaryCalculation = {
        staffId,
        staffName: staff.display_name,
        payPeriodStart,
        payPeriodEnd,
        baseSalary,
        overtime,
        bonuses,
        allowances,
        deductions,
        totals: {
          grossEarnings,
          totalDeductions,
          netPay,
        },
        attendance: {
          daysPresent,
          daysAbsent,
          totalHours,
          overtimeHours,
          leaveDays,
        },
      };

      const breakdown = {
        period: `${payPeriodStart.toISOString().split('T')[0]} to ${payPeriodEnd.toISOString().split('T')[0]}`,
        workingDays: totalWorkingDays,
        actualDays: daysPresent,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
        hourlyRate: hourlyRateCents,
        overtimeRate: overtimeRateCents,
      };

      return {
        calculation,
        breakdown,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Calculate salary error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to calculate salary");
    }
  }
);
