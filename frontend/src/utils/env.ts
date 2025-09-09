// Environment utilities for browser compatibility

/**
 * Get the current environment mode
 * Works with both Vite (import.meta.env) and other build tools
 */
export function getEnvMode(): 'development' | 'production' | 'test' {
  // Check for Vite environment first
  try {
    // @ts-ignore - import.meta is available in Vite
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore - import.meta.env is available in Vite
      return import.meta.env.MODE as 'development' | 'production' | 'test';
    }
  } catch (e) {
    // import.meta not available, fall through to other checks
  }
  
  // Check for defined process.env (from Vite define)
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) {
    return process.env.NODE_ENV as 'development' | 'production' | 'test';
  }
  
  // Fallback: detect by hostname
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'development';
    }
  }
  
  return 'production';
}

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  return getEnvMode() === 'development';
}

/**
 * Check if we're in production mode
 */
export function isProduction(): boolean {
  return getEnvMode() === 'production';
}

/**
 * Get environment variable with fallback
 * Works with both Vite (import.meta.env) and other build tools
 */
export function getEnvVar(key: string, fallback: string = ''): string {
  // Check for Vite environment variables first
  try {
    // @ts-ignore - import.meta is available in Vite
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore - import.meta.env is available in Vite
      return import.meta.env[key] || fallback;
    }
  } catch (e) {
    // import.meta not available, fall through to other checks
  }
  
  // Check for defined process.env (from Vite define)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  
  // Fallback for other environments
  return fallback;
}

/**
 * Get API URL from environment or use default
 */
export function getApiUrl(): string {
  return getEnvVar('VITE_API_URL') || getEnvVar('REACT_APP_API_URL') || 'http://localhost:4000';
}

/**
 * Get debug flag from environment
 */
export function isDebugEnabled(): boolean {
  return getEnvVar('VITE_DEBUG', 'false') === 'true' || isDevelopment();
}
