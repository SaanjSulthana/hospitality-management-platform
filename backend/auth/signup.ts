import { api, APIError } from "encore.dev/api";
import { authDB } from "./db";
import { hashPassword, generateAccessToken, generateRefreshToken, hashRefreshToken } from "./utils";
import { UserRole } from "./types";

export interface SignupRequest {
  email: string;
  password: string;
  displayName: string;
  organizationName: string;
  subdomainPrefix: string;
}

export interface SignupResponse {
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

// Creates a new admin user and organization
export const signup = api<SignupRequest, SignupResponse>(
  { expose: true, method: "POST", path: "/auth/signup" },
  async (req) => {
    const { email, password, displayName, organizationName, subdomainPrefix } = req;

    if (password.length < 8) {
      throw APIError.invalidArgument("Password must be at least 8 characters");
    }

    if (!organizationName || !subdomainPrefix) {
      throw APIError.invalidArgument("Organization name and subdomain prefix are required");
    }

    // Check if subdomain is already taken
    const existingOrg = await authDB.queryRow`
      SELECT id FROM organizations WHERE subdomain_prefix = ${subdomainPrefix}
    `;

    if (existingOrg) {
      throw APIError.alreadyExists("Subdomain prefix already taken");
    }

    // Check if email is already used
    const existingUser = await authDB.queryRow`
      SELECT id FROM users WHERE email = ${email}
    `;

    if (existingUser) {
      throw APIError.alreadyExists("Email already in use");
    }

    const passwordHash = await hashPassword(password);

    // Create organization
    const orgRow = await authDB.queryRow`
      INSERT INTO organizations (name, subdomain_prefix, theme_json)
      VALUES (${organizationName}, ${subdomainPrefix}, '{}')
      RETURNING id, name, subdomain_prefix, theme_json, created_at
    `;

    // Create first user as ADMIN
    const userRow = await authDB.queryRow`
      INSERT INTO users (org_id, email, password_hash, role, display_name)
      VALUES (${orgRow.id}, ${email}, ${passwordHash}, 'ADMIN', ${displayName})
      RETURNING id, org_id, email, role, display_name, created_by_user_id, created_at, last_login_at
    `;

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
