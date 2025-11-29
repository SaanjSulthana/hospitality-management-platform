import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { tasksDB } from "./db";
import { TaskStatus } from "./types";
import { v1Path } from "../shared/http";
import log from "encore.dev/log";
import { taskEvents } from "./events";
import { v4 as uuidv4 } from "uuid";

export interface UpdateTaskStatusRequest {
  id: number;
  status: TaskStatus;
}

export interface UpdateTaskStatusResponse {
  success: boolean;
}

// Handler function for updating task status
async function updateTaskStatusHandler(req: UpdateTaskStatusRequest): Promise<UpdateTaskStatusResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

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

      // Publish task_status_updated
      try {
        await taskEvents.publish({
          eventId: uuidv4(),
          eventVersion: 'v1',
          eventType: 'task_status_updated',
          orgId: authData.orgId,
          propertyId: taskRow.property_id,
          userId: parseInt(authData.userID),
          timestamp: new Date(),
          entityId: id,
          entityType: 'task',
          metadata: {
            oldStatus: taskRow.current_status,
            newStatus: status,
          },
        });
      } catch (e) {
        log.warn("Task event publish failed (task_status_updated)", { error: e instanceof Error ? e.message : String(e) });
      }

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

// Legacy path
export const updateStatus = api<UpdateTaskStatusRequest, UpdateTaskStatusResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/tasks/:id/status" },
  updateTaskStatusHandler
);

// Versioned path
export const updateStatusV1 = api<UpdateTaskStatusRequest, UpdateTaskStatusResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/v1/tasks/:id/status" },
  updateTaskStatusHandler
);

