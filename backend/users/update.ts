import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { usersDB } from "./db";
import { requireRole } from "../auth/middleware";
import { hashPassword } from "../auth/utils";

export interface UpdateUserRequest {
  id: number; // path param
  displayName?: string;
  email?: string;
  password?: string;
}

export interface UpdateUserResponse {
  success: boolean;
  id: number;
}

// Updates a manager's details (Admin only).
export const update = api<UpdateUserRequest, UpdateUserResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/users/:id" },
  async (req) => {
    const authData = getAuthData()!;
    requireRole("ADMIN")(authData);

    const { id, displayName, email, password } = req;

    const tx = await usersDB.begin();
    try {
      // Validate user in same org
      const userRow = await tx.queryRow`
        SELECT id, org_id, role FROM users WHERE id = ${id} AND org_id = ${authData.orgId}
      `;
      
      if (!userRow) {
        throw APIError.notFound("User not found");
      }
      
      if (userRow.role !== "MANAGER") {
        throw APIError.invalidArgument("Only MANAGER users can be updated by admin");
      }

      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (displayName !== undefined) {
        updates.push(`display_name = $${paramIndex++}`);
        params.push(displayName);
      }

      if (email !== undefined) {
        // Ensure email unique within org
        const exists = await tx.queryRow`
          SELECT 1 FROM users WHERE org_id = ${authData.orgId} AND email = ${email} AND id <> ${id}
        `;
        if (exists) {
          throw APIError.alreadyExists("Email already in use in this organization");
        }
        updates.push(`email = $${paramIndex++}`);
        params.push(email);
      }

      if (password !== undefined) {
        if (password && password.length < 8) {
          throw APIError.invalidArgument("Password must be at least 8 characters");
        }
        const hash = password ? await hashPassword(password) : null;
        if (hash) {
          updates.push(`password_hash = $${paramIndex++}`);
          params.push(hash);
        }
      }

      if (updates.length === 0) {
        await tx.commit();
        return { success: true, id };
      }

      params.push(id);

      const query = `
        UPDATE users
        SET ${updates.join(", ")}
        WHERE id = $${paramIndex} AND org_id = ${authData.orgId}
      `;

      await tx.rawExec(query, ...params);
      await tx.commit();

      return { success: true, id };
    } catch (error) {
      await tx.rollback();
      console.error('Update user error:', error);
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      throw APIError.internal("Failed to update user");
    }
  }
);
