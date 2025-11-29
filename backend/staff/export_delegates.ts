/**
 * Staff Export Delegates
 * Refactored staff export endpoints that delegate to the documents service
 * Completes previously stubbed Excel/PDF generation
 */

import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";
import * as documents from "../documents/encore.service";
import { v1Path } from "../shared/http";

interface ExportResponse {
  exportId: string;
  status: 'queued';
  estimatedSeconds: number;
  statusUrl: string;
  downloadUrl: string;
  recordCount: number;
}

interface ExportLeaveRequest {
  staffId?: number;
  propertyId?: number;
  leaveType?: 'annual' | 'sick' | 'emergency' | 'personal';
  status?: 'pending' | 'approved' | 'rejected';
  startDate?: Date;
  endDate?: Date;
  format: 'csv' | 'xlsx' | 'pdf';
  includeBalance?: boolean;
}

interface ExportAttendanceRequest {
  staffId?: number;
  propertyId?: number;
  startDate?: Date;
  endDate?: Date;
  status?: 'present' | 'absent' | 'late' | 'half_day';
  format: 'csv' | 'xlsx' | 'pdf';
}

interface ExportSalaryRequest {
  staffId?: number;
  propertyId?: number;
  payPeriodStart?: Date;
  payPeriodEnd?: Date;
  format: 'csv' | 'xlsx' | 'pdf';
  includePayslips?: boolean;
  includeComponents?: boolean;
}

/**
 * Export leave records
 */
async function exportLeaveHandler(req: ExportLeaveRequest): Promise<ExportResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { format, ...filters } = req;

    // Fetch leave data
    const leaveData = await fetchLeaveData(authData.orgId, authData, filters);

    // Handle CSV export locally (keep existing logic)
    if (format === 'csv') {
      // Return CSV immediately (not delegating to documents service for CSV)
      throw APIError.unimplemented("CSV export not yet migrated to new system");
    }

    // Delegate to documents service for Excel/PDF
    const exportResponse = await documents.createExport({
      exportType: 'staff-leave',
      format: format as 'xlsx' | 'pdf',
      data: {
        records: leaveData,
        filters,
        includeBalance: req.includeBalance,
        orgId: authData.orgId,
        generatedAt: new Date(),
      },
    });

    // Trigger async processing
    documents.processExport({ exportId: exportResponse.exportId }).catch(error => {
      console.error('[StaffExport] Failed to process export:', error);
    });

    return {
      exportId: exportResponse.exportId,
      status: exportResponse.status,
      estimatedSeconds: exportResponse.estimatedSeconds,
      statusUrl: `/documents/exports/${exportResponse.exportId}/status`,
      downloadUrl: `/documents/exports/${exportResponse.exportId}/download`,
      recordCount: leaveData.length,
    };
}

export const exportLeavev2 = api<ExportLeaveRequest, ExportResponse>(
  { auth: true, expose: true, method: "POST", path: "/staff/v2/leave/export" },
  exportLeaveHandler
);

export const exportLeaveV1 = api<ExportLeaveRequest, ExportResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/staff/export/leave" },
  exportLeaveHandler
);

/**
 * Export attendance records
 */
async function exportAttendanceHandler(req: ExportAttendanceRequest): Promise<ExportResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { format, ...filters } = req;

    // Fetch attendance data
    const attendanceData = await fetchAttendanceData(authData.orgId, authData, filters);

    // Handle CSV export locally
    if (format === 'csv') {
      throw APIError.unimplemented("CSV export not yet migrated to new system");
    }

    // Delegate to documents service
    const exportResponse = await documents.createExport({
      exportType: 'staff-attendance',
      format: format as 'xlsx' | 'pdf',
      data: {
        records: attendanceData,
        filters,
        orgId: authData.orgId,
        generatedAt: new Date(),
      },
    });

    // Trigger async processing
    documents.processExport({ exportId: exportResponse.exportId }).catch(error => {
      console.error('[StaffExport] Failed to process export:', error);
    });

    return {
      exportId: exportResponse.exportId,
      status: exportResponse.status,
      estimatedSeconds: exportResponse.estimatedSeconds,
      statusUrl: `/documents/exports/${exportResponse.exportId}/status`,
      downloadUrl: `/documents/exports/${exportResponse.exportId}/download`,
      recordCount: attendanceData.length,
    };
}

export const exportAttendancev2 = api<ExportAttendanceRequest, ExportResponse>(
  { auth: true, expose: true, method: "POST", path: "/staff/v2/attendance/export" },
  exportAttendanceHandler
);

export const exportAttendanceV1 = api<ExportAttendanceRequest, ExportResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/staff/export/attendance" },
  exportAttendanceHandler
);

/**
 * Export salary records
 */
