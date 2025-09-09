import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { uploadsDB } from "./db";
import { tasksDB } from "../tasks/db";
import * as fs from "fs";
import * as path from "path";
import log from "encore.dev/log";

// Serve task images with proper authentication and access control
export const serveTaskImage = api<{ imageId: number }, { data: string; mimeType: string }>(
  { auth: true, expose: true, method: "GET", path: "/uploads/tasks/:imageId" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { imageId } = req;

    // Get image info and verify access
    const imageRow = await uploadsDB.queryRow`
      SELECT ta.id, ta.task_id, ta.file_name, ta.mime_type, ta.org_id, t.property_id
      FROM task_attachments ta
      JOIN tasks t ON ta.task_id = t.id
      WHERE ta.id = ${imageId} AND ta.org_id = ${authData.orgId}
    `;

    if (!imageRow) {
      throw APIError.notFound("Image not found");
    }

    // Managers must have access to the property
    if (authData.role === "MANAGER") {
      const accessCheck = await tasksDB.queryRow`
        SELECT 1 FROM user_properties WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${imageRow.property_id}
      `;
      if (!accessCheck) {
        throw APIError.permissionDenied("No access to this image");
      }
    }

    // Construct file path
    const filePath = path.join(process.cwd(), 'uploads', authData.orgId.toString(), 'tasks', imageRow.file_name);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      log.error('Task image file not found on disk', { 
        imageId, 
        filePath,
        orgId: authData.orgId 
      });
      throw APIError.notFound("Image file not found");
    }

    try {
      // Read and return file
      const fileBuffer = fs.readFileSync(filePath);
      const base64Data = fileBuffer.toString('base64');
      
      log.info("Task image served successfully", { 
        imageId, 
        taskId: imageRow.task_id,
        orgId: authData.orgId,
        userId: authData.userID 
      });

      return {
        data: base64Data,
        mimeType: imageRow.mime_type
      };
    } catch (error) {
      log.error('Error reading task image file', { 
        error: error instanceof Error ? error.message : String(error),
        imageId, 
        filePath,
        orgId: authData.orgId 
      });
      throw APIError.internal("Failed to read image file");
    }
  }
);
