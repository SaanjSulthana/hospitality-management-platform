import { api, APIError } from "encore.dev/api";
import { authDB } from "./db";
import { verifyRefreshToken, verifyRefreshTokenHash } from "./utils";

export interface LogoutRequest {
  refreshToken: string;
}

// Logs out user by invalidating refresh token
export const logout = api<LogoutRequest, void>(
  { expose: true, method: "POST", path: "/auth/logout" },
  async (req) => {
    const { refreshToken } = req;

    try {
      const payload = verifyRefreshToken(refreshToken);
      const userId = parseInt(payload.sub);

      // Find and delete session with matching refresh token
      const sessions = await authDB.queryAll`
        SELECT id, refresh_token_hash
        FROM sessions
        WHERE user_id = ${userId}
      `;

      for (const session of sessions) {
        const isValid = await verifyRefreshTokenHash(refreshToken, session.refresh_token_hash);
        if (isValid) {
          await authDB.exec`
            DELETE FROM sessions WHERE id = ${session.id}
          `;
          break;
        }
      }
    } catch (error) {
      // Silently ignore invalid tokens on logout
    }
  }
);
