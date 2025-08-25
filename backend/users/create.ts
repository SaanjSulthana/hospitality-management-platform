import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { usersDB } from "./db";
import { requireRole } from "../auth/middleware";
import { UserRole } from "../auth/types";
import { hashPassword } from "../auth/utils";

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
}

// Creates a new user in the organization (Admin only)
export const create = api<CreateUserRequest, CreateUserResponse>(
  { auth: true, expose: true, method: "POST", path: "/users" },
  async (req) => {
    const authData = getAuthData()!;
    requireRole('ADMIN')(authData);

    const { email, password, displayName, role, propertyIds } = req;

    // Only admins can create managers
    if (role !== 'MANAGER') {
      throw APIError.invalidArgument("Only MANAGER role can be created");
    }

    if (password.length < 8) {
      throw APIError.invalidArgument("Password must be at least 8 characters");
    }

    const tx = await usersDB.begin();
    try {
      // Check if user already exists in this organization
      const existingUser = await tx.queryRow`
        SELECT id FROM users WHERE org_id = ${authData.orgId} AND email = ${email}
      `;

      if (existingUser) {
        throw APIError.alreadyExists("User already exists in this organization");
      }

      const passwordHash = await hashPassword(password);

      const userRow = await tx.queryRow`
        INSERT INTO users (org_id, email, password_hash, role, display_name, created_by_user_id)
        VALUES (${authData.orgId}, ${email}, ${passwordHash}, ${role}, ${displayName}, ${parseInt(authData.userID)})
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
      }

      await tx.commit();

      return {
        id: userRow.id,
        email: userRow.email,
        role: userRow.role as UserRole,
        displayName: userRow.display_name,
        createdByUserId: userRow.created_by_user_id,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Create user error:', error);
      
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
