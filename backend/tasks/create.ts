import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { tasksDB } from "./db";
import { TaskType, TaskPriority } from "./types";
import log from "encore.dev/log";

export interface CreateTaskRequest {
  propertyId: number;
  type: TaskType;
  title: string;
  description?: string;
  priority: TaskPriority;
  assigneeStaffId?: number;
  dueAt?: string; // Changed from Date to string for consistency
  estimatedHours?: number;
}

export interface CreateTaskResponse {
  id: number;
  propertyId: number;
  propertyName: string;
  type: TaskType;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: string;
  assigneeStaffId?: number;
  assigneeName?: string;
  dueAt?: Date;
  estimatedHours?: number;
  createdByUserId: number;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  actualHours?: number;
  attachmentCount: number;
}

// Creates a new task
export const create = api<CreateTaskRequest, CreateTaskResponse>(
  { auth: true, expose: true, method: "POST", path: "/tasks" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { propertyId, type, title, description, priority, assigneeStaffId, dueAt, estimatedHours } = req;

    const tx = await tasksDB.begin();
    try {
      log.info("Creating task", { 
        title, 
        type, 
        priority,
        propertyId,
        assigneeStaffId,
        orgId: authData.orgId, 
        userId: authData.userID 
      });

      // Check property access with org scoping
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

      // Validate assignee if provided
      if (assigneeStaffId) {
        const staffRow = await tx.queryRow`
          SELECT id FROM staff 
          WHERE id = ${assigneeStaffId} AND org_id = ${authData.orgId} AND property_id = ${propertyId} AND status = 'active'
        `;
        if (!staffRow) {
          throw APIError.invalidArgument("Invalid assignee staff ID or staff not assigned to this property");
        }
      }

      // Convert dueAt string to Date object if provided
      const dueAtDate = dueAt ? new Date(dueAt) : null;
      
      const taskRow = await tx.queryRow`
        INSERT INTO tasks (org_id, property_id, type, title, description, priority, assignee_staff_id, due_at, created_by_user_id)
        VALUES (${authData.orgId}, ${propertyId}, ${type}, ${title}, ${description || null}, ${priority}, ${assigneeStaffId || null}, ${dueAtDate}, ${parseInt(authData.userID)})
        RETURNING id, org_id, property_id, type, title, description, priority, status, assignee_staff_id, due_at, created_by_user_id, created_at, updated_at
      `;

      if (!taskRow) {
        throw new Error("Failed to create task");
      }

      // Get assignee name if assigned
      let assigneeName: string | undefined;
      if (assigneeStaffId) {
        const staffUserRow = await tx.queryRow`
          SELECT u.display_name
          FROM staff s
          JOIN users u ON s.user_id = u.id AND u.org_id = $1
          WHERE s.id = ${assigneeStaffId} AND s.org_id = $1
        `;
        assigneeName = staffUserRow?.display_name;

        // Create notification for assignee
        if (staffUserRow) {
          const staffUserIdRow = await tx.queryRow`
            SELECT user_id FROM staff WHERE id = ${assigneeStaffId} AND org_id = ${authData.orgId}
          `;
          
          if (staffUserIdRow) {
            await tx.exec`
              INSERT INTO notifications (org_id, user_id, type, payload_json)
              VALUES (
                ${authData.orgId},
                ${staffUserIdRow.user_id},
                'task_assigned',
                ${JSON.stringify({
                  task_id: taskRow.id,
                  task_title: title,
                  property_name: propertyRow.name,
                  assigned_by: authData.displayName,
                  message: `You have been assigned to task: ${title}`
                })}
              )
            `;
          }
        }
      }

      await tx.commit();
      log.info("Task created successfully", { 
        taskId: taskRow.id, 
        title, 
        propertyId,
        assigneeStaffId,
        orgId: authData.orgId 
      });

      return {
        id: taskRow.id,
        propertyId: taskRow.property_id,
        propertyName: propertyRow.name,
        type: taskRow.type as TaskType,
        title: taskRow.title,
        description: taskRow.description,
        priority: taskRow.priority as TaskPriority,
        status: taskRow.status,
        assigneeStaffId: taskRow.assignee_staff_id,
        assigneeName,
        dueAt: taskRow.due_at,
        estimatedHours: taskRow.estimated_hours ? parseFloat(taskRow.estimated_hours.toString()) : undefined,
        createdByUserId: taskRow.created_by_user_id,
        createdByName: authData.displayName,
        createdAt: taskRow.created_at,
        updatedAt: taskRow.updated_at,
        completedAt: undefined,
        actualHours: undefined,
        attachmentCount: 0,
      };
    } catch (error) {
      await tx.rollback();
      log.error('Create task error', { 
        error: error instanceof Error ? error.message : String(error),
        title,
        propertyId,
        orgId: authData.orgId,
        userId: authData.userID
      });
      
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      
      throw APIError.internal("Failed to create task");
    }
  }
);

