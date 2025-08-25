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

    const { email, password, displayName, role } = req;

    // Only admins can create managers
    if (role !== 'MANAGER') {
      throw APIError.invalidArgument("Only MANAGER role can be created");
    }

    if (password.length < 8) {
      throw APIError.invalidArgument("Password must be at least 8 characters");
    }

    // Check if user already exists
    const existingUser = await usersDB.queryRow`
      SELECT id FROM users WHERE org_id = ${authData.orgId} AND email = ${email}
    `;

    if (existingUser) {
      throw APIError.alreadyExists("User already exists in this organization");
    }

    const passwordHash = await hashPassword(password);

    // Create user
    const userRow = await usersDB.queryRow`
      INSERT INTO users (org_id, email, password_hash, role, display_name, created_by_user_id)
      VALUES (${authData.orgId}, ${email}, ${passwordHash}, ${role}, ${displayName}, ${parseInt(authData.userID)})
      RETURNING id, email, role, display_name, created_by_user_id
    `;

    return {
      id: userRow.id,
      email: userRow.email,
      role: userRow.role as UserRole,
      displayName: userRow.display_name,
      createdByUserId: userRow.created_by_user_id,
    };
  }
);
