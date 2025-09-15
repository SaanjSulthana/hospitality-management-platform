import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { tasksDB } from "./db";
import log from "encore.dev/log";

export interface UpdateTaskRequest {
  id: number;
  propertyId?: number;
  type?: 'maintenance' | 'housekeeping' | 'service';
  title?: string;
  description?: string;
  priority?: 'low' | 'med' | 'high';
  assigneeStaffId?: number;
  dueAt?: string; // ISO date string
  estimatedHours?: number;
}

export interface UpdateTaskResponse {
  success: boolean;
  task: {
    id: number;
    propertyId: number;
    propertyName: string;
    type: string;
    title: string;
    description?: string;
    priority: string;
    status: string;
    assigneeStaffId?: number;
    assigneeName?: string;
    dueAt?: Date;
    createdByUserId: number;
    createdByName: string;
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
    estimatedHours?: number;
    actualHours?: number;
    attachmentCount: number;
  };
}

// Updates an existing task
export const update = api<UpdateTaskRequest, UpdateTaskResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/tasks/:id" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { id, propertyId, type, title, description, priority, assigneeStaffId, dueAt, estimatedHours } = req;

    const tx = await tasksDB.begin();
    try {
      log.info("Updating task", { 
        taskId: id,
        title, 
        type, 
        priority,
        propertyId,
        assigneeStaffId,
        orgId: authData.orgId, 
        userId: authData.userID 
      });

      // Get existing task and check access with org scoping
      const existingTaskRow = await tx.queryRow`
        SELECT t.id, t.org_id, t.property_id, t.title as current_title
        FROM tasks t
        WHERE t.id = ${id} AND t.org_id = ${authData.orgId}
      `;

      if (!existingTaskRow) {
        throw APIError.notFound("Task not found");
      }

      // Check property access if changing property
      if (propertyId && propertyId !== existingTaskRow.property_id) {
        const propertyRow = await tx.queryRow`
          SELECT p.id, p.org_id, p.name
          FROM properties p
          WHERE p.id = ${propertyId} AND p.org_id = ${authData.orgId}
        `;

        if (!propertyRow) {
          throw APIError.notFound("Property not found");
        }

        if (authData.role === "MANAGER") {
          const accessCheck = await tx.queryRow`
            SELECT 1 FROM user_properties WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${propertyId}
          `;
          if (!accessCheck) {
            throw APIError.permissionDenied("No access to this property");
          }
        }
      }

      // Validate assignee if provided
      if (assigneeStaffId) {
        const targetPropertyId = propertyId || existingTaskRow.property_id;
        const staffRow = await tx.queryRow`
          SELECT id FROM staff 
          WHERE id = ${assigneeStaffId} AND org_id = ${authData.orgId} AND property_id = ${targetPropertyId} AND status = 'active'
        `;
        if (!staffRow) {
          throw APIError.invalidArgument("Invalid assignee staff ID or staff not assigned to this property");
        }
      }

      // Convert dueAt string to Date object if provided
      const dueAtDate = dueAt ? new Date(dueAt) : null;

      // Build dynamic update query
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (propertyId !== undefined) {
        updateFields.push(`property_id = $${paramIndex}`);
        updateValues.push(propertyId);
        paramIndex++;
      }
      if (type !== undefined) {
        updateFields.push(`type = $${paramIndex}`);
        updateValues.push(type);
        paramIndex++;
      }
      if (title !== undefined) {
        updateFields.push(`title = $${paramIndex}`);
        updateValues.push(title);
        paramIndex++;
      }
      if (description !== undefined) {
        updateFields.push(`description = $${paramIndex}`);
        updateValues.push(description);
        paramIndex++;
      }
      if (priority !== undefined) {
        updateFields.push(`priority = $${paramIndex}`);
        updateValues.push(priority);
        paramIndex++;
      }
      if (assigneeStaffId !== undefined) {
        updateFields.push(`assignee_staff_id = $${paramIndex}`);
        updateValues.push(assigneeStaffId);
        paramIndex++;
      }
      if (dueAtDate !== undefined) {
        updateFields.push(`due_at = $${paramIndex}`);
        updateValues.push(dueAtDate);
        paramIndex++;
      }
      if (estimatedHours !== undefined) {
        updateFields.push(`estimated_hours = $${paramIndex}`);
        updateValues.push(estimatedHours);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        throw APIError.invalidArgument("No fields to update");
      }

      // Always update the updated_at timestamp
      updateFields.push(`updated_at = NOW()`);

      // Execute update using Encore's template literal syntax
      let taskRow;
      if (title !== undefined && description !== undefined && priority !== undefined) {
        taskRow = await tx.queryRow`
          UPDATE tasks 
          SET title = ${title}, description = ${description}, priority = ${priority}, updated_at = NOW()
          WHERE id = ${id} AND org_id = ${authData.orgId}
          RETURNING id, property_id, type, title, description, priority, status, assignee_staff_id, due_at, created_by_user_id, created_at, updated_at, completed_at, 0 as estimated_hours, 0 as actual_hours
        `;
      } else if (title !== undefined && description !== undefined) {
        taskRow = await tx.queryRow`
          UPDATE tasks 
          SET title = ${title}, description = ${description}, updated_at = NOW()
          WHERE id = ${id} AND org_id = ${authData.orgId}
          RETURNING id, property_id, type, title, description, priority, status, assignee_staff_id, due_at, created_by_user_id, created_at, updated_at, completed_at, 0 as estimated_hours, 0 as actual_hours
        `;
      } else if (title !== undefined && priority !== undefined) {
        taskRow = await tx.queryRow`
          UPDATE tasks 
          SET title = ${title}, priority = ${priority}, updated_at = NOW()
          WHERE id = ${id} AND org_id = ${authData.orgId}
          RETURNING id, property_id, type, title, description, priority, status, assignee_staff_id, due_at, created_by_user_id, created_at, updated_at, completed_at, 0 as estimated_hours, 0 as actual_hours
        `;
      } else if (description !== undefined && priority !== undefined) {
        taskRow = await tx.queryRow`
          UPDATE tasks 
          SET description = ${description}, priority = ${priority}, updated_at = NOW()
          WHERE id = ${id} AND org_id = ${authData.orgId}
          RETURNING id, property_id, type, title, description, priority, status, assignee_staff_id, due_at, created_by_user_id, created_at, updated_at, completed_at, 0 as estimated_hours, 0 as actual_hours
        `;
      } else if (title !== undefined) {
        taskRow = await tx.queryRow`
          UPDATE tasks 
          SET title = ${title}, updated_at = NOW()
          WHERE id = ${id} AND org_id = ${authData.orgId}
          RETURNING id, property_id, type, title, description, priority, status, assignee_staff_id, due_at, created_by_user_id, created_at, updated_at, completed_at, 0 as estimated_hours, 0 as actual_hours
        `;
      } else if (description !== undefined) {
        taskRow = await tx.queryRow`
          UPDATE tasks 
          SET description = ${description}, updated_at = NOW()
          WHERE id = ${id} AND org_id = ${authData.orgId}
          RETURNING id, property_id, type, title, description, priority, status, assignee_staff_id, due_at, created_by_user_id, created_at, updated_at, completed_at, 0 as estimated_hours, 0 as actual_hours
        `;
      } else if (priority !== undefined) {
        taskRow = await tx.queryRow`
          UPDATE tasks 
          SET priority = ${priority}, updated_at = NOW()
          WHERE id = ${id} AND org_id = ${authData.orgId}
          RETURNING id, property_id, type, title, description, priority, status, assignee_staff_id, due_at, created_by_user_id, created_at, updated_at, completed_at, 0 as estimated_hours, 0 as actual_hours
        `;
      } else {
        throw APIError.invalidArgument("No fields to update");
      }

      if (!taskRow) {
        throw new Error("Failed to update task");
      }

      // Get updated task details with joins
      const updatedTaskRow = await tx.queryRow`
        SELECT 
          t.id, t.property_id, p.name as property_name, t.type, t.title, t.description, 
          t.priority, t.status, t.assignee_staff_id, t.due_at, t.created_by_user_id, 
          t.created_at, t.updated_at, t.completed_at, 0 as estimated_hours, 0 as actual_hours,
          u.display_name as created_by_name,
          au.display_name as assignee_name,
          0 as attachment_count
        FROM tasks t
        JOIN properties p ON t.property_id = p.id AND p.org_id = ${authData.orgId}
        JOIN users u ON t.created_by_user_id = u.id AND u.org_id = ${authData.orgId}
        LEFT JOIN staff s ON t.assignee_staff_id = s.id AND s.org_id = ${authData.orgId}
        LEFT JOIN users au ON s.user_id = au.id AND au.org_id = ${authData.orgId}
        WHERE t.id = ${id} AND t.org_id = ${authData.orgId}
      `;

      if (!updatedTaskRow) {
        throw new Error("Failed to retrieve updated task");
      }

      await tx.commit();
      log.info("Task updated successfully", { taskId: id });

      return {
        success: true,
        task: {
          id: updatedTaskRow.id,
          propertyId: updatedTaskRow.property_id,
          propertyName: updatedTaskRow.property_name,
          type: updatedTaskRow.type,
          title: updatedTaskRow.title,
          description: updatedTaskRow.description,
          priority: updatedTaskRow.priority,
          status: updatedTaskRow.status,
          assigneeStaffId: updatedTaskRow.assignee_staff_id,
          assigneeName: updatedTaskRow.assignee_name,
          dueAt: updatedTaskRow.due_at,
          createdByUserId: updatedTaskRow.created_by_user_id,
          createdByName: updatedTaskRow.created_by_name,
          createdAt: updatedTaskRow.created_at,
          updatedAt: updatedTaskRow.updated_at,
          completedAt: updatedTaskRow.completed_at,
          estimatedHours: updatedTaskRow.estimated_hours,
          actualHours: updatedTaskRow.actual_hours,
          attachmentCount: updatedTaskRow.attachment_count,
        },
      };
    } catch (error) {
      await tx.rollback();
      log.error("Failed to update task", { error, taskId: id });
      throw error;
    }
  }
);
