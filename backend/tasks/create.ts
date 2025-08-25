import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { tasksDB } from "./db";
import { requireRole } from "../auth/middleware";
import { TaskType, TaskPriority } from "./types";

export interface CreateTaskRequest {
  propertyId: number;
  type: TaskType;
  title: string;
  description?: string;
  priority: TaskPriority;
  assigneeStaffId?: number;
  dueAt?: Date;
}

export interface CreateTaskResponse {
  id: number;
  propertyId: number;
  type: TaskType;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: string;
  assigneeStaffId?: number;
  dueAt?: Date;
  createdByUserId: number;
  createdAt: Date;
  updatedAt: Date;
}

// Creates a new task
export const create = api<CreateTaskRequest, CreateTaskResponse>(
  { auth: true, expose: true, method: "POST", path: "/tasks" },
  async (req) => {
    const authData = getAuthData()!;
    requireRole("ADMIN", "MANAGER")(authData);

    const { propertyId, type, title, description, priority, assigneeStaffId, dueAt } = req;

    // Check property access
    const propertyRow = await tasksDB.queryRow`
      SELECT p.id, p.org_id
      FROM properties p
      WHERE p.id = ${propertyId} AND p.org_id = ${authData.orgId}
    `;

    if (!propertyRow) {
      throw APIError.notFound("Property not found");
    }

    if (authData.role === "MANAGER") {
      const accessCheck = await tasksDB.queryRow`
        SELECT 1 FROM user_properties WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${propertyId}
      `;
      if (!accessCheck) {
        throw APIError.permissionDenied("No access to this property");
      }
    }

    // Validate assignee if provided
    if (assigneeStaffId) {
      const staffRow = await tasksDB.queryRow`
        SELECT id FROM staff 
        WHERE id = ${assigneeStaffId} AND org_id = ${authData.orgId} AND property_id = ${propertyId}
      `;
      if (!staffRow) {
        throw APIError.invalidArgument("Invalid assignee staff ID");
      }
    }

    const taskRow = await tasksDB.queryRow`
      INSERT INTO tasks (org_id, property_id, type, title, description, priority, assignee_staff_id, due_at, created_by_user_id)
      VALUES (${authData.orgId}, ${propertyId}, ${type}, ${title}, ${description || null}, ${priority}, ${assigneeStaffId || null}, ${dueAt || null}, ${parseInt(authData.userID)})
      RETURNING id, org_id, property_id, type, title, description, priority, status, assignee_staff_id, due_at, created_by_user_id, created_at, updated_at
    `;

    return {
      id: taskRow.id,
      propertyId: taskRow.property_id,
      type: taskRow.type as TaskType,
      title: taskRow.title,
      description: taskRow.description,
      priority: taskRow.priority as TaskPriority,
      status: taskRow.status,
      assigneeStaffId: taskRow.assignee_staff_id,
      dueAt: taskRow.due_at,
      createdByUserId: taskRow.created_by_user_id,
      createdAt: taskRow.created_at,
      updatedAt: taskRow.updated_at,
    };
  }
);
