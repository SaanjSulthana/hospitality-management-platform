import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface SalaryStatisticsRequest {
  propertyId?: number;
  startDate?: Date;
  endDate?: Date;
  groupBy?: 'month' | 'quarter' | 'year' | 'staff' | 'property';
}

export interface SalaryStatisticsResponse {
  overview: {
    totalPayslips: number;
    totalNetPay: number;
    averageNetPay: number;
    totalGrossEarnings: number;
    totalDeductions: number;
    totalOvertimePay: number;
    totalBonuses: number;
    totalAllowances: number;
  };
  byPeriod: {
    period: string;
    payslipCount: number;
    totalNetPay: number;
    averageNetPay: number;
    totalOvertimePay: number;
    totalBonuses: number;
  }[];
  byStaff: {
    staffId: number;
    staffName: string;
    propertyName?: string;
    payslipCount: number;
    totalNetPay: number;
    averageNetPay: number;
    totalOvertimePay: number;
    totalBonuses: number;
    averageHours: number;
  }[];
  byProperty: {
    propertyId: number;
    propertyName: string;
    payslipCount: number;
    totalNetPay: number;
    averageNetPay: number;
    totalOvertimePay: number;
    totalBonuses: number;
  }[];
  trends: {
    period: string;
    totalNetPay: number;
    payslipCount: number;
    averageNetPay: number;
  }[];
  topEarners: {
    staffId: number;
    staffName: string;
    propertyName?: string;
    totalNetPay: number;
    payslipCount: number;
    averageNetPay: number;
  }[];
  salaryDistribution: {
    range: string;
    count: number;
    percentage: number;
  }[];
  overtimeAnalysis: {
    totalOvertimeHours: number;
    totalOvertimePay: number;
    averageOvertimeHours: number;
    averageOvertimePay: number;
    staffWithOvertime: number;
  };
  bonusAnalysis: {
    totalBonuses: number;
    averageBonus: number;
    staffWithBonuses: number;
    maxBonus: number;
    minBonus: number;
  };
}

