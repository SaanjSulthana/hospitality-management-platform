import { api, APIError } from "encore.dev/api";
import { authDB } from "./db";
import { verifyRefreshToken, verifyRefreshTokenHash } from "./utils";
import log from "encore.dev/log";

export interface LogoutRequest {
  refreshToken: string;
}

// Logs out user by invalidating refresh token
export const logout = api<LogoutRequest, void>(
  { expose: true, method: "POST", path: "/auth/logout" },
  async (req) => {
    const { refreshToken } = req;

    const tx = await authDB.begin();
    try {
      const payload = verifyRefreshToken(refreshToken);
      const userId = parseInt(payload.sub);

      log.info("Logout attempt", { userId });

      // Find and delete session with matching refresh token
      const sessions = await tx.queryAll`
        SELECT id, refresh_token_hash
        FROM sessions
        WHERE user_id = ${userId}
      `;

      for (const session of sessions) {
        const isValid = await verifyRefreshTokenHash(refreshToken, session.refresh_token_hash);
        if (isValid) {
          await tx.exec`
            DELETE FROM sessions WHERE id = ${session.id}
          `;
          break;
        }
      }

      await tx.commit();
      log.info("Logout successful", { userId });
    } catch (error) {
      await tx.rollback();
      // Silently ignore invalid tokens on logout
      log.warn("Logout error (ignored)", { error: error instanceof Error ? error.message : String(error) });
    }
  }
);
