import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { usersDB } from "./db";
import { requireRole } from "../auth/middleware";

export interface AssignPropertiesRequest {
  id: number; // path param
  propertyIds: number[];
}

export interface AssignPropertiesResponse {
  success: boolean;
  userId: number;
  propertyIds: number[];
}

// Assigns properties to a manager (Admin only).
// Replaces existing assignments with the provided list.
export const assignProperties = api<AssignPropertiesRequest, AssignPropertiesResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/users/:id/properties" },
  async (req) => {
    const authData = getAuthData()!;
    requireRole("ADMIN")(authData);

    const { id, propertyIds } = req;

    const tx = await usersDB.begin();
    try {
      // Validate user belongs to org and is MANAGER
      const userRow = await tx.queryRow`
        SELECT id, org_id, role FROM users WHERE id = ${id} AND org_id = ${authData.orgId}
      `;
      
      if (!userRow) {
        throw APIError.notFound("User not found");
      }
      
      if (userRow.role !== "MANAGER") {
        throw APIError.invalidArgument("Only MANAGER users can be assigned properties");
      }

      // Remove existing assignments
      await tx.exec`
        DELETE FROM user_properties WHERE user_id = ${id}
      `;

      let toAssign: number[] = [];
      if (propertyIds && propertyIds.length > 0) {
        // Validate properties belong to the same org using a dynamically constructed IN clause
        const placeholders = propertyIds.map((_, i) => `$${i + 2}`).join(", ");
        const sql = `
          SELECT id FROM properties
          WHERE org_id = $1 AND id IN (${placeholders})
        `;
        const props = await tx.rawQueryAll<{ id: number }>(sql, authData.orgId, ...propertyIds);
        const validIds = new Set(props.map((p) => p.id));
        toAssign = propertyIds.filter((pid) => validIds.has(pid));

        // Insert new assignments
        for (const pid of toAssign) {
          await tx.exec`
            INSERT INTO user_properties (user_id, property_id)
            VALUES (${id}, ${pid})
            ON CONFLICT DO NOTHING
          `;
        }
      }

      await tx.commit();

      return { success: true, userId: id, propertyIds: toAssign };
    } catch (error) {
      await tx.rollback();
      console.error('Assign properties error:', error);
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      throw APIError.internal("Failed to update property assignments");
    }
  }
);
