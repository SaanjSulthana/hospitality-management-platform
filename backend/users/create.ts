import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { usersDB } from "./db";
import { requireRole } from "../auth/middleware";
import { UserRole } from "../auth/types";
import { hashPassword } from "../auth/utils";

export interface CreateUserRequest {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  regionId?: number;
  propertyIds?: number[];
}

export interface CreateUserResponse {
  id: number;
  email: string;
  role: UserRole;
  displayName: string;
  regionId?: number;
}

// Creates a new user in the organization
export const create = api<CreateUserRequest, CreateUserResponse>(
  { auth: true, expose: true, method: "POST", path: "/users" },
  async (req) => {
    const authData = getAuthData()!;
    requireRole('CORP_ADMIN', 'REGIONAL_MANAGER', 'PROPERTY_MANAGER')(authData);

    const { email, password, displayName, role, regionId, propertyIds } = req;

    // Validate role permissions
    if (authData.role === 'REGIONAL_MANAGER' && !['PROPERTY_MANAGER', 'DEPT_HEAD', 'STAFF'].includes(role)) {
      throw APIError.permissionDenied("Regional managers can only create property managers, department heads, and staff");
    }

    if (authData.role === 'PROPERTY_MANAGER' && !['DEPT_HEAD', 'STAFF'].includes(role)) {
      throw APIError.permissionDenied("Property managers can only create department heads and staff");
    }

    if (password.length < 8) {
      throw APIError.invalidArgument("Password must be at least 8 characters");
    }

    // Check if user already exists
    const existingUser = await usersDB.queryRow`
      SELECT id FROM users WHERE org_id = ${authData.orgId} AND email = ${email}
    `;

    if (existingUser) {
      throw APIError.alreadyExists("User already exists in this organization");
    }

    // Validate region access for regional managers
    if (authData.role === 'REGIONAL_MANAGER' && regionId && regionId !== authData.regionId) {
      throw APIError.permissionDenied("Regional managers can only create users in their assigned region");
    }

    const passwordHash = await hashPassword(password);

    // Create user
    const userRow = await usersDB.queryRow`
      INSERT INTO users (org_id, email, password_hash, role, display_name, region_id)
      VALUES (${authData.orgId}, ${email}, ${passwordHash}, ${role}, ${displayName}, ${regionId || null})
      RETURNING id, email, role, display_name, region_id
    `;

    // Link user to properties if specified
    if (propertyIds && propertyIds.length > 0) {
      for (const propertyId of propertyIds) {
        // Validate property access
        if (authData.role === 'PROPERTY_MANAGER') {
          const hasAccess = await usersDB.queryRow`
            SELECT 1 FROM user_properties 
            WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${propertyId}
          `;
          if (!hasAccess) {
            throw APIError.permissionDenied(`No access to property ${propertyId}`);
          }
        }

        await usersDB.exec`
          INSERT INTO user_properties (user_id, property_id)
          VALUES (${userRow.id}, ${propertyId})
        `;
      }
    }

    return {
      id: userRow.id,
      email: userRow.email,
      role: userRow.role as UserRole,
      displayName: userRow.display_name,
      regionId: userRow.region_id,
    };
  }
);
