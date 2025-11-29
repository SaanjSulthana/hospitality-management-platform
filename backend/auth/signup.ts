import { api, APIError } from "encore.dev/api";
import { authDB } from "./db";
import { hashPassword, generateAccessToken, generateRefreshToken, hashRefreshToken } from "./utils";
import { UserRole, User } from "./types";
import log from "encore.dev/log";

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

// Shared handler for signup logic
async function signupHandler(req: SignupRequest): Promise<SignupResponse> {
    const { email, password, displayName, organizationName, subdomainPrefix } = req;

    const tx = await authDB.begin();
    try {
      log.info("Signup attempt", { email, organizationName, subdomainPrefix });

      if (password.length < 8) {
        throw APIError.invalidArgument("Password must be at least 8 characters");
      }

      if (!organizationName || !subdomainPrefix) {
        throw APIError.invalidArgument("Organization name and subdomain prefix are required");
      }

      // Validate subdomain prefix format
      if (!/^[a-z0-9-]+$/.test(subdomainPrefix)) {
        throw APIError.invalidArgument("Subdomain prefix can only contain lowercase letters, numbers, and hyphens");
      }

      // Check if subdomain is already taken
      const existingOrg = await tx.queryRow`
        SELECT id FROM organizations WHERE subdomain_prefix = ${subdomainPrefix}
      `;

      if (existingOrg) {
        log.warn("Signup failed - subdomain taken", { subdomainPrefix });
        throw APIError.alreadyExists("Subdomain prefix already taken");
      }

      // Check if email is already used
      const existingUser = await tx.queryRow`
        SELECT id FROM users WHERE email = ${email}
      `;

      if (existingUser) {
        log.warn("Signup failed - email exists", { email });
        throw APIError.alreadyExists("Email already in use");
      }

      const passwordHash = await hashPassword(password);

      // Create organization
      const orgRow = await tx.queryRow`
        INSERT INTO organizations (name, subdomain_prefix, theme_json)
        VALUES (${organizationName}, ${subdomainPrefix}, ${JSON.stringify({
          primaryColor: "#3b82f6",
          brandName: organizationName,
          secondaryColor: "#64748b",
          accentColor: "#10b981",
          backgroundColor: "#ffffff",
          textColor: "#1f2937",
          currency: "USD",
          dateFormat: "MM/DD/YYYY",
          timeFormat: "12h"
        })})
        RETURNING id, name, subdomain_prefix, theme_json, created_at
      `;

      if (!orgRow) {
        throw new Error("Failed to create organization");
      }

      // Create first user as ADMIN
      const insertedUser = await tx.queryRow`
        INSERT INTO users (org_id, email, password_hash, role, display_name)
        VALUES (${orgRow.id}, ${email}, ${passwordHash}, 'ADMIN', ${displayName})
        RETURNING id, org_id, email, role, display_name, created_by_user_id, created_at, last_login_at
      `;

      if (!insertedUser) {
        throw new Error("Failed to create user");
      }

      // Update last login
      await tx.exec`
        UPDATE users SET last_login_at = NOW() WHERE id = ${insertedUser.id}
      `;

      const user: User = {
        id: insertedUser.id,
        orgId: insertedUser.org_id,
        email: insertedUser.email,
        role: insertedUser.role as UserRole,
        displayName: insertedUser.display_name,
        createdByUserId: insertedUser.created_by_user_id ?? undefined,
        createdAt: insertedUser.created_at,
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
      log.info("Signup successful", { email, userId: user.id, orgId: user.orgId, organizationName });

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
      log.error('Signup error', { 
        error: error instanceof Error ? error.message : String(error), 
        email, 
        organizationName, 
        subdomainPrefix 
      });
      
      // Check for specific database errors
      if (error instanceof Error) {
        if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
          if (error.message.includes('subdomain_prefix')) {
            throw APIError.alreadyExists("Subdomain prefix already taken");
          }
          if (error.message.includes('email')) {
            throw APIError.alreadyExists("Email already in use");
          }
          throw APIError.alreadyExists("A record with this information already exists");
        }
        
        if (error.message.includes('password')) {
          throw APIError.invalidArgument("Password validation failed");
        }
      }
      
      throw APIError.internal("Failed to create account. Please try again.");
    }
}

// LEGACY: Creates a new admin user and organization (keep for backward compatibility)
export const signup = api<SignupRequest, SignupResponse>(
  { expose: true, method: "POST", path: "/auth/signup" },
  signupHandler
);

// V1: Creates a new admin user and organization
export const signupV1 = api<SignupRequest, SignupResponse>(
  { expose: true, method: "POST", path: "/v1/auth/signup" },
  signupHandler
);
