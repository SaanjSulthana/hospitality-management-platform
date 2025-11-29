import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { tasksDB } from "./db";
import { v1Path } from "../shared/http";
import log from "encore.dev/log";
import { taskEvents } from "./events";
import { v4 as uuidv4 } from "uuid";

export interface DeleteTaskRequest {
  id: number;
}

export interface DeleteTaskResponse {
  success: boolean;
  message: string;
}

// Handler function for deleting a task
async function deleteTaskHandler(req: DeleteTaskRequest): Promise<DeleteTaskResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { id } = req;

    const tx = await tasksDB.begin();
    try {
      log.info("Deleting task", { 
        taskId: id,
        orgId: authData.orgId, 
        userId: authData.userID 
      });

      // Get task and check access with org scoping
      const taskRow = await tx.queryRow`
        SELECT t.id, t.org_id, t.property_id, t.title
        FROM tasks t
        WHERE t.id = ${id} AND t.org_id = ${authData.orgId}
      `;

      if (!taskRow) {
        throw APIError.notFound("Task not found");
      }

      // Access rules: ADMIN can delete any; MANAGER only if they have access to the property
      let hasAccess = false;

      if (authData.role === "ADMIN") {
        hasAccess = true;
      } else if (authData.role === "MANAGER") {
        // Check if manager has access to the property
        const accessCheck = await tx.queryRow`
          SELECT 1 FROM user_properties WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${taskRow.property_id}
        `;
        
        hasAccess = !!accessCheck;
      }

      if (!hasAccess) {
        throw APIError.permissionDenied("No access to delete this task");
      }

      // Delete task attachments first (if any)
      await tx.exec`
        DELETE FROM task_attachments 
        WHERE task_id = ${id} AND org_id = ${authData.orgId}
      `;

      // Delete the task
      await tx.exec`
        DELETE FROM tasks 
        WHERE id = ${id} AND org_id = ${authData.orgId}
      `;

      await tx.commit();
      log.info("Task deleted successfully", { taskId: id, taskTitle: taskRow.title });

      // Publish task_deleted
      try {
        await taskEvents.publish({
          eventId: uuidv4(),
          eventVersion: 'v1',
          eventType: 'task_deleted',
          orgId: authData.orgId,
          propertyId: taskRow.property_id,
          userId: parseInt(authData.userID),
          timestamp: new Date(),
          entityId: id,
          entityType: 'task',
          metadata: {
            title: taskRow.title,
          },
        });
      } catch (e) {
        log.warn("Task event publish failed (task_deleted)", { error: e instanceof Error ? e.message : String(e) });
      }

      return {
        success: true,
        message: `Task "${taskRow.title}" has been deleted successfully`,
      };
    } catch (error) {
      await tx.rollback();
      log.error("Failed to delete task", { error, taskId: id });
      throw error;
    }
}

// Legacy path
export const deleteTask = api<DeleteTaskRequest, DeleteTaskResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/tasks/:id" },
  deleteTaskHandler
);

// Versioned path
export const deleteTaskV1 = api<DeleteTaskRequest, DeleteTaskResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/v1/tasks/:id" },
  deleteTaskHandler
);
