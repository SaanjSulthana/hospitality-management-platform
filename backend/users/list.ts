import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { usersDB } from "./db";
import { requireRole } from "../auth/middleware";
import { v1Path } from "../shared/http";
import { UserRole } from "../auth/types";

interface ListUsersRequest {
  role?: UserRole;
}

export interface UserInfo {
  id: number;
  email: string;
  role: UserRole;
  displayName: string;
  createdByUserId?: number;
  createdByName?: string;
  createdAt: Date;
  lastLoginAt?: Date;
  lastActivityAt?: Date;
  loginCount: number;
  lastLoginIp?: string;
  lastLoginUserAgent?: string;
  lastLoginLocation?: {
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
  };
  timezone?: string;
  locale?: string;
}

export interface ListUsersResponse {
  users: UserInfo[];
}

// Lists users in the organization (Admin only)
async function listUsersHandler(req: ListUsersRequest): Promise<ListUsersResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { role } = req || {};

    try {
      let query = `
        SELECT 
          u.id, u.email, u.role, u.display_name, u.created_by_user_id, u.created_at, u.last_login_at,
          u.last_activity_at, u.login_count, u.last_login_ip, u.last_login_user_agent, 
          u.last_login_location_json, u.timezone, u.locale,
          creator.display_name as created_by_name
        FROM users u
        LEFT JOIN users creator ON u.created_by_user_id = creator.id AND creator.org_id = $1
        WHERE u.org_id = $1
      `;
      const params: any[] = [authData.orgId];
      let paramIndex = 2;

      // Apply filters
      if (role) {
        query += ` AND u.role = $${paramIndex}`;
        params.push(role);
        paramIndex++;
      }

      query += ` ORDER BY u.created_at DESC`;

      const users = await usersDB.rawQueryAll(query, ...params);

      return {
        users: users.map(user => ({
          id: user.id,
          email: user.email,
          role: user.role as UserRole,
          displayName: user.display_name,
          createdByUserId: user.created_by_user_id,
          createdByName: user.created_by_name,
          createdAt: user.created_at,
          lastLoginAt: user.last_login_at,
          lastActivityAt: user.last_activity_at,
          loginCount: user.login_count || 0,
          lastLoginIp: user.last_login_ip,
          lastLoginUserAgent: user.last_login_user_agent,
          lastLoginLocation: user.last_login_location_json || null,
          timezone: user.timezone || 'UTC',
          locale: user.locale || 'en-US',
        })),
      };
    } catch (error) {
      console.error('List users error:', error);
      throw new Error('Failed to fetch users');
    }
}

export const list = api<ListUsersRequest, ListUsersResponse>(
  { auth: true, expose: true, method: "GET", path: "/users" },
  listUsersHandler
);

export const listV1 = api<ListUsersRequest, ListUsersResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/users" },
  listUsersHandler
);

