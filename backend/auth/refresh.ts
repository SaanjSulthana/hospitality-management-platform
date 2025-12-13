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

// Shared handler for token refresh logic
async function refreshHandler(req: RefreshRequest): Promise<RefreshResponse> {
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
      const hashCheckResults: { sessionId: number; expiresAt: string; hashMatches: boolean }[] = [];
      
      for (const session of sessions) {
        const isValid = await verifyRefreshTokenHash(refreshToken, session.refresh_token_hash);
        hashCheckResults.push({
          sessionId: Number(session.id),
          expiresAt: session.expires_at instanceof Date ? session.expires_at.toISOString() : String(session.expires_at),
          hashMatches: isValid,
        });
        if (isValid) {
          validSession = session;
          break;
        }
      }

      // DEBUG: Enhanced logging before throwing invalid session error
      if (!validSession) {
        log.warn("[SESSION_DEBUG] Token refresh failed - no valid session found", { 
          userId,
          sessionCount: sessions.length,
          refreshTokenLength: refreshToken.length,
          refreshTokenPrefix: refreshToken.substring(0, 20) + '...',
          hashCheckResults,
          serverTime: new Date().toISOString(),
        });
        
        // Additional debug: Check if there are ANY sessions for this user (including expired)
        const allSessions = await tx.queryAll<{ id: number; expires_at: Date; created_at: Date }>`
          SELECT id, expires_at, created_at
          FROM sessions
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          LIMIT 10
        `;
        
        log.warn("[SESSION_DEBUG] All sessions for user (including expired)", {
          userId,
          totalSessionsInDb: allSessions.length,
          sessions: allSessions.map(s => ({
            id: Number(s.id),
            expiresAt: s.expires_at instanceof Date ? s.expires_at.toISOString() : String(s.expires_at),
            createdAt: s.created_at instanceof Date ? s.created_at.toISOString() : String(s.created_at),
            isExpired: s.expires_at <= new Date(),
          })),
        });
        
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
        loginCount: 1, // Set login count
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

// LEGACY: Refreshes access token using refresh token (keep for backward compatibility)
export const refresh = api<RefreshRequest, RefreshResponse>(
  { expose: true, method: "POST", path: "/auth/refresh" },
  refreshHandler
);

// V1: Refreshes access token using refresh token
export const refreshV1 = api<RefreshRequest, RefreshResponse>(
  { expose: true, method: "POST", path: "/v1/auth/refresh" },
  refreshHandler
);
