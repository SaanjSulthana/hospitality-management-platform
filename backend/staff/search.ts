import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface SearchStaffRequest {
  query: string;
  filters?: {
    department?: string;
    status?: string;
    propertyId?: number;
    performanceMin?: number;
    performanceMax?: number;
    salaryType?: string;
    attendanceTrackingEnabled?: boolean;
  };
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'department' | 'status' | 'hireDate' | 'performance' | 'salary';
  sortOrder?: 'asc' | 'desc';
}

export interface StaffSearchResult {
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
  // Search relevance
  relevanceScore?: number;
}

export interface SearchStaffResponse {
  results: StaffSearchResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  searchInfo: {
    query: string;
    filters: any;
    searchTime: number;
  };
}

// Shared handler for staff search
async function searchHandler(req: SearchStaffRequest): Promise<SearchStaffResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { 
      query, 
      filters = {}, 
      page = 1, 
      limit = 20, 
      sortBy = 'name', 
      sortOrder = 'asc' 
    } = req;

    const startTime = Date.now();

    // Validate pagination parameters
    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit));
    const offset = (pageNum - 1) * limitNum;

    try {
      // Build base query with enhanced fields and search relevance
      let baseQuery = `
        SELECT 
          s.id, s.user_id, s.property_id, s.department, s.hourly_rate_cents, 
          s.hire_date, s.notes, s.status, s.performance_rating,
          s.salary_type, s.base_salary_cents, s.overtime_rate_cents,
          s.attendance_tracking_enabled, s.max_overtime_hours, s.leave_balance,
          u.display_name as user_name, u.email as user_email,
          p.name as property_name,
          -- Search relevance scoring
          (
            CASE WHEN u.display_name ILIKE $1 THEN 10 ELSE 0 END +
            CASE WHEN u.email ILIKE $1 THEN 8 ELSE 0 END +
            CASE WHEN s.notes ILIKE $1 THEN 6 ELSE 0 END +
            CASE WHEN p.name ILIKE $1 THEN 4 ELSE 0 END +
            CASE WHEN s.department ILIKE $1 THEN 3 ELSE 0 END +
            CASE WHEN s.status ILIKE $1 THEN 2 ELSE 0 END
          ) as relevance_score
        FROM staff s
        JOIN users u ON s.user_id = u.id AND u.org_id = $2
        LEFT JOIN properties p ON s.property_id = p.id AND p.org_id = $2
        WHERE s.org_id = $2
      `;
      const params: any[] = [`%${query}%`, authData.orgId];
      let paramIndex = 3;

      // Managers can only see staff for properties they have access to
      if (authData.role === "MANAGER") {
        baseQuery += ` AND (
          s.property_id IN (SELECT property_id FROM user_properties WHERE user_id = $${paramIndex})
          OR s.property_id IS NULL
        )`;
        params.push(parseInt(authData.userID));
        paramIndex++;
      }

      // Apply search filters
      if (filters.department) {
        baseQuery += ` AND s.department = $${paramIndex}`;
        params.push(filters.department);
        paramIndex++;
      }

      if (filters.status) {
        baseQuery += ` AND s.status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      if (filters.propertyId) {
        baseQuery += ` AND s.property_id = $${paramIndex}`;
        params.push(filters.propertyId);
        paramIndex++;
      }

      if (filters.performanceMin !== undefined) {
        baseQuery += ` AND s.performance_rating >= $${paramIndex}`;
        params.push(filters.performanceMin);
        paramIndex++;
      }

      if (filters.performanceMax !== undefined) {
        baseQuery += ` AND s.performance_rating <= $${paramIndex}`;
        params.push(filters.performanceMax);
        paramIndex++;
      }

      if (filters.salaryType) {
        baseQuery += ` AND s.salary_type = $${paramIndex}`;
        params.push(filters.salaryType);
        paramIndex++;
      }

      if (filters.attendanceTrackingEnabled !== undefined) {
        baseQuery += ` AND s.attendance_tracking_enabled = $${paramIndex}`;
        params.push(filters.attendanceTrackingEnabled);
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
        'performance': 's.performance_rating',
        'salary': 's.base_salary_cents'
      }[sortBy] || 'relevance_score';

      const orderDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';
      
      // For search, prioritize relevance score unless specifically sorting by other fields
      if (sortBy === 'name' || sortBy === 'department' || sortBy === 'status' || sortBy === 'hireDate' || sortBy === 'performance' || sortBy === 'salary') {
        baseQuery += ` ORDER BY ${sortField} ${orderDirection}, relevance_score DESC`;
      } else {
        baseQuery += ` ORDER BY relevance_score DESC, ${sortField} ${orderDirection}`;
      }

      // Apply pagination
      baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limitNum, offset);

      const results = await staffDB.rawQueryAll(baseQuery, ...params);
      const searchTime = Date.now() - startTime;

      return {
        results: results.map((member) => ({
          id: member.id,
          userId: member.user_id,
          userName: member.user_name,
          userEmail: member.user_email,
          propertyId: member.property_id,
          propertyName: member.property_name,
          department: member.department,
          hourlyRateCents: parseInt(member.hourly_rate_cents) || 0,
          performanceRating: parseFloat(member.performance_rating) || 0,
          hireDate: member.hire_date,
          notes: member.notes,
          status: member.status,
          // Enhanced fields
          salaryType: member.salary_type || 'hourly',
          baseSalaryCents: parseInt(member.base_salary_cents) || 0,
          overtimeRateCents: parseInt(member.overtime_rate_cents) || 0,
          attendanceTrackingEnabled: member.attendance_tracking_enabled || false,
          maxOvertimeHours: parseFloat(member.max_overtime_hours) || 0,
          leaveBalance: parseInt(member.leave_balance) || 0,
          // Search relevance
          relevanceScore: parseInt(member.relevance_score) || 0,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
        },
        searchInfo: {
          query,
          filters,
          searchTime,
        },
      };
    } catch (error) {
      console.error('Search staff error:', error);
      throw APIError.internal("Failed to search staff members");
    }
}

// LEGACY: Advanced staff search (keep for backward compatibility)
export const search = api<SearchStaffRequest, SearchStaffResponse>(
  { auth: true, expose: true, method: "POST", path: "/staff/search" },
  searchHandler
);

// V1: Advanced staff search
export const searchV1 = api<SearchStaffRequest, SearchStaffResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/staff/search" },
  searchHandler
);
