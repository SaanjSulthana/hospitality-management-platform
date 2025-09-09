import { getAuthenticatedBackend } from '../../services/backend';
import { API_CONFIG, IMAGE_UPLOAD_CONFIG, ERROR_MESSAGES } from '../../src/config/api';
import { apiClient } from '../../src/utils/api-client';

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

// Upload reference image for a task with progress callback
export async function uploadTaskImage(
  taskId: number,
  file: File,
  onProgress?: (progress: number) => void
): Promise<TaskImage> {
  try {
    // Validate file before processing
    if (!file) {
      throw new Error('No file provided');
    }
    
    // Validate file type
    if (!IMAGE_UPLOAD_CONFIG.ALLOWED_TYPES.includes(file.type)) {
      throw new Error(ERROR_MESSAGES.INVALID_FILE_TYPE);
    }
    
    // Validate file size
    if (file.size > IMAGE_UPLOAD_CONFIG.MAX_FILE_SIZE) {
      throw new Error(ERROR_MESSAGES.FILE_TOO_LARGE);
    }
    
    // Convert file to base64 with progress
    const base64 = await fileToBase64(file, onProgress);
    
    // Use centralized API client
    const response = await apiClient.request(`/tasks/${taskId}/images`, {
      method: 'POST',
      body: {
        taskId,
        fileData: base64,
        filename: file.name,
        mimeType: file.type,
      },
    });

    if (!response.data?.image) {
      throw new Error('Invalid response from server');
    }
    
    return response.data.image;
  } catch (error) {
    console.error('Upload task image error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unexpected error occurred during upload');
  }
}

// Get all images for a task
export async function getTaskImages(taskId: number): Promise<TaskImage[]> {
  try {
    const response = await apiClient.request(`/tasks/${taskId}/images`, {
      method: 'GET',
    });

    return response.data?.images || [];
  } catch (error) {
    console.error('Get task images error:', error);
    throw error;
  }
}

// Delete a task image
export async function deleteTaskImage(
  taskId: number,
  imageId: number
): Promise<void> {
  try {
    await apiClient.request(`/tasks/${taskId}/images/${imageId}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error('Delete task image error:', error);
    throw error;
  }
}

// Set an image as primary
export async function setPrimaryImage(
  taskId: number,
  imageId: number
): Promise<SetPrimaryImageResponse> {
  try {
    const response = await apiClient.request(`/tasks/${taskId}/images/${imageId}/primary`, {
      method: 'PUT',
    });

    return response.data;
  } catch (error) {
    console.error('Set primary image error:', error);
    throw error;
  }
}

// Get image URL for display
export async function getTaskImageUrl(imageId: number): Promise<string> {
  try {
    console.log('getTaskImageUrl: Starting request for imageId:', imageId);
    const response = await apiClient.request(`/uploads/tasks/${imageId}`, {
      method: 'GET',
    });

    console.log('getTaskImageUrl: Response received:', response);
    const result = response.data;
    console.log('getTaskImageUrl: Result data:', result);
    
    if (!result || !result.mimeType || !result.data) {
      console.error('getTaskImageUrl: Invalid response data:', result);
      return '/placeholder-image.png';
    }
    
    const dataUrl = `data:${result.mimeType};base64,${result.data}`;
    console.log('getTaskImageUrl: Generated data URL length:', dataUrl.length);
    return dataUrl;
  } catch (error) {
    console.error('getTaskImageUrl: Failed to load image:', error);
    return '/placeholder-image.png'; // Fallback image
  }
}

// Get image URL for display (alternative method using blob URL)
export async function getTaskImageBlobUrl(imageId: number): Promise<string> {
  try {
    // For blob responses, we need to use fetch directly since the API client doesn't support responseType
    const response = await fetch(`${API_CONFIG.BASE_URL}/uploads/tasks/${imageId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to load image');
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Failed to load image:', error);
    return '/placeholder-image.png'; // Fallback image
  }
}

// Helper function to convert file to base64 with progress
function fileToBase64(file: File, onProgress?: (progress: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = (event.loaded / event.total) * 100;
        onProgress(progress);
      }
    };
    
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(',')[1];
      if (onProgress) onProgress(100);
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
}
