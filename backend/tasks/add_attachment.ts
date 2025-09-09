import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { tasksDB } from "./db";

export interface AddAttachmentRequest {
  taskId: number;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
}

export interface AddAttachmentResponse {
  id: number;
  taskId: number;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
  uploadedByUserId: number;
  createdAt: Date;
}

// Adds an attachment to a task
export const addAttachment = api<AddAttachmentRequest, AddAttachmentResponse>(
  { auth: true, expose: true, method: "POST", path: "/tasks/attachments" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { taskId, fileName, fileUrl, fileSize, mimeType } = req;

    // Get task and check access
    const taskRow = await tasksDB.queryRow`
      SELECT t.id, t.org_id, t.property_id
      FROM tasks t
      WHERE t.id = ${taskId} AND t.org_id = ${authData.orgId}
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

    // Add attachment
    const attachmentRow = await tasksDB.queryRow`
      INSERT INTO task_attachments (org_id, task_id, file_name, file_url, file_size, mime_type, uploaded_by_user_id)
      VALUES (${authData.orgId}, ${taskId}, ${fileName}, ${fileUrl}, ${fileSize || null}, ${mimeType || null}, ${parseInt(authData.userID)})
      RETURNING id, org_id, task_id, file_name, file_url, file_size, mime_type, uploaded_by_user_id, created_at
    `;

    if (!attachmentRow) {
      throw new Error('Failed to create attachment');
    }

    return {
      id: attachmentRow.id,
      taskId: attachmentRow.task_id,
      fileName: attachmentRow.file_name,
      fileUrl: attachmentRow.file_url,
      fileSize: attachmentRow.file_size,
      mimeType: attachmentRow.mime_type,
      uploadedByUserId: attachmentRow.uploaded_by_user_id,
      createdAt: attachmentRow.created_at,
    };
  }
);

