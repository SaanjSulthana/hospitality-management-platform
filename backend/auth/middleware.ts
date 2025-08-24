import { APIError, Header } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import { verifyAccessToken } from "./utils";
import { AuthData, UserRole } from "./types";

interface AuthParams {
  authorization?: Header<"Authorization">;
}

export const auth = authHandler<AuthParams, AuthData>(
  async (params) => {
    const authHeader = params.authorization;
    if (!authHeader) {
      throw APIError.unauthenticated("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      throw APIError.unauthenticated("Missing token");
    }

    try {
      const payload = verifyAccessToken(token);
      
      return {
        userID: payload.sub,
        orgId: payload.orgId,
        role: payload.role,
        email: payload.email,
        displayName: payload.displayName,
        regionId: payload.regionId,
      };
    } catch (error) {
      throw APIError.unauthenticated("Invalid token");
    }
  }
);

export function requireRole(...allowedRoles: UserRole[]) {
  return (authData: AuthData) => {
    if (!allowedRoles.includes(authData.role)) {
      throw APIError.permissionDenied(`Role ${authData.role} not allowed. Required: ${allowedRoles.join(', ')}`);
    }
  };
}

export function requireOrgAccess(orgId: number, authData: AuthData) {
  if (authData.orgId !== orgId) {
    throw APIError.permissionDenied("Access denied to this organization");
  }
}
