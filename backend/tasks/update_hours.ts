import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { tasksDB } from "./db";
import { v1Path } from "../shared/http";
import { taskEvents } from "./events";
import { v4 as uuidv4 } from "uuid";

export interface UpdateTaskHoursRequest {
  id: number;
  estimatedHours?: number;
  actualHours?: number;
}

export interface UpdateTaskHoursResponse {
  success: boolean;
  taskId: number;
  estimatedHours?: number;
  actualHours?: number;
}

// Handler function for updating task hours
async function updateTaskHoursHandler(req: UpdateTaskHoursRequest): Promise<UpdateTaskHoursResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { id, estimatedHours, actualHours } = req;

    // Get task and check access
    const taskRow = await tasksDB.queryRow`
      SELECT t.id, t.org_id, t.property_id, t.status
      FROM tasks t
      WHERE t.id = ${id} AND t.org_id = ${authData.orgId}
    `;

    if (!taskRow) {
      throw APIError.notFound("Task not found");
    }

    // Managers must have access to the property
    if (authData.role === "MANAGER") {
      const accessCheck = await tasksDB.queryRow`
        SELECT 1 FROM user_properties WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${taskRow.property_id}
      `;
      if (!accessCheck) {
        throw APIError.permissionDenied("No access to this task");
      }
    }

    // Build update query dynamically
    let updateFields: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (estimatedHours !== undefined) {
      updateFields.push(`estimated_hours = $${paramIndex}`);
      params.push(estimatedHours);
      paramIndex++;
    }

    if (actualHours !== undefined) {
      updateFields.push(`actual_hours = $${paramIndex}`);
      params.push(actualHours);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      throw APIError.invalidArgument("No hours to update");
    }

    updateFields.push(`updated_at = NOW()`);
    params.push(id);

    const query = `
      UPDATE tasks 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
    `;

    await tasksDB.rawExec(query, ...params);

    // Publish task_hours_updated
    try {
      await taskEvents.publish({
        eventId: uuidv4(),
        eventVersion: 'v1',
        eventType: 'task_hours_updated',
        orgId: authData.orgId,
        propertyId: taskRow.property_id,
        userId: parseInt(authData.userID),
        timestamp: new Date(),
        entityId: id,
        entityType: 'task',
        metadata: {
          estimatedHours,
          actualHours,
        },
      });
    } catch {}

    return {
      success: true,
      taskId: id,
      estimatedHours,
      actualHours,
    };
}

// Legacy path
export const updateHours = api<UpdateTaskHoursRequest, UpdateTaskHoursResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/tasks/:id/hours" },
  updateTaskHoursHandler
);

// Versioned path
export const updateHoursV1 = api<UpdateTaskHoursRequest, UpdateTaskHoursResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/v1/tasks/:id/hours" },
  updateTaskHoursHandler
);

