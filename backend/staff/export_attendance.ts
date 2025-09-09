import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface ExportAttendanceRequest {
  staffId?: number;
  propertyId?: number;
  status?: 'present' | 'absent' | 'late' | 'half_day' | 'leave';
  startDate?: Date;
  endDate?: Date;
  format?: 'csv' | 'excel' | 'pdf';
}

export interface ExportAttendanceResponse {
  success: boolean;
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  recordCount: number;
  generatedAt: Date;
}

// Exports attendance records in various formats
export const exportAttendance = api<ExportAttendanceRequest, ExportAttendanceResponse>(
  { auth: true, expose: true, method: "POST", path: "/staff/attendance/export" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { staffId, propertyId, status, startDate, endDate, format = 'csv' } = req;

    try {
      // Build query for attendance data
      let query = `
        SELECT 
          u.display_name as staff_name,
          u.email as staff_email,
          p.name as property_name,
          s.department,
          sa.attendance_date,
          sa.check_in_time,
          sa.check_out_time,
          sa.total_hours,
          sa.overtime_hours,
          sa.status,
          sa.notes,
          sa.created_at,
          sa.updated_at
        FROM staff_attendance sa
        JOIN staff s ON sa.staff_id = s.id AND s.org_id = $1
        JOIN users u ON s.user_id = u.id AND u.org_id = $1
        LEFT JOIN properties p ON s.property_id = p.id AND p.org_id = $1
        WHERE sa.org_id = $1
      `;
      const params: any[] = [authData.orgId];
      let paramIndex = 2;

      // Managers can only export attendance for their assigned properties
      if (authData.role === "MANAGER") {
        query += ` AND (
          s.property_id IN (SELECT property_id FROM user_properties WHERE user_id = $${paramIndex})
          OR s.property_id IS NULL
        )`;
        params.push(parseInt(authData.userID));
        paramIndex++;
      }

      // Apply filters
      if (staffId) {
        query += ` AND sa.staff_id = $${paramIndex}`;
        params.push(staffId);
        paramIndex++;
      }

      if (propertyId) {
        query += ` AND s.property_id = $${paramIndex}`;
        params.push(propertyId);
        paramIndex++;
      }

      if (status) {
        query += ` AND sa.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (startDate) {
        query += ` AND sa.attendance_date >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        query += ` AND sa.attendance_date <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      query += ` ORDER BY sa.attendance_date DESC, u.display_name ASC`;

      const attendanceData = await staffDB.rawQueryAll(query, ...params);

      if (attendanceData.length === 0) {
        throw APIError.notFound("No attendance records found for the specified criteria");
      }

      // Generate file based on format
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      let fileName: string;
      let fileContent: string;
      let mimeType: string;

      switch (format) {
        case 'csv':
          fileName = `attendance-export-${timestamp}.csv`;
          fileContent = generateCSV(attendanceData);
          mimeType = 'text/csv';
          break;
        case 'excel':
          fileName = `attendance-export-${timestamp}.xlsx`;
          fileContent = await generateExcel(attendanceData);
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        case 'pdf':
          fileName = `attendance-export-${timestamp}.pdf`;
          fileContent = await generatePDF(attendanceData);
          mimeType = 'application/pdf';
          break;
        default:
          throw APIError.invalidArgument("Unsupported export format");
      }

      // In a real implementation, you would save the file to a storage service
      // and return a download URL. For now, we'll simulate this.
      const downloadUrl = `/api/staff/attendance/download/${fileName}`;
      const fileSize = Buffer.byteLength(fileContent, 'utf8');

      return {
        success: true,
        downloadUrl,
        fileName,
        fileSize,
        recordCount: attendanceData.length,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error('Export attendance error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to export attendance records");
    }
  }
);

// Helper function to generate CSV content
function generateCSV(data: any[]): string {
  if (data.length === 0) return '';

  const headers = [
    'Staff Name',
    'Staff Email',
    'Property Name',
    'Department',
    'Attendance Date',
    'Check In Time',
    'Check Out Time',
    'Total Hours',
    'Overtime Hours',
    'Status',
    'Notes',
    'Created At',
    'Updated At'
  ];

  const csvRows = [headers.join(',')];

  for (const record of data) {
    const row = [
      `"${record.staff_name || ''}"`,
      `"${record.staff_email || ''}"`,
      `"${record.property_name || 'Unassigned'}"`,
      `"${record.department || ''}"`,
      `"${record.attendance_date || ''}"`,
      `"${record.check_in_time || ''}"`,
      `"${record.check_out_time || ''}"`,
      `"${record.total_hours || 0}"`,
      `"${record.overtime_hours || 0}"`,
      `"${record.status || ''}"`,
      `"${(record.notes || '').replace(/"/g, '""')}"`,
      `"${record.created_at || ''}"`,
      `"${record.updated_at || ''}"`
    ];
    csvRows.push(row.join(','));
  }

  return csvRows.join('\n');
}

// Helper function to generate Excel content (simplified)
async function generateExcel(data: any[]): Promise<string> {
  // In a real implementation, you would use a library like 'xlsx' or 'exceljs'
  // to generate actual Excel files. For now, we'll return a placeholder.
  return `Excel file would be generated here with ${data.length} records`;
}

// Helper function to generate PDF content (simplified)
async function generatePDF(data: any[]): Promise<string> {
  // In a real implementation, you would use a library like 'puppeteer' or 'jsPDF'
  // to generate actual PDF files. For now, we'll return a placeholder.
  return `PDF file would be generated here with ${data.length} records`;
}
