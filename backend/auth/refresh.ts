import { api, APIError } from "encore.dev/api";
import { authDB } from "./db";
import { verifyRefreshToken, verifyRefreshTokenHash, generateAccessToken, generateRefreshToken, hashRefreshToken } from "./utils";
import type { User, UserRole } from "./types";
import log from "encore.dev/log";

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

// Refreshes access token using refresh token
export const refresh = api<RefreshRequest, RefreshResponse>(
  { expose: true, method: "POST", path: "/auth/refresh" },
  async (req) => {
    const { refreshToken } = req;

    const tx = await authDB.begin();
    try {
      const payload = verifyRefreshToken(refreshToken);
      const userId = parseInt(payload.sub);

      log.info("Token refresh attempt", { userId });

      // Find session with matching refresh token
      const sessions = await tx.queryAll`
        SELECT id, refresh_token_hash, expires_at
        FROM sessions
        WHERE user_id = ${userId} AND expires_at > NOW()
      `;

      let validSession: any = null;
      for (const session of sessions) {
        const isValid = await verifyRefreshTokenHash(refreshToken, session.refresh_token_hash);
        if (isValid) {
          validSession = session;
          break;
        }
      }

      if (!validSession) {
        log.warn("Token refresh failed - invalid session", { userId });
        throw APIError.unauthenticated("Invalid refresh token");
      }

      // Get user data
      const userRow = await tx.queryRow`
        SELECT id, org_id, email, role, display_name, created_by_user_id, created_at, last_login_at
        FROM users
        WHERE id = ${userId}
      `;

      if (!userRow) {
        log.warn("Token refresh failed - user not found", { userId });
        throw APIError.unauthenticated("User not found");
      }

      const user: User = {
        id: userRow.id,
        orgId: userRow.org_id,
        email: userRow.email,
        role: userRow.role as UserRole,
        displayName: userRow.display_name,
        createdByUserId: userRow.created_by_user_id ?? undefined,
        createdAt: userRow.created_at,
        lastLoginAt: userRow.last_login_at ?? undefined,
      };

      // Generate new tokens
      const newAccessToken = generateAccessToken(user);
      const newRefreshToken = generateRefreshToken(user.id);
      const newRefreshTokenHash = await hashRefreshToken(newRefreshToken);

      // Update session with new refresh token
      await tx.exec`
        UPDATE sessions
        SET refresh_token_hash = ${newRefreshTokenHash}, expires_at = NOW() + INTERVAL '7 days'
        WHERE id = ${validSession.id}
      `;

      await tx.commit();
      log.info("Token refresh successful", { userId });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      await tx.rollback();
      
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      
      log.error('Token refresh error', { error: error instanceof Error ? error.message : String(error) });
      throw APIError.unauthenticated("Invalid refresh token");
    }
  }
);
