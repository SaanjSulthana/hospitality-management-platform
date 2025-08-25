import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { tasksDB } from "./db";
import { TaskStatus } from "./types";

export interface UpdateTaskStatusRequest {
  id: number;
  status: TaskStatus;
}

export interface UpdateTaskStatusResponse {
  success: boolean;
}

// Updates the status of a task
export const updateStatus = api<UpdateTaskStatusRequest, UpdateTaskStatusResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/tasks/:id/status" },
  async (req) => {
    const authData = getAuthData()!;
    const { id, status } = req;

    // Get task and check access
    const taskRow = await tasksDB.queryRow`
      SELECT t.id, t.org_id, t.property_id
      FROM tasks t
      WHERE t.id = ${id} AND t.org_id = ${authData.orgId}
    `;

    if (!taskRow) {
      throw APIError.notFound("Task not found");
    }

    // Access rules: ADMIN can update any; MANAGER only if they have access to the property
    let hasAccess = false;

    if (authData.role === "ADMIN") {
      hasAccess = true;
    } else if (authData.role === "MANAGER") {
      const accessCheck = await tasksDB.queryRow`
        SELECT 1 FROM user_properties WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${taskRow.property_id}
      `;
      hasAccess = !!accessCheck;
    }

    if (!hasAccess) {
      throw APIError.permissionDenied("No access to this task");
    }

    // Update task status
    await tasksDB.exec`
      UPDATE tasks 
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${id}
    `;

    return { success: true };
  }
);
