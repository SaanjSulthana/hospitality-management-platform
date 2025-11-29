import { getApiUrl, getVersionedApiUrl, isDevelopment, API_VERSION } from '../utils/env';

// API Configuration
export const API_CONFIG = {
  // IMPORTANT: Use UNVERSIONED base URL here because all endpoints in API_ENDPOINTS
  // already include the '/v1' prefix. Using a versioned base would cause '/v1/v1/...'
  // and lead to 404s.
  BASE_URL: getApiUrl(),
  BASE_URL_UNVERSIONED: getApiUrl(), // Kept for compatibility
  API_VERSION: API_VERSION, // /v1
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
  DEBUG: isDevelopment(),
};

// Image Upload Configuration
export const IMAGE_UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  MAX_IMAGES_PER_TASK: 5,
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  UPLOAD_FAILED: 'Failed to upload image. Please try again.',
  INVALID_FILE_TYPE: 'Invalid file type. Please upload images (JPG, PNG, WebP) only.',
  FILE_TOO_LARGE: 'File size too large. Maximum size is 50MB.',
  NO_FILE_SELECTED: 'Please select at least one image to upload.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  SERVER_ERROR: 'Server error. Please try again later.',
};
