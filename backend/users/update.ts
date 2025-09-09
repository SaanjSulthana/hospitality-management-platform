import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { usersDB } from "./db";
import { hashPassword } from "../auth/utils";
import log from "encore.dev/log";

export interface UpdateUserRequest {
  id: number;
  displayName?: string;
  email?: string;
  password?: string;
  role?: 'ADMIN' | 'MANAGER';
}

export interface UpdateUserResponse {
  success: boolean;
  id: number;
}

// Updates a user's details (Admin only).
export const update = api<UpdateUserRequest, UpdateUserResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/users/:id" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    const { id: userId } = req;
    requireRole("ADMIN")(authData);

    console.log('Update user request:', { 
      receivedId: userId, 
      type: typeof userId, 
      requestBody: req,
      orgId: authData.orgId 
    });

    // Convert userId to number if it's a string (from URL path)
    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    
    if (isNaN(userIdNum)) {
      console.error('Invalid user ID received:', userId);
      throw APIError.invalidArgument("Invalid user ID");
    }

    const { displayName, email, password, role } = req;

    const tx = await usersDB.begin();
    try {
      log.info("Updating user", { 
        userId: userIdNum, 
        displayName, 
        email,
        hasPassword: !!password,
        role,
        orgId: authData.orgId, 
        updatedBy: authData.userID 
      });

      // Validate user in same org
      const userRow = await tx.queryRow`
        SELECT id, org_id, role, email as current_email FROM users WHERE id = ${userIdNum} AND org_id = ${authData.orgId}
      `;
      
      if (!userRow) {
        throw APIError.notFound("User not found");
      }
      
      // Check if admin is trying to update their own role (not allowed)
      if (userRow.role === "ADMIN" && authData.userID === userRow.id.toString() && role !== undefined) {
        throw APIError.invalidArgument("Cannot update your own admin role");
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
          SELECT 1 FROM users WHERE org_id = ${authData.orgId} AND email = ${email} AND id <> ${userIdNum}
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

      if (role !== undefined) {
        // Validate role value
        if (role !== 'ADMIN' && role !== 'MANAGER') {
          throw APIError.invalidArgument("Role must be either 'ADMIN' or 'MANAGER'");
        }
        
        // ADMIN can change any role to ADMIN or MANAGER
        
        // If demoting from ADMIN to MANAGER, check if this is the last admin
        if (userRow.role === 'ADMIN' && role === 'MANAGER') {
          const adminCount = await tx.queryRow`
            SELECT COUNT(*) as count FROM users WHERE org_id = ${authData.orgId} AND role = 'ADMIN'
          `;
          if (adminCount && adminCount.count <= 1) {
            throw APIError.invalidArgument("Cannot demote the last admin in the organization");
          }
        }
        
        
        updates.push(`role = $${paramIndex++}`);
        params.push(role);
      }

      if (updates.length === 0) {
        await tx.commit();
        log.info("No updates needed for user", { userId: userIdNum });
        return { success: true, id: userIdNum };
      }

      params.push(userIdNum);

      const query = `
        UPDATE users
        SET ${updates.join(", ")}
        WHERE id = $${paramIndex} AND org_id = ${authData.orgId}
      `;

      await tx.rawExec(query, ...params);
      await tx.commit();
      
      log.info("User updated successfully", { 
        userId: userIdNum, 
        updatedFields: updates.length,
        orgId: authData.orgId 
      });

      return { success: true, id: userIdNum };
    } catch (error) {
      await tx.rollback();
      log.error('Update user error', { 
        error: error instanceof Error ? error.message : String(error),
        userId: userIdNum,
        orgId: authData.orgId,
        updatedBy: authData.userID
      });
      
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      
      throw APIError.internal("Failed to update user");
    }
  }
);

