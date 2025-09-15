import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { tasksDB } from "./db";
import log from "encore.dev/log";

export interface DeleteTaskRequest {
  id: number;
}

export interface DeleteTaskResponse {
  success: boolean;
  message: string;
}

// Deletes a task
export const deleteTask = api<DeleteTaskRequest, DeleteTaskResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/tasks/:id" },
  async (req) => {
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
);
