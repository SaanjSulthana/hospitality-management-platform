import { APIError, Header, Query } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import { verifyAccessToken } from "./utils";
import { AuthData } from "./types";

interface AuthParams {
  authorization?: Header<"Authorization">;
  // WebSocket/browser-friendly fallback: token passed as query param during upgrade
  access_token?: Query<"access_token">;
}

export const auth = authHandler<AuthParams, AuthData>(
  async (params) => {
    // 1) Prefer Authorization header
    let token: string | undefined;
    const authHeader = params.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.replace("Bearer ", "");
    }

    // 2) Fallback to ?access_token=... query param (e.g., WebSocket upgrade)
    if (!token && params.access_token) {
      token = String(params.access_token);
    }

    if (!token) throw APIError.unauthenticated("Missing token");

    try {
      const payload = verifyAccessToken(token);
      
      return {
        userID: payload.sub,
        orgId: payload.orgId,
        role: payload.role,
        email: payload.email,
        displayName: payload.displayName,
        createdByUserId: payload.createdByUserId,
      };
    } catch (error) {
      console.error('Token verification failed:', error);
      throw APIError.unauthenticated("Invalid token");
    }
  }
);

export function requireRole(...allowedRoles: string[]) {
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


