import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { tasksDB } from "./db";
import { requireRole } from "../auth/middleware";
import { TaskType, TaskPriority, TaskStatus, TaskImage } from "./types";

interface ListTasksRequest {
  propertyId?: number;
  type?: TaskType;
  priority?: TaskPriority;
  status?: TaskStatus;
  assignee?: number | string; // Allow "me" string for current user's tasks
  overdue?: boolean;
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
  referenceImages?: TaskImage[];
}

export interface ListTasksResponse {
  tasks: TaskInfo[];
}

// Lists tasks with role-based filtering
export const list = api<ListTasksRequest, ListTasksResponse>(
  { auth: true, expose: true, method: "GET", path: "/tasks" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { propertyId, type, priority, status, assignee, overdue } = req || {};

    try {
      // Updated query to remove task_attachments reference - v3 - FORCE DEPLOYMENT
      let query = `
        SELECT 
          t.id, t.property_id, p.name as property_name, t.type, t.title, t.description, 
          t.priority, t.status, t.assignee_staff_id, t.due_at, t.created_by_user_id, 
          t.created_at, t.updated_at, t.completed_at,
          u.display_name as created_by_name,
          au.display_name as assignee_name,
          0 as attachment_count
        FROM tasks t
        JOIN properties p ON t.property_id = p.id AND p.org_id = $1
        JOIN users u ON t.created_by_user_id = u.id AND u.org_id = $1
        LEFT JOIN staff s ON t.assignee_staff_id = s.id AND s.org_id = $1
        LEFT JOIN users au ON s.user_id = au.id AND au.org_id = $1
        WHERE t.org_id = $1
      `;
      const params: any[] = [authData.orgId];
      let paramIndex = 2;

      // Managers can only see tasks for properties they have access to or tasks assigned to them
      if (authData.role === "MANAGER") {
        query += ` AND (
          p.id IN (SELECT property_id FROM user_properties WHERE user_id = $${paramIndex})
          OR t.assignee_staff_id IN (SELECT id FROM staff WHERE user_id = $${paramIndex} AND org_id = $1)
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

      // Get reference images for all tasks
      const taskIds = tasks.map((task: any) => task.id);
      let referenceImages: Record<number, TaskImage[]> = {};
      
      if (taskIds.length > 0) {
        const imagesQuery = `
          SELECT id, task_id, file_name, file_url, file_size, mime_type, created_at
          FROM task_attachments 
          WHERE task_id = ANY($1) AND org_id = $2
          ORDER BY created_at ASC
        `;
        const images = await tasksDB.rawQueryAll(imagesQuery, taskIds, authData.orgId);
        
        // Group images by task_id
        referenceImages = images.reduce((acc: Record<number, TaskImage[]>, img: any) => {
          if (!acc[img.task_id]) {
            acc[img.task_id] = [];
          }
          acc[img.task_id].push({
            id: img.id,
            taskId: img.task_id,
            filename: img.file_name,
            originalName: img.file_name, // We don't store original name in current schema
            fileSize: img.file_size,
            mimeType: img.mime_type,
            filePath: img.file_url,
            isPrimary: acc[img.task_id].length === 0, // First image is primary
            createdAt: img.created_at,
          });
          return acc;
        }, {});
      }

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
          estimatedHours: 0,
          actualHours: 0,
          attachmentCount: parseInt(task.attachment_count) || 0,
          referenceImages: referenceImages[task.id] || [],
        })),
      };
    } catch (error) {
      console.error('List tasks error:', error);
      throw new Error('Failed to fetch tasks');
    }
  }
);

