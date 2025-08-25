import { api, Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { usersDB } from "./db";
import { requireRole } from "../auth/middleware";
import { UserRole } from "../auth/types";

export interface ListUsersRequest {
  role?: Query<UserRole>;
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
}

export interface ListUsersResponse {
  users: UserInfo[];
}

// Lists users in the organization (Admin only)
export const list = api<ListUsersRequest, ListUsersResponse>(
  { auth: true, expose: true, method: "GET", path: "/users" },
  async (req) => {
    const authData = getAuthData()!;
    requireRole('ADMIN')(authData);

    const { role } = req;

    let query = `
      SELECT 
        u.id, u.email, u.role, u.display_name, u.created_by_user_id, u.created_at, u.last_login_at,
        creator.display_name as created_by_name
      FROM users u
      LEFT JOIN users creator ON u.created_by_user_id = creator.id
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
      })),
    };
  }
);
