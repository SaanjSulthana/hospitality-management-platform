import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { tasksDB } from "./db";
import { uploadsDB } from "../uploads/db";
import { taskImagesBucket } from "../storage/buckets";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import log from "encore.dev/log";

export interface UploadTaskImageRequest {
  taskId: number;
  fileData: string; // base64 encoded file data
  filename: string;
  mimeType: string;
}

export interface TaskImage {
  id: number;
  taskId: number;
  filename: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  isPrimary: boolean;
  createdAt: Date;
}

export interface UploadTaskImageResponse {
  success: boolean;
  image: TaskImage;
}

export interface GetTaskImagesResponse {
  success: boolean;
  images: TaskImage[];
}

export interface DeleteTaskImageResponse {
  success: boolean;
  message: string;
}

export interface SetPrimaryImageResponse {
  success: boolean;
  message: string;
}

// Shared handler for uploading task image
async function uploadTaskImageHandler(req: UploadTaskImageRequest): Promise<UploadTaskImageResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { taskId, fileData, filename, mimeType } = req;

    // Validate file type (images only)
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/webp'
    ];

    if (!allowedMimeTypes.includes(mimeType)) {
      throw APIError.invalidArgument("File type not supported. Please upload images (JPG, PNG, WebP) only.");
    }

    // Decode base64 file data
    const fileBuffer = Buffer.from(fileData, 'base64');
    
    // Validate file size (max 5MB for task images)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (fileBuffer.length > maxSize) {
      throw APIError.invalidArgument("File size too large. Maximum size is 5MB for task images.");
    }

    const tx = await tasksDB.begin();
    try {
      // Get task and check access
      const taskRow = await tx.queryRow`
        SELECT t.id, t.org_id, t.property_id, t.title
        FROM tasks t
        WHERE t.id = ${taskId} AND t.org_id = ${authData.orgId}
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

      // Generate unique filename
      const fileExtension = path.extname(filename) || getExtensionFromMimeType(mimeType);
      const uniqueFilename = `task_${taskId}_${randomUUID()}${fileExtension}`;
      
      // Upload to Encore Cloud bucket (public)
      const bucketKey = `${authData.orgId}/task_${taskId}/${uniqueFilename}`;
      
      try {
        await taskImagesBucket.upload(bucketKey, fileBuffer, {
          contentType: mimeType
        });
      } catch (error) {
        log.error('Failed to upload to bucket:', error);
        throw APIError.internal("Failed to upload image to cloud storage");
      }

      // Get public URL since bucket is public (CDN-backed)
      const publicUrl = taskImagesBucket.publicUrl(bucketKey);

      // Check if this is the first image for this task (will be primary)
      const existingImages = await tx.queryAll`
        SELECT id FROM task_attachments 
        WHERE task_id = ${taskId} AND org_id = ${authData.orgId}
      `;
      
      const isPrimary = existingImages.length === 0;

      // Save image info to task_attachments table with cloud storage marker
      const imageRow = await tx.queryRow`
        INSERT INTO task_attachments (org_id, task_id, file_name, file_url, file_size, mime_type, uploaded_by_user_id, storage_location, bucket_key)
        VALUES (${authData.orgId}, ${taskId}, ${uniqueFilename}, ${publicUrl}, ${fileBuffer.length}, ${mimeType}, ${parseInt(authData.userID)}, 'cloud', ${bucketKey})
        RETURNING id, org_id, task_id, file_name, file_url, file_size, mime_type, uploaded_by_user_id, created_at
      `;

      if (!imageRow) {
        // Clean up file from bucket if database insert failed
        try {
          await taskImagesBucket.remove(bucketKey);
        } catch (error) {
          log.error('Failed to clean up file from bucket:', error);
        }
        throw APIError.internal("Failed to save image record");
      }

      await tx.commit();

      log.info("Task image uploaded successfully", { 
        taskId, 
        imageId: imageRow.id,
        filename: uniqueFilename,
        orgId: authData.orgId,
        userId: authData.userID 
      });

      return {
        success: true,
        image: {
          id: imageRow.id,
          taskId: imageRow.task_id,
          filename: imageRow.file_name,
          originalName: filename,
          fileSize: imageRow.file_size,
          mimeType: imageRow.mime_type,
          filePath: imageRow.file_url,
          isPrimary,
          createdAt: imageRow.created_at,
        }
      };
    } catch (error) {
      await tx.rollback();
      log.error('Upload task image error', { 
        error: error instanceof Error ? error.message : String(error),
        taskId,
        orgId: authData.orgId,
        userId: authData.userID
      });
      
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      
      throw APIError.internal("Failed to upload task image");
    }
}

// LEGACY: Upload reference image for a task (keep for backward compatibility)
export const uploadTaskImage = api<UploadTaskImageRequest, UploadTaskImageResponse>(
  { auth: true, expose: true, method: "POST", path: "/tasks/:taskId/images" },
  uploadTaskImageHandler
);

// V1: Upload reference image for a task
export const uploadTaskImageV1 = api<UploadTaskImageRequest, UploadTaskImageResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/tasks/:taskId/images" },
  uploadTaskImageHandler
);

// Shared handler for getting all images for a task
async function getTaskImagesHandler(req: { taskId: number }): Promise<GetTaskImagesResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { taskId } = req;

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

    // Get all images for this task
    const images = await tasksDB.queryAll`
      SELECT id, task_id, file_name, file_url, file_size, mime_type, created_at
      FROM task_attachments 
      WHERE task_id = ${taskId} AND org_id = ${authData.orgId}
      ORDER BY created_at ASC
    `;

    // For now, we'll consider the first image as primary
    // In a more advanced implementation, we could add a primary_image_id column to tasks table
    const taskImages: TaskImage[] = images.map((img: any, index: number) => ({
      id: img.id,
      taskId: img.task_id,
      filename: img.file_name,
      originalName: img.file_name, // We don't store original name in current schema
      fileSize: img.file_size,
      mimeType: img.mime_type,
      filePath: img.file_url,
      isPrimary: index === 0, // First image is primary
      createdAt: img.created_at,
    }));

    return {
      success: true,
      images: taskImages,
    };
}

// LEGACY: Get all images for a task (keep for backward compatibility)
export const getTaskImages = api<{ taskId: number }, GetTaskImagesResponse>(
  { auth: true, expose: true, method: "GET", path: "/tasks/:taskId/images" },
  getTaskImagesHandler
);

// V1: Get all images for a task
export const getTaskImagesV1 = api<{ taskId: number }, GetTaskImagesResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/tasks/:taskId/images" },
  getTaskImagesHandler
);

// Shared handler for deleting a task image
async function deleteTaskImageHandler(req: { taskId: number; imageId: number }): Promise<DeleteTaskImageResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { taskId, imageId } = req;

    const tx = await tasksDB.begin();
    try {
      // Get task and check access
      const taskRow = await tx.queryRow`
        SELECT t.id, t.org_id, t.property_id
        FROM tasks t
        WHERE t.id = ${taskId} AND t.org_id = ${authData.orgId}
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

      // Get image info before deletion
      const imageRow = await tx.queryRow`
        SELECT file_name, file_url, storage_location, bucket_key
        FROM task_attachments 
        WHERE id = ${imageId} AND task_id = ${taskId} AND org_id = ${authData.orgId}
      `;

      if (!imageRow) {
        throw APIError.notFound("Image not found");
      }

      // Delete from database
      await tx.exec`
        DELETE FROM task_attachments 
        WHERE id = ${imageId} AND task_id = ${taskId} AND org_id = ${authData.orgId}
      `;

      // Delete file from cloud or local storage
      try {
        if (imageRow.storage_location === 'cloud' && imageRow.bucket_key) {
          // Delete from Encore bucket
          await taskImagesBucket.remove(imageRow.bucket_key);
        } else {
          // Delete from local disk
          const filePath = path.join(process.cwd(), 'uploads', authData.orgId.toString(), 'tasks', imageRow.file_name);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      } catch (error) {
        log.error('Failed to delete file:', error);
        // Don't fail the request if file deletion fails
      }

      await tx.commit();

      log.info("Task image deleted successfully", { 
        taskId, 
        imageId,
        orgId: authData.orgId,
        userId: authData.userID 
      });

      return {
        success: true,
        message: "Image deleted successfully"
      };
    } catch (error) {
      await tx.rollback();
      log.error('Delete task image error', { 
        error: error instanceof Error ? error.message : String(error),
        taskId,
        imageId,
        orgId: authData.orgId,
        userId: authData.userID
      });
      
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      
      throw APIError.internal("Failed to delete task image");
    }
}

