import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { tasksDB } from "./db";
import { TaskStatus } from "./types";
import log from "encore.dev/log";

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

    const tx = await tasksDB.begin();
    try {
      log.info("Updating task status", { 
        taskId: id, 
        newStatus: status,
        userId: authData.userID,
        orgId: authData.orgId 
      });

      // Get task and check access with org scoping
      const taskRow = await tx.queryRow`
        SELECT t.id, t.org_id, t.property_id, t.assignee_staff_id, t.status as current_status
        FROM tasks t
        WHERE t.id = ${id} AND t.org_id = ${authData.orgId}
      `;

      if (!taskRow) {
        throw APIError.notFound("Task not found");
      }

      // Access rules: ADMIN can update any; MANAGER only if they have access to the property or are assigned
      let hasAccess = false;

      if (authData.role === "ADMIN") {
        hasAccess = true;
      } else if (authData.role === "MANAGER") {
        // Check if manager has access to the property
        const accessCheck = await tx.queryRow`
          SELECT 1 FROM user_properties WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${taskRow.property_id}
        `;
        
        // Or check if they are assigned to this task
        const assigneeCheck = await tx.queryRow`
          SELECT 1 FROM staff WHERE id = ${taskRow.assignee_staff_id} AND user_id = ${parseInt(authData.userID)} AND org_id = ${authData.orgId}
        `;
        
        hasAccess = !!(accessCheck || assigneeCheck);
      }

      if (!hasAccess) {
        throw APIError.permissionDenied("No access to this task");
      }

      // Update task status and completion time if marking as done
      const completedAt = status === 'done' ? new Date() : null;
      
      await tx.exec`
        UPDATE tasks 
        SET status = ${status}, updated_at = NOW(), completed_at = ${completedAt}
        WHERE id = ${id} AND org_id = ${authData.orgId}
      `;

      await tx.commit();
      log.info("Task status updated successfully", { 
        taskId: id, 
        oldStatus: taskRow.current_status,
        newStatus: status,
        userId: authData.userID,
        orgId: authData.orgId 
      });

      return { success: true };
    } catch (error) {
      await tx.rollback();
      log.error('Update task status error', { 
        error: error instanceof Error ? error.message : String(error),
        taskId: id,
        status,
        userId: authData.userID,
        orgId: authData.orgId
      });
      
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      
      throw APIError.internal("Failed to update task status");
    }
  }
);
