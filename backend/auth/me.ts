import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { authDB } from "./db";
import { AuthData } from "./types";

export interface MeResponse {
  user: AuthData;
  permissions: string[];
}

// Shared handler for getting current user info
async function meHandler(req: {}): Promise<MeResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    
    // Fetch fresh user data from database instead of using JWT token data
    const userRow = await authDB.queryRow`
      SELECT id, org_id, email, role, display_name, created_by_user_id
      FROM users
      WHERE id = ${parseInt(authData.userID)} AND org_id = ${authData.orgId}
    `;
    
    if (!userRow) {
      throw APIError.unauthenticated("User not found");
    }
    
    console.log('Fresh user data from database:', {
      id: userRow.id,
      email: userRow.email,
      displayName: userRow.display_name,
      role: userRow.role
    });
    
    // Create fresh AuthData from database
    const freshUserData: AuthData = {
      userID: userRow.id.toString(),
      orgId: userRow.org_id,
      email: userRow.email,
      role: userRow.role as any,
      displayName: userRow.display_name,
      createdByUserId: userRow.created_by_user_id ?? undefined,
    };
    
    const permissions = getPermissionsForRole(freshUserData.role);
    
    return {
      user: freshUserData,
      permissions,
    };
}

// LEGACY: Returns current user information and permissions (keep for backward compatibility)
export const me = api<{}, MeResponse>(
  { auth: true, expose: true, method: "GET", path: "/auth/me" },
  meHandler
);

// V1: Returns current user information and permissions
export const meV1 = api<{}, MeResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/auth/me" },
  meHandler
);

function getPermissionsForRole(role: string): string[] {
  switch (role) {
    case 'ADMIN':
      return [
        'org:manage',
        'users:manage',
        'properties:manage',
        'analytics:view_all',
        'branding:manage',
        'finance:manage',
        'managers:create',
      ];
    case 'MANAGER':
      return [
        'properties:view',
        'tasks:manage',
        'bookings:manage',
        'analytics:view_limited',
      ];
    default:
      return [];
  }
}
