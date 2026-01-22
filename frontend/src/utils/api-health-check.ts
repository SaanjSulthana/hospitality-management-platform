/**
 * API Health Check Utility
 * Detects if the primary API URL is available and falls back if needed
 */

import { getApiUrl, getFallbackApiUrl } from './env';

let cachedApiUrl: string | null = null;
let healthCheckPromise: Promise<string> | null = null;

/**
 * Check if an API URL is reachable
 */
async function checkApiHealth(apiUrl: string, timeout = 3000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(`${apiUrl}/v1/config/health`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Get the best available API URL
 * Checks primary URL first, falls back to Encore Cloud default if needed
 */
export async function getBestAvailableApiUrl(): Promise<string> {
  // Return cached result if available
  if (cachedApiUrl) {
    return cachedApiUrl;
  }
  
  // Return existing promise if health check is in progress
  if (healthCheckPromise) {
    return healthCheckPromise;
  }
  
  // Start health check
  healthCheckPromise = (async () => {
    const primaryUrl = getApiUrl();
    const fallbackUrl = getFallbackApiUrl();
    
    // If primary is already the fallback, just return it
    if (primaryUrl === fallbackUrl) {
      cachedApiUrl = primaryUrl;
      return primaryUrl;
    }
    
    // Check if primary URL is available (only for production URLs)
    if (primaryUrl.startsWith('https://')) {
      const isHealthy = await checkApiHealth(primaryUrl);
      
      if (isHealthy) {
        cachedApiUrl = primaryUrl;
        return primaryUrl;
      }
      
      // Primary failed, use fallback
      console.warn(
        `[API Health Check] Primary API URL (${primaryUrl}) is not available. ` +
        `Falling back to Encore Cloud default: ${fallbackUrl}`
      );
      cachedApiUrl = fallbackUrl;
      return fallbackUrl;
    }
    
    // For localhost, just return it
    cachedApiUrl = primaryUrl;
    return primaryUrl;
  })();
  
  try {
    return await healthCheckPromise;
  } finally {
    healthCheckPromise = null;
  }
}

/**
 * Reset cached API URL (useful for testing or after configuration changes)
 */
export function resetApiUrlCache(): void {
  cachedApiUrl = null;
  healthCheckPromise = null;
}

/**
 * Get API URL synchronously (uses cached result if available)
 * For immediate use without waiting for health check
 */
export function getApiUrlSync(): string {
  return cachedApiUrl || getApiUrl();
}

