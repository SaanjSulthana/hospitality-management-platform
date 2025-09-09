import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { authDB } from "./db";
import { AuthData } from "./types";

export interface MeResponse {
  user: AuthData;
  permissions: string[];
}

// Returns current user information and permissions
export const me = api<{}, MeResponse>(
  { auth: true, expose: true, method: "GET", path: "/auth/me" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    
    const permissions = getPermissionsForRole(authData.role);
    
    return {
      user: authData,
      permissions,
    };
  }
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
