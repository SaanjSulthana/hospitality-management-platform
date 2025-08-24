import { api, Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { usersDB } from "./db";
import { requireRole, requireOrgAccess } from "../auth/middleware";
import { UserRole } from "../auth/types";

export interface ListUsersRequest {
  role?: Query<UserRole>;
  regionId?: Query<number>;
  propertyId?: Query<number>;
}

export interface UserInfo {
  id: number;
  email: string;
  role: UserRole;
  displayName: string;
  regionId?: number;
  createdAt: Date;
  lastLoginAt?: Date;
}

export interface ListUsersResponse {
  users: UserInfo[];
}

// Lists users in the organization with role-based filtering
export const list = api<ListUsersRequest, ListUsersResponse>(
  { auth: true, expose: true, method: "GET", path: "/users" },
  async (req) => {
    const authData = getAuthData()!;
    requireRole('CORP_ADMIN', 'REGIONAL_MANAGER', 'PROPERTY_MANAGER')(authData);

    const { role, regionId, propertyId } = req;

    let query = `
      SELECT u.id, u.email, u.role, u.display_name, u.region_id, u.created_at, u.last_login_at
      FROM users u
      WHERE u.org_id = $1
    `;
    const params: any[] = [authData.orgId];
    let paramIndex = 2;

    // Apply role-based access control
    if (authData.role === 'REGIONAL_MANAGER' && authData.regionId) {
      query += ` AND (u.region_id = $${paramIndex} OR u.id IN (
        SELECT up.user_id FROM user_properties up
        JOIN properties p ON up.property_id = p.id
        WHERE p.region_id = $${paramIndex}
      ))`;
      params.push(authData.regionId);
      paramIndex++;
    }

    if (authData.role === 'PROPERTY_MANAGER') {
      query += ` AND u.id IN (
        SELECT up.user_id FROM user_properties up
        JOIN properties p ON up.property_id = p.id
        WHERE p.id IN (
          SELECT property_id FROM user_properties WHERE user_id = $${paramIndex}
        )
      )`;
      params.push(parseInt(authData.userID));
      paramIndex++;
    }

    // Apply filters
    if (role) {
      query += ` AND u.role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (regionId) {
      query += ` AND u.region_id = $${paramIndex}`;
      params.push(regionId);
      paramIndex++;
    }

    if (propertyId) {
      query += ` AND u.id IN (
        SELECT user_id FROM user_properties WHERE property_id = $${paramIndex}
      )`;
      params.push(propertyId);
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
        regionId: user.region_id,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
      })),
    };
  }
);