// Gets comprehensive salary statistics and analytics
export const getSalaryStatistics = api<SalaryStatisticsRequest, SalaryStatisticsResponse>(
  { auth: true, expose: true, method: "GET", path: "/staff/salary/statistics" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { propertyId, startDate, endDate, groupBy = 'month' } = req || {};

    try {
      // Build base WHERE clause
      let whereClause = `WHERE p.org_id = ${authData.orgId}`;
      const params: any[] = [authData.orgId];
      let paramIndex = 2;

      // Managers can only see statistics for their assigned properties
      if (authData.role === "MANAGER") {
        whereClause += ` AND (
          s.property_id IN (SELECT property_id FROM user_properties WHERE user_id = $${paramIndex})
          OR s.property_id IS NULL
        )`;
        params.push(parseInt(authData.userID));
        paramIndex++;
      }

      if (propertyId) {
        whereClause += ` AND s.property_id = $${paramIndex}`;
        params.push(propertyId);
        paramIndex++;
      }

      if (startDate) {
        whereClause += ` AND p.pay_period_start >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereClause += ` AND p.pay_period_end <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      // Get overview statistics
      const overview = await staffDB.rawQueryRow(
        `SELECT 
          COUNT(*) as total_payslips,
          COALESCE(SUM(p.net_pay_cents), 0) as total_net_pay,
          COALESCE(AVG(p.net_pay_cents), 0) as average_net_pay,
          COALESCE(SUM(p.total_earnings_cents), 0) as total_gross_earnings,
          COALESCE(SUM(p.deduction_cents), 0) as total_deductions,
          COALESCE(SUM(p.overtime_pay_cents), 0) as total_overtime_pay,
          COALESCE(SUM(p.bonus_cents), 0) as total_bonuses,
          COALESCE(SUM(p.allowance_cents), 0) as total_allowances
        FROM payslips p
        JOIN staff s ON p.staff_id = s.id
        ${whereClause}`,
        params
      );

      // Get statistics by period
      let periodQuery = '';
      switch (groupBy) {
        case 'month':
          periodQuery = `DATE_TRUNC('month', p.pay_period_start)`;
          break;
        case 'quarter':
          periodQuery = `DATE_TRUNC('quarter', p.pay_period_start)`;
          break;
        case 'year':
          periodQuery = `DATE_TRUNC('year', p.pay_period_start)`;
          break;
        default:
          periodQuery = `DATE_TRUNC('month', p.pay_period_start)`;
      }

      const byPeriod = await staffDB.rawQueryAll(
        `SELECT 
          ${periodQuery} as period,
          COUNT(*) as payslip_count,
          COALESCE(SUM(p.net_pay_cents), 0) as total_net_pay,
          COALESCE(AVG(p.net_pay_cents), 0) as average_net_pay,
          COALESCE(SUM(p.overtime_pay_cents), 0) as total_overtime_pay,
          COALESCE(SUM(p.bonus_cents), 0) as total_bonuses
        FROM payslips p
        JOIN staff s ON p.staff_id = s.id
        ${whereClause}
        GROUP BY ${periodQuery}
        ORDER BY period DESC`,
        params
      );

      // Get statistics by staff
      const byStaff = await staffDB.rawQueryAll(
        `SELECT 
          p.staff_id,
          u.display_name as staff_name,
          prop.name as property_name,
          COUNT(*) as payslip_count,
          COALESCE(SUM(p.net_pay_cents), 0) as total_net_pay,
          COALESCE(AVG(p.net_pay_cents), 0) as average_net_pay,
          COALESCE(SUM(p.overtime_pay_cents), 0) as total_overtime_pay,
          COALESCE(SUM(p.bonus_cents), 0) as total_bonuses,
          COALESCE(AVG(p.hours_worked), 0) as average_hours
        FROM payslips p
        JOIN staff s ON p.staff_id = s.id
        JOIN users u ON s.user_id = u.id
        LEFT JOIN properties prop ON s.property_id = prop.id
        ${whereClause}
        GROUP BY p.staff_id, u.display_name, prop.name
        ORDER BY total_net_pay DESC`,
        params
      );

      // Get statistics by property
      const byProperty = await staffDB.rawQueryAll(
        `SELECT 
          s.property_id,
          prop.name as property_name,
          COUNT(*) as payslip_count,
          COALESCE(SUM(p.net_pay_cents), 0) as total_net_pay,
          COALESCE(AVG(p.net_pay_cents), 0) as average_net_pay,
          COALESCE(SUM(p.overtime_pay_cents), 0) as total_overtime_pay,
          COALESCE(SUM(p.bonus_cents), 0) as total_bonuses
        FROM payslips p
        JOIN staff s ON p.staff_id = s.id
        LEFT JOIN properties prop ON s.property_id = prop.id
        ${whereClause}
        GROUP BY s.property_id, prop.name
        ORDER BY total_net_pay DESC`,
        params
      );

      // Get trends (last 12 months)
      const trends = await staffDB.rawQueryAll(
        `SELECT 
          DATE_TRUNC('month', p.pay_period_start) as period,
          COALESCE(SUM(p.net_pay_cents), 0) as total_net_pay,
          COUNT(*) as payslip_count,
          COALESCE(AVG(p.net_pay_cents), 0) as average_net_pay
        FROM payslips p
        JOIN staff s ON p.staff_id = s.id
        ${whereClause}
        AND p.pay_period_start >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', p.pay_period_start)
        ORDER BY period DESC`,
        params
      );

      // Get top earners
      const topEarners = await staffDB.rawQueryAll(
        `SELECT 
          p.staff_id,
          u.display_name as staff_name,
          prop.name as property_name,
          COALESCE(SUM(p.net_pay_cents), 0) as total_net_pay,
          COUNT(*) as payslip_count,
          COALESCE(AVG(p.net_pay_cents), 0) as average_net_pay
        FROM payslips p
        JOIN staff s ON p.staff_id = s.id
        JOIN users u ON s.user_id = u.id
        LEFT JOIN properties prop ON s.property_id = prop.id
        ${whereClause}
        GROUP BY p.staff_id, u.display_name, prop.name
        ORDER BY total_net_pay DESC
        LIMIT 10`,
        params
      );

      // Get salary distribution
      const salaryDistribution = await staffDB.rawQueryAll(
        `SELECT 
          CASE 
            WHEN p.net_pay_cents >= 1000000 THEN 'High (100k+)'
            WHEN p.net_pay_cents >= 500000 THEN 'Medium (50k-99k)'
            WHEN p.net_pay_cents >= 250000 THEN 'Low (25k-49k)'
            ELSE 'Very Low (<25k)'
          END as range,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
        FROM payslips p
        JOIN staff s ON p.staff_id = s.id
        ${whereClause}
        GROUP BY 
          CASE 
            WHEN p.net_pay_cents >= 1000000 THEN 'High (100k+)'
            WHEN p.net_pay_cents >= 500000 THEN 'Medium (50k-99k)'
            WHEN p.net_pay_cents >= 250000 THEN 'Low (25k-49k)'
            ELSE 'Very Low (<25k)'
          END
        ORDER BY count DESC`,
        params
      );

      // Get overtime analysis
      const overtimeAnalysis = await staffDB.rawQueryRow(
        `SELECT 
          COALESCE(SUM(p.overtime_hours), 0) as total_overtime_hours,
          COALESCE(SUM(p.overtime_pay_cents), 0) as total_overtime_pay,
          COALESCE(AVG(p.overtime_hours), 0) as average_overtime_hours,
          COALESCE(AVG(p.overtime_pay_cents), 0) as average_overtime_pay,
          COUNT(CASE WHEN p.overtime_hours > 0 THEN 1 END) as staff_with_overtime
        FROM payslips p
        JOIN staff s ON p.staff_id = s.id
        ${whereClause}`,
        params
      );

      // Get bonus analysis
      const bonusAnalysis = await staffDB.rawQueryRow(
        `SELECT 
          COALESCE(SUM(p.bonus_cents), 0) as total_bonuses,
          COALESCE(AVG(p.bonus_cents), 0) as average_bonus,
          COUNT(CASE WHEN p.bonus_cents > 0 THEN 1 END) as staff_with_bonuses,
          COALESCE(MAX(p.bonus_cents), 0) as max_bonus,
          COALESCE(MIN(p.bonus_cents), 0) as min_bonus
        FROM payslips p
        JOIN staff s ON p.staff_id = s.id
        ${whereClause}`,
        params
      );

      return {
        overview: {
          totalPayslips: parseInt(overview?.total_payslips || '0') || 0,
          totalNetPay: parseInt(overview?.total_net_pay || '0') || 0,
          averageNetPay: parseInt(overview?.average_net_pay || '0') || 0,
          totalGrossEarnings: parseInt(overview?.total_gross_earnings || '0') || 0,
          totalDeductions: parseInt(overview?.total_deductions || '0') || 0,
          totalOvertimePay: parseInt(overview?.total_overtime_pay || '0') || 0,
          totalBonuses: parseInt(overview?.total_bonuses || '0') || 0,
          totalAllowances: parseInt(overview?.total_allowances || '0') || 0,
        },
        byPeriod: byPeriod.map(period => ({
          period: period.period.toISOString().split('T')[0],
          payslipCount: parseInt(period.payslip_count) || 0,
          totalNetPay: parseInt(period.total_net_pay) || 0,
          averageNetPay: parseInt(period.average_net_pay) || 0,
          totalOvertimePay: parseInt(period.total_overtime_pay) || 0,
          totalBonuses: parseInt(period.total_bonuses) || 0,
        })),
        byStaff: byStaff.map(staff => ({
          staffId: staff.staff_id,
          staffName: staff.staff_name,
          propertyName: staff.property_name,
          payslipCount: parseInt(staff.payslip_count) || 0,
          totalNetPay: parseInt(staff.total_net_pay) || 0,
          averageNetPay: parseInt(staff.average_net_pay) || 0,
          totalOvertimePay: parseInt(staff.total_overtime_pay) || 0,
          totalBonuses: parseInt(staff.total_bonuses) || 0,
          averageHours: parseFloat(staff.average_hours) || 0,
        })),
        byProperty: byProperty.map(property => ({
          propertyId: property.property_id,
          propertyName: property.property_name || 'Unassigned',
          payslipCount: parseInt(property.payslip_count) || 0,
          totalNetPay: parseInt(property.total_net_pay) || 0,
          averageNetPay: parseInt(property.average_net_pay) || 0,
          totalOvertimePay: parseInt(property.total_overtime_pay) || 0,
          totalBonuses: parseInt(property.total_bonuses) || 0,
        })),
        trends: trends.map(trend => ({
          period: trend.period.toISOString().split('T')[0],
          totalNetPay: parseInt(trend.total_net_pay) || 0,
          payslipCount: parseInt(trend.payslip_count) || 0,
          averageNetPay: parseInt(trend.average_net_pay) || 0,
        })),
        topEarners: topEarners.map(earner => ({
          staffId: earner.staff_id,
          staffName: earner.staff_name,
          propertyName: earner.property_name,
          totalNetPay: parseInt(earner.total_net_pay) || 0,
          payslipCount: parseInt(earner.payslip_count) || 0,
          averageNetPay: parseInt(earner.average_net_pay) || 0,
        })),
        salaryDistribution: salaryDistribution.map(dist => ({
          range: dist.range,
          count: parseInt(dist.count) || 0,
          percentage: parseFloat(dist.percentage) || 0,
        })),
        overtimeAnalysis: {
          totalOvertimeHours: parseFloat(overtimeAnalysis?.total_overtime_hours || '0') || 0,
          totalOvertimePay: parseInt(overtimeAnalysis?.total_overtime_pay || '0') || 0,
          averageOvertimeHours: parseFloat(overtimeAnalysis?.average_overtime_hours || '0') || 0,
          averageOvertimePay: parseInt(overtimeAnalysis?.average_overtime_pay || '0') || 0,
          staffWithOvertime: parseInt(overtimeAnalysis?.staff_with_overtime || '0') || 0,
        },
        bonusAnalysis: {
          totalBonuses: parseInt(bonusAnalysis?.total_bonuses || '0') || 0,
          averageBonus: parseInt(bonusAnalysis?.average_bonus || '0') || 0,
          staffWithBonuses: parseInt(bonusAnalysis?.staff_with_bonuses || '0') || 0,
          maxBonus: parseInt(bonusAnalysis?.max_bonus || '0') || 0,
          minBonus: parseInt(bonusAnalysis?.min_bonus || '0') || 0,
        },
      };
    } catch (error) {
      console.error('Get salary statistics error:', error);
      throw APIError.internal("Failed to get salary statistics");
    }
  }
);