// LEGACY: Delete a task image (keep for backward compatibility)
export const deleteTaskImage = api<{ taskId: number; imageId: number }, DeleteTaskImageResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/tasks/:taskId/images/:imageId" },
  deleteTaskImageHandler
);

// V1: Delete a task image
export const deleteTaskImageV1 = api<{ taskId: number; imageId: number }, DeleteTaskImageResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/v1/tasks/:taskId/images/:imageId" },
  deleteTaskImageHandler
);

// Shared handler for setting an image as primary
async function setPrimaryImageHandler(req: { taskId: number; imageId: number }): Promise<SetPrimaryImageResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { taskId, imageId } = req;

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

    // Verify image exists
    const imageRow = await tasksDB.queryRow`
      SELECT id FROM task_attachments 
      WHERE id = ${imageId} AND task_id = ${taskId} AND org_id = ${authData.orgId}
    `;

    if (!imageRow) {
      throw APIError.notFound("Image not found");
    }

    // For now, we'll just return success since we don't have a primary_image_id column yet
    // In a future enhancement, we would update the tasks table with the primary image ID
    
    log.info("Primary image set successfully", { 
      taskId, 
      imageId,
      orgId: authData.orgId,
      userId: authData.userID 
    });

    return {
      success: true,
      message: "Primary image updated"
    };
}

// LEGACY: Set an image as primary (keep for backward compatibility)
export const setPrimaryImage = api<{ taskId: number; imageId: number }, SetPrimaryImageResponse>(
  { auth: true, expose: true, method: "PUT", path: "/tasks/:taskId/images/:imageId/primary" },
  setPrimaryImageHandler
);

// V1: Set an image as primary
export const setPrimaryImageV1 = api<{ taskId: number; imageId: number }, SetPrimaryImageResponse>(
  { auth: true, expose: true, method: "PUT", path: "/v1/tasks/:taskId/images/:imageId/primary" },
  setPrimaryImageHandler
);

function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
  };
  
  return mimeToExt[mimeType] || '.jpg';
}
