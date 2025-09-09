// Test utilities for upload functionality
import { API_CONFIG } from '../config/api';

export interface UploadTestResult {
  success: boolean;
  error?: string;
  details?: any;
}

/**
 * Test file upload endpoint
 */
export async function testFileUpload(): Promise<UploadTestResult> {
  try {
    console.log('🧪 Testing file upload endpoint...');
    
    // Create a small test file
    const testContent = 'Test file content for upload';
    const testFile = new File([testContent], 'test.txt', { type: 'text/plain' });
    
    // Convert to base64
    const arrayBuffer = await testFile.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const base64String = btoa(String.fromCharCode(...buffer));
    
    const response = await fetch(`${API_CONFIG.BASE_URL}/uploads/file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      },
      body: JSON.stringify({
        fileData: base64String,
        filename: testFile.name,
        mimeType: testFile.type,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        details: { status: response.status, statusText: response.statusText }
      };
    }
    
    const result = await response.json();
    console.log('✅ File upload test successful:', result);
    
    return {
      success: true,
      details: result
    };
    
  } catch (error) {
    console.error('❌ File upload test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test task image upload endpoint
 */
export async function testTaskImageUpload(taskId: number): Promise<UploadTestResult> {
  try {
    console.log('🧪 Testing task image upload endpoint...');
    
    // Create a small test image (1x1 pixel PNG)
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    
    const response = await fetch(`${API_CONFIG.BASE_URL}/tasks/${taskId}/images`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        taskId,
        fileData: testImageBase64,
        filename: 'test.png',
        mimeType: 'image/png',
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        details: { status: response.status, statusText: response.statusText }
      };
    }
    
    const result = await response.json();
    console.log('✅ Task image upload test successful:', result);
    
    return {
      success: true,
      details: result
    };
    
  } catch (error) {
    console.error('❌ Task image upload test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test all upload endpoints
 */
export async function testAllUploads(taskId?: number): Promise<void> {
  console.log('🚀 Starting comprehensive upload tests...');
  
  // Test file upload
  const fileUploadResult = await testFileUpload();
  console.log('File Upload Test:', fileUploadResult);
  
  // Test task image upload if taskId provided
  if (taskId) {
    const taskImageResult = await testTaskImageUpload(taskId);
    console.log('Task Image Upload Test:', taskImageResult);
  }
  
  console.log('🏁 Upload tests completed');
}

// Auto-run tests in development
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  console.log('🔧 Upload tests available. Call testAllUploads(taskId) to run tests.');
  (window as any).testAllUploads = testAllUploads;
  (window as any).testFileUpload = testFileUpload;
  (window as any).testTaskImageUpload = testTaskImageUpload;
}
