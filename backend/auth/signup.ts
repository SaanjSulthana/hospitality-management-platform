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
  signupToken?: string;
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

// Creates a new user and organization, or joins existing org with signup token
export const signup = api<SignupRequest, SignupResponse>(
  { expose: true, method: "POST", path: "/auth/signup" },
  async (req) => {
    const { email, password, displayName, organizationName, subdomainPrefix, signupToken } = req;

    if (password.length < 8) {
      throw APIError.invalidArgument("Password must be at least 8 characters");
    }

    const passwordHash = await hashPassword(password);

    if (signupToken) {
      // Join existing organization with signup token
      const tokenRow = await authDB.queryRow`
        SELECT org_id, email, role, expires_at, used_at 
        FROM signup_tokens 
        WHERE token = ${signupToken}
      `;

      if (!tokenRow) {
        throw APIError.invalidArgument("Invalid signup token");
      }

      if (tokenRow.used_at) {
        throw APIError.invalidArgument("Signup token already used");
      }

      if (new Date() > tokenRow.expires_at) {
        throw APIError.invalidArgument("Signup token expired");
      }

      if (tokenRow.email !== email) {
        throw APIError.invalidArgument("Email does not match signup token");
      }

      // Check if user already exists
      const existingUser = await authDB.queryRow`
        SELECT id FROM users WHERE org_id = ${tokenRow.org_id} AND email = ${email}
      `;

      if (existingUser) {
        throw APIError.alreadyExists("User already exists in this organization");
      }

      // Create user
      const userRow = await authDB.queryRow`
        INSERT INTO users (org_id, email, password_hash, role, display_name)
        VALUES (${tokenRow.org_id}, ${email}, ${passwordHash}, ${tokenRow.role}, ${displayName})
        RETURNING id, org_id, email, role, display_name, region_id, created_at, last_login_at
      `;

      // Mark token as used
      await authDB.exec`
        UPDATE signup_tokens 
        SET used_at = NOW() 
        WHERE token = ${signupToken}
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
    } else {
      // Create new organization and first user
      if (!organizationName || !subdomainPrefix) {
        throw APIError.invalidArgument("Organization name and subdomain prefix are required for new organizations");
      }

      // Check if subdomain is already taken
      const existingOrg = await authDB.queryRow`
        SELECT id FROM organizations WHERE subdomain_prefix = ${subdomainPrefix}
      `;

      if (existingOrg) {
        throw APIError.alreadyExists("Subdomain prefix already taken");
      }

      // Create organization
      const orgRow = await authDB.queryRow`
        INSERT INTO organizations (name, subdomain_prefix, theme_json)
        VALUES (${organizationName}, ${subdomainPrefix}, '{}')
        RETURNING id, name, subdomain_prefix, theme_json, created_at
      `;

      // Create first user as CORP_ADMIN
      const userRow = await authDB.queryRow`
        INSERT INTO users (org_id, email, password_hash, role, display_name)
        VALUES (${orgRow.id}, ${email}, ${passwordHash}, 'CORP_ADMIN', ${displayName})
        RETURNING id, org_id, email, role, display_name, region_id, created_at, last_login_at
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
  }
);
