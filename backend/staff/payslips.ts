import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface ListPayslipsRequest {
  staffId?: number;
  propertyId?: number;
  status?: 'draft' | 'generated' | 'paid';
  payPeriodStart?: Date;
  payPeriodEnd?: Date;
  page?: number;
  limit?: number;
}

export interface PayslipSummary {
  id: number;
  staffId: number;
  staffName: string;
  staffEmail: string;
  propertyName?: string;
  payPeriodStart: Date;
  payPeriodEnd: Date;
  netPayCents: number;
  status: string;
  generatedAt?: Date;
  createdAt: Date;
}

export interface ListPayslipsResponse {
  payslips: PayslipSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    totalPayslips: number;
    totalNetPay: number;
    averageNetPay: number;
    generatedCount: number;
    paidCount: number;
    draftCount: number;
  };
}

export interface GetPayslipRequest {
  payslipId: number;
}

export interface PayslipDetail {
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

export interface GetPayslipResponse {
  payslip: PayslipDetail;
}

export interface UpdatePayslipStatusRequest {
  payslipId: number;
  status: 'draft' | 'generated' | 'paid';
  notes?: string;
}

export interface UpdatePayslipStatusResponse {
  success: boolean;
  payslipId: number;
  status: string;
  updatedAt: Date;
  message: string;
}

// Lists payslips with filtering and pagination
export const listPayslips = api<ListPayslipsRequest, ListPayslipsResponse>(
  { auth: true, expose: true, method: "GET", path: "/staff/payslips" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { 
      staffId, 
      propertyId, 
      status, 
      payPeriodStart, 
      payPeriodEnd, 
      page = 1, 
      limit = 20 
    } = req || {};

    // Validate pagination parameters
    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit));
    const offset = (pageNum - 1) * limitNum;

