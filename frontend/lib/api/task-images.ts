import { getAuthenticatedBackend } from '../../services/backend';

export interface TaskImage {
  id: number;
  taskId: number;
  filename: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  isPrimary: boolean;
  createdAt: string;
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

// Upload reference image for a task
export async function uploadTaskImage(
  taskId: number,
  file: File
): Promise<TaskImage> {
  const backend = getAuthenticatedBackend();
  
  // Convert file to base64
  const base64 = await fileToBase64(file);
  
  // Use the Encore.js backend client
  const response = await backend.tasks.uploadTaskImage({
    taskId,
    fileData: base64,
    filename: file.name,
    mimeType: file.type,
  });

  return response.image;
}

// Get all images for a task
export async function getTaskImages(taskId: number): Promise<TaskImage[]> {
  const backend = getAuthenticatedBackend();
  
  // Use the Encore.js backend client
  const response = await backend.tasks.getTaskImages({ taskId });
  return response.images;
}

// Delete a task image
export async function deleteTaskImage(
  taskId: number,
  imageId: number
): Promise<void> {
  const backend = getAuthenticatedBackend();
  
  // Use the Encore.js backend client
  await backend.tasks.deleteTaskImage({
    taskId,
    imageId,
  });
}

// Set an image as primary
export async function setPrimaryImage(
  taskId: number,
  imageId: number
): Promise<SetPrimaryImageResponse> {
  const backend = getAuthenticatedBackend();
  
  const response = await fetch(`${backend.baseURL}/tasks/${taskId}/images/${imageId}/primary`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${backend.token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to set primary image');
  }

  return response.json();
}

// Get image URL for display
export async function getTaskImageUrl(imageId: number): Promise<string> {
  const backend = getAuthenticatedBackend();
  
  try {
    const response = await backend.uploads.serveTaskImage({ imageId });
    return `data:${response.mimeType};base64,${response.data}`;
  } catch (error) {
    console.error('Failed to load image:', error);
    return '/placeholder-image.png'; // Fallback image
  }
}

// Helper function to convert file to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
}
