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
      SELECT t.id, t.org_id, t.property_id, t.assignee_staff_id, p.region_id
      FROM tasks t
      JOIN properties p ON t.property_id = p.id
      WHERE t.id = ${id} AND t.org_id = ${authData.orgId}
    `;

    if (!taskRow) {
      throw APIError.notFound("Task not found");
    }

    // Check role-based access
    let hasAccess = false;

    if (authData.role === 'CORP_ADMIN') {
      hasAccess = true;
    } else if (authData.role === 'REGIONAL_MANAGER' && authData.regionId === taskRow.region_id) {
      hasAccess = true;
    } else if (['PROPERTY_MANAGER', 'DEPT_HEAD'].includes(authData.role)) {
      const accessCheck = await tasksDB.queryRow`
        SELECT 1 FROM user_properties WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${taskRow.property_id}
      `;
      hasAccess = !!accessCheck;
    } else if (authData.role === 'STAFF') {
      // Staff can only update tasks assigned to them
      const staffRow = await tasksDB.queryRow`
        SELECT 1 FROM staff WHERE user_id = ${parseInt(authData.userID)} AND id = ${taskRow.assignee_staff_id}
      `;
      hasAccess = !!staffRow;
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
