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

// Authenticates user and returns JWT tokens
export const login = api<LoginRequest, LoginResponse>(
  { 
    expose: true, 
    method: "POST", 
    path: "/auth/login",
    cors: {
      allowOrigins: [
        "http://localhost:5173",
        "http://localhost:5174", 
        "https://staging-hospitality-management-platform-cr8i.frontend.encr.app",
        "https://hospitality-management-platform-cr8i.frontend.encr.app"
      ],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      allowCredentials: true
    }
  },
  async (req) => {
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

      // Update last login
      await tx.exec`
        UPDATE users SET last_login_at = NOW() WHERE id = ${userRow.id}
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

      await tx.commit();
      log.info("Login successful", { email, userId: user.id, orgId: user.orgId });

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
);
