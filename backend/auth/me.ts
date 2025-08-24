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
    case 'CORP_ADMIN':
      return [
        'org:manage',
        'users:manage',
        'properties:manage',
        'regions:manage',
        'analytics:view_all',
        'branding:manage',
        'finance:manage',
      ];
    case 'REGIONAL_MANAGER':
      return [
        'properties:manage_region',
        'users:manage_region',
        'analytics:view_region',
        'finance:view_region',
      ];
    case 'PROPERTY_MANAGER':
      return [
        'properties:manage_assigned',
        'staff:manage_property',
        'tasks:manage_property',
        'bookings:manage_property',
        'analytics:view_property',
        'finance:view_property',
      ];
    case 'DEPT_HEAD':
      return [
        'staff:manage_department',
        'tasks:manage_department',
        'analytics:view_department',
      ];
    case 'STAFF':
      return [
        'tasks:view_assigned',
        'schedule:view_own',
      ];
    default:
      return [];
  }
}
