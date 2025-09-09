import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { usersDB } from "./db";
import { UserRole } from "../auth/types";
import { hashPassword } from "../auth/utils";
import log from "encore.dev/log";

export interface CreateUserRequest {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  // Optional: assign properties to the user on creation
  propertyIds?: number[];
}

export interface CreateUserResponse {
  id: number;
  email: string;
  role: UserRole;
  displayName: string;
  createdByUserId: number;
  loginCount: number;
  timezone: string;
  locale: string;
}

// Creates a new user in the organization (Admin only)
export const create = api<CreateUserRequest, CreateUserResponse>(
  { auth: true, expose: true, method: "POST", path: "/users" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    // Only ADMIN can create users
    requireRole('ADMIN')(authData);

    const { email, password, displayName, role, propertyIds } = req;

    // ADMIN can create any role (ADMIN or MANAGER)
    
    if (role !== 'MANAGER' && role !== 'ADMIN') {
      throw APIError.invalidArgument("Invalid role. Must be MANAGER or ADMIN");
    }

    if (password.length < 8) {
      throw APIError.invalidArgument("Password must be at least 8 characters");
    }

    const tx = await usersDB.begin();
    try {
      log.info("Creating user", { 
        email, 
        displayName, 
        role,
        orgId: authData.orgId, 
        createdBy: authData.userID 
      });

      // Check if user already exists in this organization
      const existingUser = await tx.queryRow`
        SELECT id FROM users WHERE org_id = ${authData.orgId} AND email = ${email}
      `;

      if (existingUser) {
        throw APIError.alreadyExists("User already exists in this organization");
      }

      const passwordHash = await hashPassword(password);

      const userRow = await tx.queryRow`
        INSERT INTO users (org_id, email, password_hash, role, display_name, created_by_user_id, login_count, timezone, locale)
        VALUES (${authData.orgId}, ${email}, ${passwordHash}, ${role}, ${displayName}, ${parseInt(authData.userID)}, 0, 'UTC', 'en-US')
        RETURNING id, email, role, display_name, created_by_user_id
      `;

      if (!userRow) {
        throw new Error("Failed to create user");
      }

      // Assign properties if provided
      if (propertyIds && propertyIds.length > 0) {
        // Validate properties belong to org using a dynamically constructed IN clause
        const placeholders = propertyIds.map((_, i) => `$${i + 2}`).join(", ");
        const sql = `
          SELECT id FROM properties
          WHERE org_id = $1 AND id IN (${placeholders})
        `;
        const props = await tx.rawQueryAll<{ id: number }>(sql, authData.orgId, ...propertyIds);
        const validIds = new Set(props.map(p => p.id));
        const toAssign = propertyIds.filter(id => validIds.has(id));
        
        for (const pid of toAssign) {
          await tx.exec`
            INSERT INTO user_properties (user_id, property_id)
            VALUES (${userRow.id}, ${pid})
            ON CONFLICT DO NOTHING
          `;
        }

        log.info("Assigned properties to user", { 
          userId: userRow.id, 
          propertyIds: toAssign 
        });
      }

      await tx.commit();
      log.info("User created successfully", { 
        userId: userRow.id, 
        email, 
        role,
        orgId: authData.orgId 
      });

      return {
        id: userRow.id,
        email: userRow.email,
        role: userRow.role as UserRole,
        displayName: userRow.display_name,
        createdByUserId: userRow.created_by_user_id,
        loginCount: 0,
        timezone: 'UTC',
        locale: 'en-US',
      };
    } catch (error) {
      await tx.rollback();
      log.error('Create user error', { 
        error: error instanceof Error ? error.message : String(error),
        email,
        displayName,
        role,
        orgId: authData.orgId,
        createdBy: authData.userID
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
      
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      
      throw APIError.internal("Failed to create user");
    }
  }
);

