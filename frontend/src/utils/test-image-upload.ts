// Test utility for image upload functionality
import { uploadTaskImage, getTaskImages, deleteTaskImage } from '../../lib/api/task-images';

export interface TestResult {
  success: boolean;
  message: string;
  details?: any;
}

export async function testImageUpload(taskId: number, testFile: File): Promise<TestResult> {
  try {
    console.log('🧪 Testing image upload functionality...');
    
    // Test 1: Upload image
    console.log('📤 Testing image upload...');
    const uploadedImage = await uploadTaskImage(taskId, testFile, (progress) => {
      console.log(`📊 Upload progress: ${progress}%`);
    });
    
    if (!uploadedImage || !uploadedImage.id) {
      return {
        success: false,
        message: 'Upload failed - no image returned',
        details: uploadedImage
      };
    }
    
    console.log('✅ Image upload successful:', uploadedImage);
    
    // Test 2: Get images
    console.log('📥 Testing image retrieval...');
    const images = await getTaskImages(taskId);
    
    if (!images || !Array.isArray(images)) {
      return {
        success: false,
        message: 'Image retrieval failed - invalid response',
        details: images
      };
    }
    
    const uploadedImageFound = images.find(img => img.id === uploadedImage.id);
    if (!uploadedImageFound) {
      return {
        success: false,
        message: 'Uploaded image not found in retrieval',
        details: { uploadedId: uploadedImage.id, retrievedImages: images }
      };
    }
    
    console.log('✅ Image retrieval successful:', images);
    
    // Test 3: Delete image (cleanup)
    console.log('🗑️ Testing image deletion...');
    await deleteTaskImage(taskId, uploadedImage.id);
    
    console.log('✅ Image deletion successful');
    
    return {
      success: true,
      message: 'All image upload tests passed successfully',
      details: {
        uploadedImage,
        retrievedImages: images,
        deletedImageId: uploadedImage.id
      }
    };
    
  } catch (error: any) {
    console.error('❌ Image upload test failed:', error);
    return {
      success: false,
      message: error.message || 'Unknown error occurred',
      details: error
    };
  }
}

// Helper function to create a test file
export function createTestImageFile(): File {
  // Create a simple test image (1x1 pixel PNG)
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(0, 0, 1, 1);
  }
  
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'test-image.png', { type: 'image/png' });
        resolve(file);
      }
    }, 'image/png');
  }) as any;
}

// Test configuration
export const TEST_CONFIG = {
  TASK_ID: 1, // Default test task ID
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
};
