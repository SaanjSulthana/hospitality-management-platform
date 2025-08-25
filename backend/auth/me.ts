import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { AuthData } from "./types";

export interface MeResponse {
  user: AuthData;
  permissions: string[];
}

// Returns current user information and permissions
export const me = api<void, MeResponse>(
  { auth: true, expose: true, method: "GET", path: "/auth/me" },
  async () => {
    const authData = getAuthData()!;
    
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
