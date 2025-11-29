import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { tasksDB } from "./db";
import { v1Path } from "../shared/http";
import { taskEvents } from "./events";
import { v4 as uuidv4 } from "uuid";

export interface AssignTaskRequest {
  id: number;
  staffId?: number;
}

export interface AssignTaskResponse {
  success: boolean;
  taskId: number;
  assigneeStaffId?: number;
}

// Handler function for assigning a task
async function assignTaskHandler(req: AssignTaskRequest): Promise<AssignTaskResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { id, staffId } = req;

    const tx = await tasksDB.begin();
    try {
      // Get task and check access with org scoping
      const taskRow = await tx.queryRow`
        SELECT t.id, t.org_id, t.property_id, t.status
        FROM tasks t
        WHERE t.id = ${id} AND t.org_id = ${authData.orgId}
      `;

      if (!taskRow) {
        throw APIError.notFound("Task not found");
      }

      // Managers must have access to the property
      if (authData.role === "MANAGER") {
        const accessCheck = await tx.queryRow`
          SELECT 1 FROM user_properties WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${taskRow.property_id}
        `;
        if (!accessCheck) {
          throw APIError.permissionDenied("No access to this task");
        }
      }

      // Validate staff member if provided
      if (staffId) {
        const staffRow = await tx.queryRow`
          SELECT id FROM staff 
          WHERE id = ${staffId} AND org_id = ${authData.orgId} AND property_id = ${taskRow.property_id} AND status = 'active'
        `;
        if (!staffRow) {
          throw APIError.invalidArgument("Invalid staff member or staff not assigned to this property");
        }
      }

      // Update task assignment
      await tx.exec`
        UPDATE tasks 
        SET assignee_staff_id = ${staffId || null}, updated_at = NOW()
        WHERE id = ${id} AND org_id = ${authData.orgId}
      `;

      // Create notification if assigning to someone
      if (staffId) {
        const staffUserRow = await tx.queryRow`
          SELECT s.user_id, u.display_name, t.title, p.name as property_name
          FROM staff s
          JOIN users u ON s.user_id = u.id AND u.org_id = $1
          JOIN tasks t ON t.id = ${id} AND t.org_id = $1
          JOIN properties p ON t.property_id = p.id AND p.org_id = $1
          WHERE s.id = ${staffId} AND s.org_id = $1
        `;

        if (staffUserRow) {
          await tx.exec`
            INSERT INTO notifications (org_id, user_id, type, payload_json)
            VALUES (
              ${authData.orgId},
              ${staffUserRow.user_id},
              'task_assigned',
              ${JSON.stringify({
                task_id: id,
                task_title: staffUserRow.title,
                property_name: staffUserRow.property_name,
                assigned_by: authData.displayName,
                message: `You have been assigned to task: ${staffUserRow.title}`
              })}
            )
          `;
        }
      }

      await tx.commit();

      // Publish task_assigned (or unassigned if no staffId)
      try {
        await taskEvents.publish({
          eventId: uuidv4(),
          eventVersion: 'v1',
          eventType: 'task_assigned',
          orgId: authData.orgId,
          propertyId: taskRow.property_id,
          userId: parseInt(authData.userID),
          timestamp: new Date(),
          entityId: id,
          entityType: 'task',
          metadata: {
            assigneeStaffId: staffId || null,
          },
        });
      } catch (e) {
        // best-effort
      }

      return {
        success: true,
        taskId: id,
        assigneeStaffId: staffId,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Assign task error:', error);
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      throw APIError.internal("Failed to assign task");
    }
}

// Legacy path
export const assign = api<AssignTaskRequest, AssignTaskResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/tasks/:id/assign" },
  assignTaskHandler
);

// Versioned path
export const assignV1 = api<AssignTaskRequest, AssignTaskResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/v1/tasks/:id/assign" },
  assignTaskHandler
);

