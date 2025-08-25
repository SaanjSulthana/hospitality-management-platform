import { api, Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { tasksDB } from "./db";
import { TaskType, TaskPriority, TaskStatus } from "./types";

export interface ListTasksRequest {
  propertyId?: Query<number>;
  type?: Query<TaskType>;
  priority?: Query<TaskPriority>;
  status?: Query<TaskStatus>;
  assignee?: Query<string>; // 'me' for current user's tasks
  overdue?: Query<boolean>;
}

export interface TaskInfo {
  id: number;
  propertyId: number;
  propertyName: string;
  type: TaskType;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
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
}

export interface ListTasksResponse {
  tasks: TaskInfo[];
}

// Lists tasks with role-based filtering
export const list = api<ListTasksRequest, ListTasksResponse>(
  { auth: true, expose: true, method: "GET", path: "/tasks" },
  async (req) => {
    const authData = getAuthData()!;
    const { propertyId, type, priority, status, assignee, overdue } = req;

    let query = `
      SELECT 
        t.id, t.property_id, p.name as property_name, t.type, t.title, t.description, 
        t.priority, t.status, t.assignee_staff_id, t.due_at, t.created_by_user_id, 
        t.created_at, t.updated_at, t.completed_at, t.estimated_hours, t.actual_hours,
        u.display_name as created_by_name,
        au.display_name as assignee_name,
        COALESCE(att.attachment_count, 0) as attachment_count
      FROM tasks t
      JOIN properties p ON t.property_id = p.id
      JOIN users u ON t.created_by_user_id = u.id
      LEFT JOIN staff s ON t.assignee_staff_id = s.id
      LEFT JOIN users au ON s.user_id = au.id
      LEFT JOIN (
        SELECT task_id, COUNT(*) as attachment_count
        FROM task_attachments
        GROUP BY task_id
      ) att ON t.id = att.task_id
      WHERE t.org_id = $1
    `;
    const params: any[] = [authData.orgId];
    let paramIndex = 2;

    // Managers can only see tasks for properties they have access to or tasks assigned to them
    if (authData.role === "MANAGER") {
      query += ` AND (
        p.id IN (SELECT property_id FROM user_properties WHERE user_id = $${paramIndex})
        OR t.assignee_staff_id IN (SELECT id FROM staff WHERE user_id = $${paramIndex})
      )`;
      params.push(parseInt(authData.userID));
      paramIndex++;
    }

    // Apply filters
    if (propertyId) {
      query += ` AND t.property_id = $${paramIndex}`;
      params.push(propertyId);
      paramIndex++;
    }

    if (type) {
      query += ` AND t.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (priority) {
      query += ` AND t.priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    if (status) {
      query += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (assignee === "me") {
      query += ` AND s.user_id = $${paramIndex}`;
      params.push(parseInt(authData.userID));
      paramIndex++;
    }

    if (overdue) {
      query += ` AND t.due_at < NOW() AND t.status != 'done'`;
    }

    query += ` ORDER BY 
      CASE WHEN t.due_at < NOW() AND t.status != 'done' THEN 0 ELSE 1 END,
      CASE t.priority WHEN 'high' THEN 0 WHEN 'med' THEN 1 ELSE 2 END,
      t.created_at DESC
    `;

    const tasks = await tasksDB.rawQueryAll(query, ...params);

    return {
      tasks: tasks.map((task) => ({
        id: task.id,
        propertyId: task.property_id,
        propertyName: task.property_name,
        type: task.type as TaskType,
        title: task.title,
        description: task.description,
        priority: task.priority as TaskPriority,
        status: task.status as TaskStatus,
        assigneeStaffId: task.assignee_staff_id,
        assigneeName: task.assignee_name,
        dueAt: task.due_at,
        createdByUserId: task.created_by_user_id,
        createdByName: task.created_by_name,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
        completedAt: task.completed_at,
        estimatedHours: task.estimated_hours ? parseFloat(task.estimated_hours) : undefined,
        actualHours: task.actual_hours ? parseFloat(task.actual_hours) : undefined,
        attachmentCount: parseInt(task.attachment_count) || 0,
      })),
    };
  }
);
