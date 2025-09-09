import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface ExportLeaveRequest {
  staffId?: number;
  propertyId?: number;
  leaveType?: 'annual' | 'sick' | 'emergency' | 'personal';
  status?: 'pending' | 'approved' | 'rejected';
  startDate?: Date;
  endDate?: Date;
  format?: 'csv' | 'excel' | 'pdf';
  includeBalance?: boolean;
}

export interface ExportLeaveResponse {
  success: boolean;
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  recordCount: number;
  generatedAt: Date;
}

// Exports leave data in various formats
export const exportLeave = api<ExportLeaveRequest, ExportLeaveResponse>(
  { auth: true, expose: true, method: "POST", path: "/staff/leave/export" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { 
      staffId, 
      propertyId, 
      leaveType, 
      status, 
      startDate, 
      endDate, 
      format = 'csv',
      includeBalance = false
    } = req;

    try {
      let exportData: any[] = [];

      // Build leave requests query
      let leaveQuery = `
        SELECT 
          u.display_name as staff_name,
          u.email as staff_email,
          p.name as property_name,
          s.department,
          lr.leave_type,
          lr.start_date,
          lr.end_date,
          lr.reason,
          lr.status,
          lr.is_emergency,
          lr.priority_level,
          lr.emergency_contact,
          lr.emergency_phone,
          lr.supporting_documents,
          lr.requested_at,
          lr.approved_at,
          lr.approval_notes,
          requester.display_name as requested_by_name,
          approver.display_name as approved_by_name,
          lr.created_at,
          lr.updated_at
        FROM leave_requests lr
        JOIN staff s ON lr.staff_id = s.id AND s.org_id = $1
        JOIN users u ON s.user_id = u.id AND u.org_id = $1
        LEFT JOIN properties p ON lr.property_id = p.id AND p.org_id = $1
        LEFT JOIN users requester ON lr.requested_by_user_id = requester.id AND requester.org_id = $1
        LEFT JOIN users approver ON lr.approved_by_user_id = approver.id AND approver.org_id = $1
        WHERE lr.org_id = $1
      `;
      const params: any[] = [authData.orgId];
      let paramIndex = 2;

      // Managers can only export leave data for their assigned properties
      if (authData.role === "MANAGER") {
        leaveQuery += ` AND (
          lr.property_id IN (SELECT property_id FROM user_properties WHERE user_id = $${paramIndex})
          OR lr.property_id IS NULL
        )`;
        params.push(parseInt(authData.userID));
        paramIndex++;
      }

      if (staffId) {
        leaveQuery += ` AND lr.staff_id = $${paramIndex}`;
        params.push(staffId);
        paramIndex++;
      }

      if (propertyId) {
        leaveQuery += ` AND lr.property_id = $${paramIndex}`;
        params.push(propertyId);
        paramIndex++;
      }

      if (leaveType) {
        leaveQuery += ` AND lr.leave_type = $${paramIndex}`;
        params.push(leaveType);
        paramIndex++;
      }

      if (status) {
        leaveQuery += ` AND lr.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (startDate) {
        leaveQuery += ` AND lr.start_date >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        leaveQuery += ` AND lr.end_date <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      leaveQuery += ` ORDER BY lr.requested_at DESC`;

      const leaveData = await staffDB.rawQueryAll(leaveQuery, ...params);
      exportData = [...exportData, ...leaveData];

      if (includeBalance) {
        // Build leave balance query
        let balanceQuery = `
          SELECT 
            u.display_name as staff_name,
            u.email as staff_email,
            p.name as property_name,
            s.department,
            s.leave_balance as current_balance,
            COALESCE(SUM(
              CASE 
                WHEN lr.status = 'approved' AND lr.leave_type = 'annual' 
                THEN EXTRACT(DAY FROM (lr.end_date - lr.start_date)) + 1
                ELSE 0
              END
            ), 0) as used_annual_leave,
            COALESCE(SUM(
              CASE 
                WHEN lr.status = 'approved' AND lr.leave_type = 'sick' 
                THEN EXTRACT(DAY FROM (lr.end_date - lr.start_date)) + 1
                ELSE 0
              END
            ), 0) as used_sick_leave,
            COALESCE(SUM(
              CASE 
                WHEN lr.status = 'approved' AND lr.leave_type = 'emergency' 
                THEN EXTRACT(DAY FROM (lr.end_date - lr.start_date)) + 1
                ELSE 0
              END
            ), 0) as used_emergency_leave,
            COALESCE(SUM(
              CASE 
                WHEN lr.status = 'approved' AND lr.leave_type = 'personal' 
                THEN EXTRACT(DAY FROM (lr.end_date - lr.start_date)) + 1
                ELSE 0
              END
            ), 0) as used_personal_leave
          FROM staff s
          JOIN users u ON s.user_id = u.id AND u.org_id = $1
          LEFT JOIN properties p ON s.property_id = p.id AND p.org_id = $1
          LEFT JOIN leave_requests lr ON s.id = lr.staff_id AND lr.org_id = $1
            AND EXTRACT(YEAR FROM lr.start_date) = EXTRACT(YEAR FROM CURRENT_DATE)
          WHERE s.org_id = $1
        `;
        const balanceParams = [authData.orgId];
        let balanceParamIndex = 2;

        // Managers can only export leave balance for their assigned properties
        if (authData.role === "MANAGER") {
          balanceQuery += ` AND (
            s.property_id IN (SELECT property_id FROM user_properties WHERE user_id = $${balanceParamIndex})
            OR s.property_id IS NULL
          )`;
          balanceParams.push(parseInt(authData.userID));
          balanceParamIndex++;
        }

        if (staffId) {
          balanceQuery += ` AND s.id = $${balanceParamIndex}`;
          balanceParams.push(staffId);
          balanceParamIndex++;
        }

        if (propertyId) {
          balanceQuery += ` AND s.property_id = $${balanceParamIndex}`;
          balanceParams.push(propertyId);
          balanceParamIndex++;
        }

        balanceQuery += ` GROUP BY s.id, u.display_name, u.email, p.name, s.department, s.leave_balance
                         ORDER BY u.display_name ASC`;

        const balanceData = await staffDB.rawQueryAll(balanceQuery, ...balanceParams);
        exportData = [...exportData, ...balanceData];
      }

      if (exportData.length === 0) {
        throw APIError.notFound("No leave data found for the specified criteria");
      }

      // Generate file based on format
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      let fileName: string;
      let fileContent: string;
      let mimeType: string;

      switch (format) {
        case 'csv':
          fileName = `leave-export-${timestamp}.csv`;
          fileContent = generateLeaveCSV(exportData, includeBalance);
          mimeType = 'text/csv';
          break;
        case 'excel':
          fileName = `leave-export-${timestamp}.xlsx`;
          fileContent = await generateLeaveExcel(exportData, includeBalance);
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        case 'pdf':
          fileName = `leave-export-${timestamp}.pdf`;
          fileContent = await generateLeavePDF(exportData, includeBalance);
          mimeType = 'application/pdf';
          break;
        default:
          throw APIError.invalidArgument("Unsupported export format");
      }

      // In a real implementation, you would save the file to a storage service
      // and return a download URL. For now, we'll simulate this.
      const downloadUrl = `/api/staff/leave/download/${fileName}`;
      const fileSize = Buffer.byteLength(fileContent, 'utf8');

      return {
        success: true,
        downloadUrl,
        fileName,
        fileSize,
        recordCount: exportData.length,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error('Export leave error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to export leave data");
    }
  }
);

// Helper function to generate CSV content for leave data
function generateLeaveCSV(data: any[], includeBalance: boolean): string {
  if (data.length === 0) return '';

  const csvRows: string[] = [];

  // Leave requests headers
  const leaveHeaders = [
    'Staff Name',
    'Staff Email',
    'Property Name',
    'Department',
    'Leave Type',
    'Start Date',
    'End Date',
    'Reason',
    'Status',
    'Is Emergency',
    'Priority Level',
    'Emergency Contact',
    'Emergency Phone',
    'Supporting Documents',
    'Requested At',
    'Approved At',
    'Approval Notes',
    'Requested By',
    'Approved By',
    'Created At',
    'Updated At'
  ];
  csvRows.push(leaveHeaders.join(','));

  // Leave requests data
  for (const record of data) {
    if (record.leave_type) { // This is a leave request record
      const row = [
        `"${record.staff_name || ''}"`,
        `"${record.staff_email || ''}"`,
        `"${record.property_name || 'Unassigned'}"`,
        `"${record.department || ''}"`,
        `"${record.leave_type || ''}"`,
        `"${record.start_date || ''}"`,
        `"${record.end_date || ''}"`,
        `"${(record.reason || '').replace(/"/g, '""')}"`,
        `"${record.status || ''}"`,
        `"${record.is_emergency || false}"`,
        `"${record.priority_level || ''}"`,
        `"${record.emergency_contact || ''}"`,
        `"${record.emergency_phone || ''}"`,
        `"${record.supporting_documents || ''}"`,
        `"${record.requested_at || ''}"`,
        `"${record.approved_at || ''}"`,
        `"${(record.approval_notes || '').replace(/"/g, '""')}"`,
        `"${record.requested_by_name || ''}"`,
        `"${record.approved_by_name || ''}"`,
        `"${record.created_at || ''}"`,
        `"${record.updated_at || ''}"`
      ];
      csvRows.push(row.join(','));
    }
  }

  if (includeBalance) {
    // Add separator if both types are included
    if (data.some(record => record.leave_type)) {
      csvRows.push(''); // Empty row separator
    }

    // Leave balance headers
    const balanceHeaders = [
      'Staff Name',
      'Staff Email',
      'Property Name',
      'Department',
      'Current Balance',
      'Used Annual Leave',
      'Used Sick Leave',
      'Used Emergency Leave',
      'Used Personal Leave',
      'Total Used Leave',
      'Remaining Balance'
    ];
    csvRows.push(balanceHeaders.join(','));

    // Leave balance data
    for (const record of data) {
      if (record.current_balance !== undefined && !record.leave_type) { // This is a leave balance record
        const totalUsed = (parseInt(record.used_annual_leave) || 0) + 
                         (parseInt(record.used_sick_leave) || 0) + 
                         (parseInt(record.used_emergency_leave) || 0) + 
                         (parseInt(record.used_personal_leave) || 0);
        const remaining = (parseInt(record.current_balance) || 0) - totalUsed;
        
        const row = [
          `"${record.staff_name || ''}"`,
          `"${record.staff_email || ''}"`,
          `"${record.property_name || 'Unassigned'}"`,
          `"${record.department || ''}"`,
          `"${record.current_balance || 0}"`,
          `"${record.used_annual_leave || 0}"`,
          `"${record.used_sick_leave || 0}"`,
          `"${record.used_emergency_leave || 0}"`,
          `"${record.used_personal_leave || 0}"`,
          `"${totalUsed}"`,
          `"${remaining}"`
        ];
        csvRows.push(row.join(','));
      }
    }
  }

  return csvRows.join('\n');
}

// Helper function to generate Excel content (simplified)
async function generateLeaveExcel(data: any[], includeBalance: boolean): Promise<string> {
  // In a real implementation, you would use a library like 'xlsx' or 'exceljs'
  // to generate actual Excel files. For now, we'll return a placeholder.
  return `Excel file would be generated here with ${data.length} records`;
}

// Helper function to generate PDF content (simplified)
async function generateLeavePDF(data: any[], includeBalance: boolean): Promise<string> {
  // In a real implementation, you would use a library like 'puppeteer' or 'jsPDF'
  // to generate actual PDF files. For now, we'll return a placeholder.
  return `PDF file would be generated here with ${data.length} records`;
}
