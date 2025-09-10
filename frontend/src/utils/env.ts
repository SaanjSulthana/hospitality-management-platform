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
  // Check for explicit environment variables first
  const viteApiUrl = getEnvVar('VITE_API_URL');
  const reactApiUrl = getEnvVar('REACT_APP_API_URL');
  
  if (viteApiUrl) return viteApiUrl;
  if (reactApiUrl) return reactApiUrl;
  
  // Auto-detect based on current hostname for Encore Cloud
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // If running on Encore Cloud staging frontend, use staging API
    if (hostname.includes('staging-hospitality-management-platform-cr8i.frontend.encr.app')) {
      return 'https://api.curat.ai';
    }
    
    // If running on Encore Cloud production frontend, use production API
    if (hostname.includes('hospitality-management-platform-cr8i.frontend.encr.app')) {
      return 'https://api.curat.ai'; // Update this when you have production API
    }
  }
  
  // Default to localhost for development
  return 'http://localhost:4000';
}

/**
 * Get debug flag from environment
 */
export function isDebugEnabled(): boolean {
  return getEnvVar('VITE_DEBUG', 'false') === 'true' || isDevelopment();
}
