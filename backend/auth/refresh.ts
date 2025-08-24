import { api, APIError } from "encore.dev/api";
import { authDB } from "./db";
import { verifyRefreshToken, verifyRefreshTokenHash, generateAccessToken, generateRefreshToken, hashRefreshToken } from "./utils";

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

    try {
      const payload = verifyRefreshToken(refreshToken);
      const userId = parseInt(payload.sub);

      // Find session with matching refresh token
      const sessions = await authDB.queryAll`
        SELECT id, refresh_token_hash, expires_at
        FROM sessions
        WHERE user_id = ${userId} AND expires_at > NOW()
      `;

      let validSession = null;
      for (const session of sessions) {
        const isValid = await verifyRefreshTokenHash(refreshToken, session.refresh_token_hash);
        if (isValid) {
          validSession = session;
          break;
        }
      }

      if (!validSession) {
        throw APIError.unauthenticated("Invalid refresh token");
      }

      // Get user data
      const userRow = await authDB.queryRow`
        SELECT id, org_id, email, role, display_name, region_id, created_at, last_login_at
        FROM users
        WHERE id = ${userId}
      `;

      if (!userRow) {
        throw APIError.unauthenticated("User not found");
      }

      // Generate new tokens
      const newAccessToken = generateAccessToken(userRow);
      const newRefreshToken = generateRefreshToken(userRow.id);
      const newRefreshTokenHash = await hashRefreshToken(newRefreshToken);

      // Update session with new refresh token
      await authDB.exec`
        UPDATE sessions
        SET refresh_token_hash = ${newRefreshTokenHash}, expires_at = NOW() + INTERVAL '7 days'
        WHERE id = ${validSession.id}
      `;

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw APIError.unauthenticated("Invalid refresh token");
    }
  }
);
