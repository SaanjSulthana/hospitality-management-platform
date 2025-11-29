import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { staffDB } from "./db";
import { requireRole } from "../auth/middleware";

interface ListStaffRequest {
  propertyId?: number;
  department?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'department' | 'status' | 'hireDate' | 'performance';
  sortOrder?: 'asc' | 'desc';
}

export interface StaffInfo {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  propertyId?: number;
  propertyName?: string;
  department: string;
  hourlyRateCents: number;
  performanceRating: number;
  hireDate?: Date;
  notes?: string;
  status: string;
  // Enhanced fields
  salaryType: string;
  baseSalaryCents: number;
  overtimeRateCents: number;
  attendanceTrackingEnabled: boolean;
  maxOvertimeHours: number;
  leaveBalance: number;
}

export interface ListStaffResponse {
  staff: StaffInfo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Shared handler for listing staff members
async function listHandler(req: ListStaffRequest): Promise<ListStaffResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { 
      propertyId, 
      department, 
      status, 
      search, 
      page = 1, 
      limit = 20, 
      sortBy = 'name', 
      sortOrder = 'asc' 
    } = req || {};

    // Validate pagination parameters
    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit));
    const offset = (pageNum - 1) * limitNum;

    try {
      // Build base query with only basic columns that definitely exist (updated to remove hourly_rate_cents - v3 - FORCE DEPLOYMENT)
      let baseQuery = `
        SELECT 
          s.id, s.user_id, s.property_id, s.department, 
          s.hire_date, s.notes, s.status,
          u.display_name as user_name, u.email as user_email,
          p.name as property_name
        FROM staff s
        JOIN users u ON s.user_id = u.id AND u.org_id = $1
        LEFT JOIN properties p ON s.property_id = p.id AND p.org_id = $1
        WHERE s.org_id = $1
      `;
      const params: any[] = [authData.orgId];
      let paramIndex = 2;

      // Managers can only see staff for properties they have access to
      if (authData.role === "MANAGER") {
        baseQuery += ` AND (
          s.property_id IN (SELECT property_id FROM user_properties WHERE user_id = $${paramIndex})
          OR s.property_id IS NULL
        )`;
        params.push(parseInt(authData.userID));
        paramIndex++;
      }

      // Apply filters
      if (propertyId) {
        baseQuery += ` AND s.property_id = $${paramIndex}`;
        params.push(propertyId);
        paramIndex++;
      }

      if (department) {
        baseQuery += ` AND s.department = $${paramIndex}`;
        params.push(department);
        paramIndex++;
      }

      if (status) {
        baseQuery += ` AND s.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      // Apply search filter
      if (search) {
        baseQuery += ` AND (
          u.display_name ILIKE $${paramIndex} OR 
          u.email ILIKE $${paramIndex} OR 
          s.notes ILIKE $${paramIndex} OR
          p.name ILIKE $${paramIndex}
        )`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      // Get total count for pagination
      const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as count_query`;
      const countResult = await staffDB.rawQueryRow(countQuery, ...params);
      const total = parseInt(countResult?.total || '0') || 0;
      const totalPages = Math.ceil(total / limitNum);

      // Apply sorting
      const sortField = {
        'name': 'u.display_name',
        'department': 's.department',
        'status': 's.status',
        'hireDate': 's.hire_date',
        'performance': 's.hire_date'
      }[sortBy] || 'u.display_name';

      const orderDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';
      baseQuery += ` ORDER BY ${sortField} ${orderDirection}`;

      // Apply pagination
      baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limitNum, offset);

      const staff = await staffDB.rawQueryAll(baseQuery, ...params);

      return {
        staff: staff.map((member) => ({
          id: member.id,
          userId: member.user_id,
          userName: member.user_name,
          userEmail: member.user_email,
          propertyId: member.property_id,
          propertyName: member.property_name,
          department: member.department,
          hourlyRateCents: 0, // Default value since column might not exist
          performanceRating: 0,
          hireDate: member.hire_date,
          notes: member.notes,
          status: member.status,
          // Enhanced fields with default values
          salaryType: 'hourly',
          baseSalaryCents: 0,
          overtimeRateCents: 0,
          attendanceTrackingEnabled: false,
          maxOvertimeHours: 0,
          leaveBalance: 0,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
        },
      };
    } catch (error) {
      console.error('List staff error:', error);
      throw APIError.internal("Failed to fetch staff members");
    }
}

// LEGACY: Lists staff members (keep for backward compatibility)
export const list = api<ListStaffRequest, ListStaffResponse>(
  { auth: true, expose: true, method: "GET", path: "/staff" },
  listHandler
);

// V1: Lists staff members
export const listV1 = api<ListStaffRequest, ListStaffResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/staff" },
  listHandler
);