    try {
      // Build base query
      let baseQuery = `
        SELECT 
          p.id, p.staff_id, p.pay_period_start, p.pay_period_end,
          p.net_pay_cents, p.status, p.generated_at, p.created_at,
          u.display_name as staff_name, u.email as staff_email,
          s.property_id, prop.name as property_name
        FROM payslips p
        JOIN staff s ON p.staff_id = s.id AND s.org_id = $1
        JOIN users u ON s.user_id = u.id AND u.org_id = $1
        LEFT JOIN properties prop ON s.property_id = prop.id AND prop.org_id = $1
        WHERE p.org_id = $1
      `;
      const params: any[] = [authData.orgId];
      let paramIndex = 2;

      // Managers can only see payslips for their assigned properties
      if (authData.role === "MANAGER") {
        baseQuery += ` AND (
          s.property_id IN (SELECT property_id FROM user_properties WHERE user_id = $${paramIndex})
          OR s.property_id IS NULL
        )`;
        params.push(parseInt(authData.userID));
        paramIndex++;
      }

      // Apply filters
      if (staffId) {
        baseQuery += ` AND p.staff_id = $${paramIndex}`;
        params.push(staffId);
        paramIndex++;
      }

      if (propertyId) {
        baseQuery += ` AND s.property_id = $${paramIndex}`;
        params.push(propertyId);
        paramIndex++;
      }

      if (status) {
        baseQuery += ` AND p.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (payPeriodStart) {
        baseQuery += ` AND p.pay_period_start >= $${paramIndex}`;
        params.push(payPeriodStart);
        paramIndex++;
      }

      if (payPeriodEnd) {
        baseQuery += ` AND p.pay_period_end <= $${paramIndex}`;
        params.push(payPeriodEnd);
        paramIndex++;
      }

      // Get total count for pagination
      const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as count_query`;
      const countResult = await staffDB.rawQueryRow(countQuery, ...params);
      const total = parseInt(countResult?.total || '0') || 0;
      const totalPages = Math.ceil(total / limitNum);

      // Apply sorting and pagination
      baseQuery += ` ORDER BY p.pay_period_start DESC, p.created_at DESC`;
      baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limitNum, offset);

      const payslips = await staffDB.rawQueryAll(baseQuery, ...params);

      // Get summary statistics
      let summaryQuery = `
        SELECT 
          COUNT(*) as total_payslips,
          COALESCE(SUM(net_pay_cents), 0) as total_net_pay,
          COALESCE(AVG(net_pay_cents), 0) as average_net_pay,
          COUNT(CASE WHEN status = 'generated' THEN 1 END) as generated_count,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
          COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count
        FROM payslips p
        JOIN staff s ON p.staff_id = s.id
        WHERE p.org_id = $1
      `;
      
      const summaryParams: any[] = [authData.orgId];
      let summaryParamIndex = 2;

      // Apply same filters for summary
      if (authData.role === "MANAGER") {
        summaryQuery += ` AND (
          s.property_id IN (SELECT property_id FROM user_properties WHERE user_id = $${summaryParamIndex})
          OR s.property_id IS NULL
        )`;
        summaryParams.push(parseInt(authData.userID));
        summaryParamIndex++;
      }

      if (staffId) {
        summaryQuery += ` AND p.staff_id = $${summaryParamIndex}`;
        summaryParams.push(staffId);
        summaryParamIndex++;
      }

      if (propertyId) {
        summaryQuery += ` AND s.property_id = $${summaryParamIndex}`;
        summaryParams.push(propertyId);
        summaryParamIndex++;
      }

      if (status) {
        summaryQuery += ` AND p.status = $${summaryParamIndex}`;
        summaryParams.push(status);
        summaryParamIndex++;
      }

      if (payPeriodStart) {
        summaryQuery += ` AND p.pay_period_start >= $${summaryParamIndex}`;
        summaryParams.push(payPeriodStart);
        summaryParamIndex++;
      }

      if (payPeriodEnd) {
        summaryQuery += ` AND p.pay_period_end <= $${summaryParamIndex}`;
        summaryParams.push(payPeriodEnd);
        summaryParamIndex++;
      }

      const summary = await staffDB.rawQueryRow(summaryQuery, ...summaryParams);

      return {
        payslips: payslips.map((payslip) => ({
          id: payslip.id,
          staffId: payslip.staff_id,
          staffName: payslip.staff_name,
          staffEmail: payslip.staff_email,
          propertyName: payslip.property_name,
          payPeriodStart: payslip.pay_period_start,
          payPeriodEnd: payslip.pay_period_end,
          netPayCents: payslip.net_pay_cents,
          status: payslip.status,
          generatedAt: payslip.generated_at,
          createdAt: payslip.created_at,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
        },
        summary: {
          totalPayslips: parseInt(summary?.total_payslips || '0') || 0,
          totalNetPay: parseInt(summary?.total_net_pay || '0') || 0,
          averageNetPay: parseInt(summary?.average_net_pay || '0') || 0,
          generatedCount: parseInt(summary?.generated_count || '0') || 0,
          paidCount: parseInt(summary?.paid_count || '0') || 0,
          draftCount: parseInt(summary?.draft_count || '0') || 0,
        },
      };
    } catch (error) {
      console.error('List payslips error:', error);
      throw APIError.internal("Failed to fetch payslips");
    }
  }
);

// Gets detailed payslip information
export const getPayslip = api<GetPayslipRequest, GetPayslipResponse>(
  { auth: true, expose: true, method: "GET", path: "/staff/payslips/:payslipId" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { payslipId } = req;

    try {
      const payslip = await staffDB.queryRow`
        SELECT 
          p.id, p.staff_id, p.pay_period_start, p.pay_period_end,
          p.base_salary_cents, p.overtime_pay_cents, p.bonus_cents,
          p.allowance_cents, p.deduction_cents, p.total_earnings_cents,
          p.net_pay_cents, p.hours_worked, p.overtime_hours,
          p.days_present, p.days_absent, p.leave_days, p.status,
          p.pdf_file_path, p.generated_at, p.generated_by_user_id, p.created_at,
          u.display_name as staff_name, u.email as staff_email,
          s.property_id, prop.name as property_name
        FROM payslips p
        JOIN staff s ON p.staff_id = s.id AND s.org_id = ${authData.orgId}
        JOIN users u ON s.user_id = u.id AND u.org_id = ${authData.orgId}
        LEFT JOIN properties prop ON s.property_id = prop.id AND prop.org_id = ${authData.orgId}
        WHERE p.id = ${payslipId} AND p.org_id = ${authData.orgId}
      `;

      if (!payslip) {
        throw APIError.notFound("Payslip not found");
      }

      // Managers can only see payslips for their assigned properties
      if (authData.role === "MANAGER") {
        const accessCheck = await staffDB.queryRow`
          SELECT 1 FROM staff s
          WHERE s.id = ${payslip.staff_id} AND s.org_id = ${authData.orgId}
          AND (
            s.property_id IN (SELECT property_id FROM user_properties WHERE user_id = ${parseInt(authData.userID)})
            OR s.property_id IS NULL
          )
        `;

        if (!accessCheck) {
          throw APIError.permissionDenied("No access to this payslip");
        }
      }

      return {
        payslip: {
          id: payslip.id,
          staffId: payslip.staff_id,
          staffName: payslip.staff_name,
          staffEmail: payslip.staff_email,
          propertyName: payslip.property_name,
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
        },
      };
    } catch (error) {
      console.error('Get payslip error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to fetch payslip");
    }
  }
);

// Updates payslip status
export const updatePayslipStatus = api<UpdatePayslipStatusRequest, UpdatePayslipStatusResponse>(
  { auth: true, expose: true, method: "PUT", path: "/staff/payslips/:payslipId/status" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const { payslipId, status, notes } = req;

    const tx = await staffDB.begin();
    try {
      // Verify payslip exists
      const existingPayslip = await tx.queryRow`
        SELECT id, status, staff_id FROM payslips
        WHERE id = ${payslipId} AND org_id = ${authData.orgId}
      `;

      if (!existingPayslip) {
        throw APIError.notFound("Payslip not found");
      }

      // Update payslip status
      const updatedPayslip = await tx.queryRow`
        UPDATE payslips 
        SET 
          status = ${status},
          updated_at = NOW()
        WHERE id = ${payslipId} AND org_id = ${authData.orgId}
        RETURNING id, status, updated_at
      `;

      if (!updatedPayslip) {
        throw APIError.notFound("Payslip not found or could not be updated");
      }

      await tx.commit();

      return {
        success: true,
        payslipId: updatedPayslip.id,
        status: updatedPayslip.status,
        updatedAt: updatedPayslip.updated_at,
        message: `Payslip status updated to ${status}`,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Update payslip status error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to update payslip status");
    }
  }
);
