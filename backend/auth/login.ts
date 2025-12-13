import { api, APIError } from "encore.dev/api";
import { authDB } from "./db";
import { verifyPassword, generateAccessToken, generateRefreshToken, hashRefreshToken } from "./utils";
import { UserRole, User } from "./types";
import log from "encore.dev/log";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    email: string;
    displayName: string;
    role: UserRole;
    orgId: number;
  };
}

// Shared handler for authentication logic
async function loginHandler(req: LoginRequest): Promise<LoginResponse> {
    const { email, password } = req;

    const tx = await authDB.begin();
    try {
      log.info("Login attempt", { email });

      // Find user by email
      const userRow = await tx.queryRow`
        SELECT u.id, u.org_id, u.email, u.password_hash, u.role, u.display_name, u.created_by_user_id, u.created_at, u.last_login_at
        FROM users u
        WHERE u.email = ${email}
      `;

      if (!userRow) {
        log.warn("Login failed - user not found", { email });
        throw APIError.unauthenticated("Invalid email or password");
      }

      const isValidPassword = await verifyPassword(password, userRow.password_hash);
      if (!isValidPassword) {
        log.warn("Login failed - invalid password", { email, userId: userRow.id });
        throw APIError.unauthenticated("Invalid email or password");
      }

      // Update last login and increment login count
      await tx.exec`
        UPDATE users 
        SET 
          last_login_at = NOW(),
          login_count = COALESCE(login_count, 0) + 1
        WHERE id = ${userRow.id}
      `;

      // Map to User type for JWT
      const user: User = {
        id: userRow.id,
        orgId: userRow.org_id,
        email: userRow.email,
        role: userRow.role as UserRole,
        displayName: userRow.display_name,
        createdByUserId: userRow.created_by_user_id ?? undefined,
        createdAt: userRow.created_at,
        lastLoginAt: new Date(),
        loginCount: 1, // Set initial login count
      };

      // Generate tokens
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user.id);
      const refreshTokenHash = await hashRefreshToken(refreshToken);

      // Store refresh token
      await tx.exec`
        INSERT INTO sessions (user_id, refresh_token_hash, expires_at)
        VALUES (${user.id}, ${refreshTokenHash}, NOW() + INTERVAL '7 days')
      `;

      // DEBUG: Verify session was created successfully
      const createdSession = await tx.queryRow<{
        id: number;
        user_id: number;
        expires_at: Date;
        created_at: Date;
      }>`
        SELECT id, user_id, expires_at, created_at
        FROM sessions
        WHERE user_id = ${user.id}
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (createdSession) {
        log.info("[SESSION_DEBUG] Session created on login", {
          userId: user.id,
          sessionId: createdSession.id,
          expiresAt: createdSession.expires_at.toISOString(),
          createdAt: createdSession.created_at.toISOString(),
          refreshTokenLength: refreshToken.length,
          refreshTokenHashLength: refreshTokenHash.length,
        });
      } else {
        log.error("[SESSION_DEBUG] CRITICAL: Session NOT found after INSERT!", {
          userId: user.id,
          email,
        });
      }

      await tx.commit();
      log.info("Login successful", { email, userId: user.id, orgId: user.orgId });
      log.info("[SESSION_DEBUG] Login transaction committed", { userId: user.id });

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          orgId: user.orgId,
        },
      };
    } catch (error) {
      await tx.rollback();
      
      // If it's already an APIError, re-throw it
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      
      // Log the actual error for debugging
      log.error('Login error', { error: error instanceof Error ? error.message : String(error), email });
      throw APIError.internal("Login failed. Please try again.");
    }
}

// LEGACY: Authenticates user and returns JWT tokens (keep for backward compatibility)
export const login = api<LoginRequest, LoginResponse>(
  { expose: true, method: "POST", path: "/auth/login" },
  loginHandler
);

// V1: Authenticates user and returns JWT tokens
export const loginV1 = api<LoginRequest, LoginResponse>(
  { expose: true, method: "POST", path: "/v1/auth/login" },
  loginHandler
);
