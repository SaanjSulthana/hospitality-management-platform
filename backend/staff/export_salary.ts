import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface ExportSalaryRequest {
  staffId?: number;
  propertyId?: number;
  payPeriodStart?: Date;
  payPeriodEnd?: Date;
  format?: 'csv' | 'excel' | 'pdf';
  includePayslips?: boolean;
  includeComponents?: boolean;
}

export interface ExportSalaryResponse {
  success: boolean;
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  recordCount: number;
  generatedAt: Date;
}

// Exports salary data in various formats
export const exportSalary = api<ExportSalaryRequest, ExportSalaryResponse>(
  { auth: true, expose: true, method: "POST", path: "/staff/salary/export" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { 
      staffId, 
      propertyId, 
      payPeriodStart, 
      payPeriodEnd, 
      format = 'csv',
      includePayslips = true,
      includeComponents = false
    } = req;

    try {
      let exportData: any[] = [];
      let recordCount = 0;

      if (includePayslips) {
        // Build payslips query
        let payslipsQuery = `
          SELECT 
            u.display_name as staff_name,
            u.email as staff_email,
            p.name as property_name,
            s.department,
            p2.pay_period_start,
            p2.pay_period_end,
            p2.base_salary_cents,
            p2.overtime_pay_cents,
            p2.bonus_cents,
            p2.allowance_cents,
            p2.deduction_cents,
            p2.total_earnings_cents,
            p2.net_pay_cents,
            p2.hours_worked,
            p2.overtime_hours,
            p2.days_present,
            p2.days_absent,
            p2.leave_days,
            p2.status as payslip_status,
            p2.generated_at,
            p2.created_at
          FROM payslips p2
          JOIN staff s ON p2.staff_id = s.id AND s.org_id = $1
          JOIN users u ON s.user_id = u.id AND u.org_id = $1
          LEFT JOIN properties p ON s.property_id = p.id AND p.org_id = $1
          WHERE p2.org_id = $1
        `;
        const params: any[] = [authData.orgId];
        let paramIndex = 2;

        // Managers can only export salary data for their assigned properties
        if (authData.role === "MANAGER") {
          payslipsQuery += ` AND (
            s.property_id IN (SELECT property_id FROM user_properties WHERE user_id = $${paramIndex})
            OR s.property_id IS NULL
          )`;
          params.push(parseInt(authData.userID));
          paramIndex++;
        }

        if (staffId) {
          payslipsQuery += ` AND p2.staff_id = $${paramIndex}`;
          params.push(staffId);
          paramIndex++;
        }

        if (propertyId) {
          payslipsQuery += ` AND s.property_id = $${paramIndex}`;
          params.push(propertyId);
          paramIndex++;
        }

        if (payPeriodStart) {
          payslipsQuery += ` AND p2.pay_period_start >= $${paramIndex}`;
          params.push(payPeriodStart);
          paramIndex++;
        }

        if (payPeriodEnd) {
          payslipsQuery += ` AND p2.pay_period_end <= $${paramIndex}`;
          params.push(payPeriodEnd);
          paramIndex++;
        }

        payslipsQuery += ` ORDER BY p2.pay_period_start DESC, u.display_name ASC`;

        const payslipsData = await staffDB.rawQueryAll(payslipsQuery, ...params);
        exportData = [...exportData, ...payslipsData];
        recordCount += payslipsData.length;
      }

      if (includeComponents) {
        // Build salary components query
        let componentsQuery = `
          SELECT 
            u.display_name as staff_name,
            u.email as staff_email,
            p.name as property_name,
            s.department,
            sc.base_salary_cents,
            sc.hourly_rate_cents,
            sc.overtime_rate_cents,
            sc.bonus_cents,
            sc.allowance_cents,
            sc.deduction_cents,
            sc.effective_from,
            sc.effective_to,
            sc.is_active,
            sc.created_at,
            sc.updated_at
          FROM salary_components sc
          JOIN staff s ON sc.staff_id = s.id AND s.org_id = $1
          JOIN users u ON s.user_id = u.id AND u.org_id = $1
          LEFT JOIN properties p ON s.property_id = p.id AND p.org_id = $1
          WHERE sc.org_id = $1
        `;
        const params: any[] = [authData.orgId];
        let paramIndex = 2;

        // Managers can only export salary components for their assigned properties
        if (authData.role === "MANAGER") {
          componentsQuery += ` AND (
            s.property_id IN (SELECT property_id FROM user_properties WHERE user_id = $${paramIndex})
            OR s.property_id IS NULL
          )`;
          params.push(parseInt(authData.userID));
          paramIndex++;
        }

        if (staffId) {
          componentsQuery += ` AND sc.staff_id = $${paramIndex}`;
          params.push(staffId);
          paramIndex++;
        }

        if (propertyId) {
          componentsQuery += ` AND s.property_id = $${paramIndex}`;
          params.push(propertyId);
          paramIndex++;
        }

        componentsQuery += ` ORDER BY sc.effective_from DESC, u.display_name ASC`;

        const componentsData = await staffDB.rawQueryAll(componentsQuery, ...params);
        exportData = [...exportData, ...componentsData];
        recordCount += componentsData.length;
      }

      if (exportData.length === 0) {
        throw APIError.notFound("No salary data found for the specified criteria");
      }

      // Generate file based on format
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      let fileName: string;
      let fileContent: string;
      let mimeType: string;

      switch (format) {
        case 'csv':
          fileName = `salary-export-${timestamp}.csv`;
          fileContent = generateSalaryCSV(exportData, includePayslips, includeComponents);
          mimeType = 'text/csv';
          break;
        case 'excel':
          fileName = `salary-export-${timestamp}.xlsx`;
          fileContent = await generateSalaryExcel(exportData, includePayslips, includeComponents);
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        case 'pdf':
          fileName = `salary-export-${timestamp}.pdf`;
          fileContent = await generateSalaryPDF(exportData, includePayslips, includeComponents);
          mimeType = 'application/pdf';
          break;
        default:
          throw APIError.invalidArgument("Unsupported export format");
      }

      // In a real implementation, you would save the file to a storage service
      // and return a download URL. For now, we'll simulate this.
      const downloadUrl = `/api/staff/salary/download/${fileName}`;
      const fileSize = Buffer.byteLength(fileContent, 'utf8');

      return {
        success: true,
        downloadUrl,
        fileName,
        fileSize,
        recordCount,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error('Export salary error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to export salary data");
    }
  }
);

// Helper function to generate CSV content for salary data
function generateSalaryCSV(data: any[], includePayslips: boolean, includeComponents: boolean): string {
  if (data.length === 0) return '';

  const csvRows: string[] = [];

  if (includePayslips) {
    // Payslips headers
    const payslipsHeaders = [
      'Staff Name',
      'Staff Email',
      'Property Name',
      'Department',
      'Pay Period Start',
      'Pay Period End',
      'Base Salary (Cents)',
      'Overtime Pay (Cents)',
      'Bonus (Cents)',
      'Allowance (Cents)',
      'Deduction (Cents)',
      'Total Earnings (Cents)',
      'Net Pay (Cents)',
      'Hours Worked',
      'Overtime Hours',
      'Days Present',
      'Days Absent',
      'Leave Days',
      'Payslip Status',
      'Generated At',
      'Created At'
    ];
    csvRows.push(payslipsHeaders.join(','));

    // Payslips data
    for (const record of data) {
      if (record.pay_period_start) { // This is a payslip record
        const row = [
          `"${record.staff_name || ''}"`,
          `"${record.staff_email || ''}"`,
          `"${record.property_name || 'Unassigned'}"`,
          `"${record.department || ''}"`,
          `"${record.pay_period_start || ''}"`,
          `"${record.pay_period_end || ''}"`,
          `"${record.base_salary_cents || 0}"`,
          `"${record.overtime_pay_cents || 0}"`,
          `"${record.bonus_cents || 0}"`,
          `"${record.allowance_cents || 0}"`,
          `"${record.deduction_cents || 0}"`,
          `"${record.total_earnings_cents || 0}"`,
          `"${record.net_pay_cents || 0}"`,
          `"${record.hours_worked || 0}"`,
          `"${record.overtime_hours || 0}"`,
          `"${record.days_present || 0}"`,
          `"${record.days_absent || 0}"`,
          `"${record.leave_days || 0}"`,
          `"${record.payslip_status || ''}"`,
          `"${record.generated_at || ''}"`,
          `"${record.created_at || ''}"`
        ];
        csvRows.push(row.join(','));
      }
    }
  }

  if (includeComponents) {
    // Add separator if both types are included
    if (includePayslips) {
      csvRows.push(''); // Empty row separator
    }

    // Salary components headers
    const componentsHeaders = [
      'Staff Name',
      'Staff Email',
      'Property Name',
      'Department',
      'Base Salary (Cents)',
      'Hourly Rate (Cents)',
      'Overtime Rate (Cents)',
      'Bonus (Cents)',
      'Allowance (Cents)',
      'Deduction (Cents)',
      'Effective From',
      'Effective To',
      'Is Active',
      'Created At',
      'Updated At'
    ];
    csvRows.push(componentsHeaders.join(','));

    // Salary components data
    for (const record of data) {
      if (record.effective_from && !record.pay_period_start) { // This is a salary component record
        const row = [
          `"${record.staff_name || ''}"`,
          `"${record.staff_email || ''}"`,
          `"${record.property_name || 'Unassigned'}"`,
          `"${record.department || ''}"`,
          `"${record.base_salary_cents || 0}"`,
          `"${record.hourly_rate_cents || 0}"`,
          `"${record.overtime_rate_cents || 0}"`,
          `"${record.bonus_cents || 0}"`,
          `"${record.allowance_cents || 0}"`,
          `"${record.deduction_cents || 0}"`,
          `"${record.effective_from || ''}"`,
          `"${record.effective_to || ''}"`,
          `"${record.is_active || false}"`,
          `"${record.created_at || ''}"`,
          `"${record.updated_at || ''}"`
        ];
        csvRows.push(row.join(','));
      }
    }
  }

  return csvRows.join('\n');
}

// Helper function to generate Excel content (simplified)
async function generateSalaryExcel(data: any[], includePayslips: boolean, includeComponents: boolean): Promise<string> {
  // In a real implementation, you would use a library like 'xlsx' or 'exceljs'
  // to generate actual Excel files. For now, we'll return a placeholder.
  return `Excel file would be generated here with ${data.length} records`;
}

// Helper function to generate PDF content (simplified)
async function generateSalaryPDF(data: any[], includePayslips: boolean, includeComponents: boolean): Promise<string> {
  // In a real implementation, you would use a library like 'puppeteer' or 'jsPDF'
  // to generate actual PDF files. For now, we'll return a placeholder.
  return `PDF file would be generated here with ${data.length} records`;
}
