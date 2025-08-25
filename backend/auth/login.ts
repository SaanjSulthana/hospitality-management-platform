import { api, APIError } from "encore.dev/api";
import { authDB } from "./db";
import { verifyPassword, generateAccessToken, generateRefreshToken, hashRefreshToken } from "./utils";
import { UserRole, User } from "./types";

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
  { expose: true, method: "POST", path: "/auth/login" },
  async (req) => {
    const { email, password } = req;

    // Find user by email
    const userRow = await authDB.queryRow`
      SELECT u.id, u.org_id, u.email, u.password_hash, u.role, u.display_name, u.created_by_user_id, u.created_at, u.last_login_at
      FROM users u
      WHERE u.email = ${email}
    `;

    if (!userRow) {
      throw APIError.unauthenticated("Invalid email or password");
    }

    const isValidPassword = await verifyPassword(password, userRow.password_hash);
    if (!isValidPassword) {
      throw APIError.unauthenticated("Invalid email or password");
    }

    // Update last login
    await authDB.exec`
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
      lastLoginAt: userRow.last_login_at ?? undefined,
    };

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user.id);
    const refreshTokenHash = await hashRefreshToken(refreshToken);

    // Store refresh token
    await authDB.exec`
      INSERT INTO sessions (user_id, refresh_token_hash, expires_at)
      VALUES (${user.id}, ${refreshTokenHash}, NOW() + INTERVAL '7 days')
    `;

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
  }
);
