import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { usersDB } from "./db";
import { requireRole } from "../auth/middleware";
import type { UserRole } from "../auth/types";

export interface GetUserRequest {
  id: number;
}

export interface GetUserResponse {
  id: number;
  email: string;
  role: UserRole;
  displayName: string;
  createdAt: Date;
  lastLoginAt?: Date;
  propertyIds: number[];
}

// Gets user details including assigned property IDs (Admin only)
export const get = api<GetUserRequest, GetUserResponse>(
  { auth: true, expose: true, method: "GET", path: "/users/:id" },
  async (req) => {
    const authData = getAuthData()!;
    requireRole("ADMIN")(authData);

    const { id } = req;

    try {
      const userRow = await usersDB.queryRow`
        SELECT id, email, role, display_name, created_at, last_login_at, org_id
        FROM users
        WHERE id = ${id} AND org_id = ${authData.orgId}
      `;
      
      if (!userRow) {
        throw APIError.notFound("User not found");
      }

      const props = await usersDB.queryAll`
        SELECT property_id FROM user_properties WHERE user_id = ${id}
      `;
      const propertyIds = props.map((p: any) => p.property_id as number);

      return {
        id: userRow.id,
        email: userRow.email,
        role: userRow.role as UserRole,
        displayName: userRow.display_name,
        createdAt: userRow.created_at,
        lastLoginAt: userRow.last_login_at ?? undefined,
        propertyIds,
      };
    } catch (error) {
      console.error('Get user error:', error);
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      throw APIError.internal("Failed to fetch user details");
    }
  }
);
