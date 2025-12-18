// Environment utilities for browser compatibility
// Enhanced with Capacitor platform detection

import { Capacitor } from '@capacitor/core';

/**
 * Check if running inside Capacitor native app
 */
export function isCapacitor(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Get current platform
 */
export function getPlatform(): 'web' | 'android' | 'ios' {
  try {
    if (!isCapacitor()) return 'web';
    const platform = Capacitor.getPlatform();
    return (platform === 'android' || platform === 'ios') ? platform : 'web';
  } catch {
    return 'web';
  }
}

/**
 * Check if running on Android
 */
export function isAndroid(): boolean {
  return getPlatform() === 'android';
}

/**
 * Check if running on iOS
 */
export function isIOS(): boolean {
  return getPlatform() === 'ios';
}

/**
 * Check if running on mobile (native or mobile browser)
 */
export function isMobile(): boolean {
  if (isCapacitor()) return true;
  if (typeof window !== 'undefined') {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }
  return false;
}

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
 * API Version prefix for versioned endpoints
 * All new API calls should use /v1 prefix
 */
export const API_VERSION = '/v1';

/**
 * Get API URL from environment or use default
 * Returns BASE URL without version prefix (version added per request)
 * Enhanced with Capacitor support
 */
export function getApiUrl(): string {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/33d595d9-e296-4216-afc6-6fa72f7ee3e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'env.ts:getApiUrl:entry',message:'getApiUrl called',data:{isCapacitorResult:isCapacitor(),platform:getPlatform()},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion

  // Check for explicit environment variables first
  const viteApiUrl = getEnvVar('VITE_API_URL');
  const reactApiUrl = getEnvVar('REACT_APP_API_URL');
  
  if (viteApiUrl) return viteApiUrl;
  if (reactApiUrl) return reactApiUrl;
  
  // For Capacitor native apps - use Encore staging API
  if (isCapacitor()) {
    const capacitorApiUrl = 'https://staging-hospitality-management-platform-cr8i.encr.app';
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/33d595d9-e296-4216-afc6-6fa72f7ee3e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'env.ts:getApiUrl:capacitor',message:'Capacitor detected, returning staging API',data:{url:capacitorApiUrl},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    return capacitorApiUrl;
  }
  
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
 * Get full API URL with version prefix
 * Use this for making API calls with versioned endpoints
 */
export function getVersionedApiUrl(): string {
  return `${getApiUrl()}${API_VERSION}`;
}

/**
 * Get debug flag from environment
 */
export function isDebugEnabled(): boolean {
  return getEnvVar('VITE_DEBUG', 'false') === 'true' || isDevelopment();
}
