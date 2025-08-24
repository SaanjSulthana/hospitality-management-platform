import { api, APIError } from "encore.dev/api";
import { authDB } from "./db";
import { verifyPassword, generateAccessToken, generateRefreshToken, hashRefreshToken } from "./utils";
import { UserRole } from "./types";

export interface LoginRequest {
  email: string;
  password: string;
  orgSubdomain?: string;
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
    const { email, password, orgSubdomain } = req;

    let userRow;

    if (orgSubdomain) {
      // Login with specific organization subdomain
      userRow = await authDB.queryRow`
        SELECT u.id, u.org_id, u.email, u.password_hash, u.role, u.display_name, u.region_id, u.created_at, u.last_login_at
        FROM users u
        JOIN organizations o ON u.org_id = o.id
        WHERE u.email = ${email} AND o.subdomain_prefix = ${orgSubdomain}
      `;
    } else {
      // Login without subdomain - find user by email (could be multiple orgs)
      const users = await authDB.queryAll`
        SELECT u.id, u.org_id, u.email, u.password_hash, u.role, u.display_name, u.region_id, u.created_at, u.last_login_at
        FROM users u
        WHERE u.email = ${email}
      `;

      if (users.length === 0) {
        throw APIError.unauthenticated("Invalid email or password");
      }

      if (users.length > 1) {
        throw APIError.invalidArgument("Multiple accounts found. Please specify organization subdomain");
      }

      userRow = users[0];
    }

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

    // Generate tokens
    const accessToken = generateAccessToken(userRow);
    const refreshToken = generateRefreshToken(userRow.id);
    const refreshTokenHash = await hashRefreshToken(refreshToken);

    // Store refresh token
    await authDB.exec`
      INSERT INTO sessions (user_id, refresh_token_hash, expires_at)
      VALUES (${userRow.id}, ${refreshTokenHash}, NOW() + INTERVAL '7 days')
    `;

    return {
      accessToken,
      refreshToken,
      user: {
        id: userRow.id,
        email: userRow.email,
        displayName: userRow.display_name,
        role: userRow.role as UserRole,
        orgId: userRow.org_id,
      },
    };
  }
);
