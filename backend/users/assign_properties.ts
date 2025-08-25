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

    // Validate user belongs to org and is MANAGER
    const userRow = await usersDB.queryRow`
      SELECT id, org_id, role FROM users WHERE id = ${id} AND org_id = ${authData.orgId}
    `;
    if (!userRow) {
      throw APIError.notFound("User not found");
    }
    if (userRow.role !== "MANAGER") {
      throw APIError.invalidArgument("Only MANAGER users can be assigned properties");
    }

    // Validate properties belong to the same org
    const props = await usersDB.rawQueryAll<{ id: number }>(
      `SELECT id FROM properties WHERE org_id = $1 AND id = ANY($2::bigint[])`,
      authData.orgId,
      propertyIds
    );
    const validIds = new Set(props.map(p => p.id));
    const toAssign = propertyIds.filter(pid => validIds.has(pid));

    const tx = await usersDB.begin();
    try {
      // Remove existing assignments
      await tx.exec`
        DELETE FROM user_properties WHERE user_id = ${id}
      `;
      // Insert new assignments
      for (const pid of toAssign) {
        await tx.exec`
          INSERT INTO user_properties (user_id, property_id)
          VALUES (${id}, ${pid})
          ON CONFLICT DO NOTHING
        `;
      }
      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw APIError.internal("Failed to update property assignments", err as Error);
    }

    return { success: true, userId: id, propertyIds: toAssign };
  }
);
