import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { tasksDB } from "./db";
import { requireRole } from "../auth/middleware";

export interface AssignTaskRequest {
  id: number;
  staffId?: number;
}

export interface AssignTaskResponse {
  success: boolean;
  taskId: number;
  assigneeStaffId?: number;
}

// Assigns or unassigns a task to/from a staff member
export const assign = api<AssignTaskRequest, AssignTaskResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/tasks/:id/assign" },
  async (req) => {
    const authData = getAuthData()!;
    requireRole("ADMIN", "MANAGER")(authData);

    const { id, staffId } = req;

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

    // Validate staff member if provided
    if (staffId) {
      const staffRow = await tasksDB.queryRow`
        SELECT id FROM staff 
        WHERE id = ${staffId} AND org_id = ${authData.orgId} AND property_id = ${taskRow.property_id} AND status = 'active'
      `;
      if (!staffRow) {
        throw APIError.invalidArgument("Invalid staff member or staff not assigned to this property");
      }
    }

    // Update task assignment
    await tasksDB.exec`
      UPDATE tasks 
      SET assignee_staff_id = ${staffId || null}, updated_at = NOW()
      WHERE id = ${id}
    `;

    // Create notification if assigning to someone
    if (staffId) {
      const staffUserRow = await tasksDB.queryRow`
        SELECT s.user_id, u.display_name, t.title, p.name as property_name
        FROM staff s
        JOIN users u ON s.user_id = u.id
        JOIN tasks t ON t.id = ${id}
        JOIN properties p ON t.property_id = p.id
        WHERE s.id = ${staffId}
      `;

      if (staffUserRow) {
        await tasksDB.exec`
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

    return {
      success: true,
      taskId: id,
      assigneeStaffId: staffId,
    };
  }
);