async function exportSalaryHandler(req: ExportSalaryRequest): Promise<ExportResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData); // Salary export is admin-only

    const { format, ...filters } = req;

    // Fetch salary data
    const salaryData = await fetchSalaryData(authData.orgId, authData, filters);

    // Handle CSV export locally
    if (format === 'csv') {
      throw APIError.unimplemented("CSV export not yet migrated to new system");
    }

    // Delegate to documents service
    const exportResponse = await documents.createExport({
      exportType: 'staff-salary',
      format: format as 'xlsx' | 'pdf',
      data: {
        records: salaryData,
        filters,
        includePayslips: req.includePayslips,
        includeComponents: req.includeComponents,
        orgId: authData.orgId,
        generatedAt: new Date(),
      },
    });

    // Trigger async processing
    documents.processExport({ exportId: exportResponse.exportId }).catch(error => {
      console.error('[StaffExport] Failed to process export:', error);
    });

    return {
      exportId: exportResponse.exportId,
      status: exportResponse.status,
      estimatedSeconds: exportResponse.estimatedSeconds,
      statusUrl: `/documents/exports/${exportResponse.exportId}/status`,
      downloadUrl: `/documents/exports/${exportResponse.exportId}/download`,
      recordCount: salaryData.length,
    };
}

export const exportSalaryv2 = api<ExportSalaryRequest, ExportResponse>(
  { auth: true, expose: true, method: "POST", path: "/staff/v2/salary/export" },
  exportSalaryHandler
);

export const exportSalaryV1 = api<ExportSalaryRequest, ExportResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/staff/export/salary" },
  exportSalaryHandler
);

/**
 * Helper: Fetch leave data
 */
async function fetchLeaveData(orgId: number, authData: any, filters: any): Promise<any[]> {
  let query = `
    SELECT 
      u.display_name as staff_name,
      lr.leave_type,
      lr.start_date,
      lr.end_date,
      lr.status,
      lr.reason
    FROM leave_requests lr
    JOIN staff s ON lr.staff_id = s.id AND s.org_id = $1
    JOIN users u ON s.user_id = u.id
    WHERE lr.org_id = $1
  `;
  const params: any[] = [orgId];
  let paramIndex = 2;

  if (authData.role === "MANAGER") {
    query += ` AND lr.property_id IN (SELECT property_id FROM user_properties WHERE user_id = $${paramIndex})`;
    params.push(parseInt(authData.userID));
    paramIndex++;
  }

  if (filters.staffId) {
    query += ` AND lr.staff_id = $${paramIndex}`;
    params.push(filters.staffId);
    paramIndex++;
  }

  if (filters.leaveType) {
    query += ` AND lr.leave_type = $${paramIndex}`;
    params.push(filters.leaveType);
    paramIndex++;
  }

  if (filters.status) {
    query += ` AND lr.status = $${paramIndex}`;
    params.push(filters.status);
    paramIndex++;
  }

  query += ` ORDER BY lr.start_date DESC`;

  return staffDB.rawQueryAll(query, ...params);
}

/**
 * Helper: Fetch attendance data
 */
async function fetchAttendanceData(orgId: number, authData: any, filters: any): Promise<any[]> {
  let query = `
    SELECT 
      u.display_name as staff_name,
      a.date,
      a.check_in,
      a.check_out,
      a.status
    FROM attendance a
    JOIN staff s ON a.staff_id = s.id AND s.org_id = $1
    JOIN users u ON s.user_id = u.id
    WHERE a.org_id = $1
  `;
  const params: any[] = [orgId];
  let paramIndex = 2;

  if (filters.staffId) {
    query += ` AND a.staff_id = $${paramIndex}`;
    params.push(filters.staffId);
    paramIndex++;
  }

  if (filters.startDate) {
    query += ` AND a.date >= $${paramIndex}`;
    params.push(filters.startDate);
    paramIndex++;
  }

  if (filters.endDate) {
    query += ` AND a.date <= $${paramIndex}`;
    params.push(filters.endDate);
    paramIndex++;
  }

  query += ` ORDER BY a.date DESC`;

  return staffDB.rawQueryAll(query, ...params);
}

/**
 * Helper: Fetch salary data
 */
async function fetchSalaryData(orgId: number, authData: any, filters: any): Promise<any[]> {
  let query = `
    SELECT 
      u.display_name as staff_name,
      p.period_start,
      p.period_end,
      p.base_salary_cents,
      p.deductions_cents,
      p.net_pay_cents,
      p.status
    FROM payslips p
    JOIN staff s ON p.staff_id = s.id AND s.org_id = $1
    JOIN users u ON s.user_id = u.id
    WHERE p.org_id = $1
  `;
  const params: any[] = [orgId];
  let paramIndex = 2;

  if (filters.staffId) {
    query += ` AND p.staff_id = $${paramIndex}`;
    params.push(filters.staffId);
    paramIndex++;
  }

  if (filters.payPeriodStart) {
    query += ` AND p.period_start >= $${paramIndex}`;
    params.push(filters.payPeriodStart);
    paramIndex++;
  }

  if (filters.payPeriodEnd) {
    query += ` AND p.period_end <= $${paramIndex}`;
    params.push(filters.payPeriodEnd);
    paramIndex++;
  }

  query += ` ORDER BY p.period_start DESC`;

  return staffDB.rawQueryAll(query, ...params);
}

