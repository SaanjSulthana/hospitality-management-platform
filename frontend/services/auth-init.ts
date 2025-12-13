/**
 * Authentication System Initialization
 * 
 * This file initializes the enterprise-grade authentication system
 * and sets up global event listeners for cross-component communication
 */

import { tokenManager } from './token-manager';

/**
 * Initialize authentication system
 * Call this once at app startup (e.g., in main.tsx or App.tsx)
 */
export function initializeAuthSystem(): void {
  console.log('[Auth System] Initializing...');

  // Event listener for authentication failures
  window.addEventListener('authenticationFailed', (event: Event) => {
    const customEvent = event as CustomEvent;
    console.error('[Auth System] Authentication failed:', customEvent.detail?.error);
    
    // Redirect to login page
    if (window.location.pathname !== '/login') {
      console.log('[Auth System] Redirecting to login...');
      window.location.href = '/login';
    }
  });

  // Event listener for token refresh success
  window.addEventListener('tokenRefreshed', (event: Event) => {
    const customEvent = event as CustomEvent;
    console.log('[Auth System] Token refreshed successfully');
    
    // You can dispatch this to other components if needed
    // For example, to retry failed API calls
  });

  // Event listener for token expiry warnings (optional)
  const checkTokenExpiry = () => {
    if (tokenManager.isAuthenticated()) {
      const expiry = tokenManager.getTokenExpiry();
      if (expiry) {
        const msUntilExpiry = expiry.getTime() - Date.now();
        const minutesUntilExpiry = Math.floor(msUntilExpiry / 1000 / 60);
        
        // Warn if token expires in less than 2 minutes
        if (minutesUntilExpiry < 2 && minutesUntilExpiry > 0) {
          console.warn(`[Auth System] Token expires in ${minutesUntilExpiry} minutes`);
        }
      }
    }
  };

  // Check expiry every minute
  setInterval(checkTokenExpiry, 60000);

  // Clean up corrupted tokens on startup (one-time fix for existing users)
  cleanupCorruptedTokens();

  console.log('[Auth System] Initialization complete');
}

/**
 * Cleanup corrupted tokens (migration helper)
 * This is a one-time cleanup for users who had corrupted tokens
 */
function cleanupCorruptedTokens(): void {
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');

  let needsCleanup = false;

  // Check for whitespace corruption
  if (accessToken && accessToken !== accessToken.trim().replace(/[\r\n\t\s]/g, '')) {
    console.warn('[Auth System] Detected corrupted access token, cleaning up...');
    needsCleanup = true;
  }

  if (refreshToken && refreshToken !== refreshToken.trim().replace(/[\r\n\t\s]/g, '')) {
    console.warn('[Auth System] Detected corrupted refresh token, cleaning up...');
    needsCleanup = true;
  }

  if (needsCleanup) {
    // Let TokenManager handle validation and re-storage
    if (accessToken && refreshToken) {
      const cleanedAccess = accessToken.trim().replace(/[\r\n\t\s]/g, '');
      const cleanedRefresh = refreshToken.trim().replace(/[\r\n\t\s]/g, '');
      
      if (tokenManager.setTokens(cleanedAccess, cleanedRefresh)) {
        console.log('[Auth System] Tokens cleaned and re-stored successfully');
      } else {
        console.error('[Auth System] Failed to re-store cleaned tokens, clearing...');
        tokenManager.clearTokens();
      }
    }
  }
}

/**
 * Get auth system status (for debugging)
 */
export function getAuthSystemStatus() {
  return {
    isAuthenticated: tokenManager.isAuthenticated(),
    tokenExpiry: tokenManager.getTokenExpiry(),
    hasAccessToken: !!tokenManager.getAccessToken(),
  };
}

// Install debug helpers in development
if (process.env.NODE_ENV === 'development') {
  (window as any).authSystem = {
    // Basic status
    status: getAuthSystemStatus,
    
    // Token operations
    forceRefresh: () => tokenManager.forceRefresh(),
    clearTokens: () => tokenManager.clearTokens(),
    
    // DEBUG: New debugging methods
    debugStatus: () => tokenManager.getDebugStatus(),
    logDebugStatus: () => tokenManager.logDebugStatus(),
    
    // DEBUG: Toggle auto-refresh (disable to prevent auto-redirect)
    disableAutoRefresh: () => {
      tokenManager.setAutoRefreshEnabled(false);
      console.log('Auto-refresh DISABLED. Use window.authSystem.forceRefresh() to manually test refresh.');
    },
    enableAutoRefresh: () => {
      tokenManager.setAutoRefreshEnabled(true);
      console.log('Auto-refresh ENABLED.');
    },
    
    // DEBUG: Toggle verbose debug mode
    enableDebugMode: () => tokenManager.setDebugMode(true),
    disableDebugMode: () => tokenManager.setDebugMode(false),
    
    // DEBUG: Quick test - manually call refresh endpoint
    testRefresh: async () => {
      console.log('Testing manual token refresh...');
      try {
        const result = await tokenManager.forceRefresh();
        console.log('Refresh SUCCESS:', result.substring(0, 50) + '...');
        return { success: true };
      } catch (error) {
        console.error('Refresh FAILED:', error);
        return { success: false, error };
      }
    },
    
    // DEBUG: Decode and display access token
    decodeAccessToken: () => {
      const token = tokenManager.getAccessToken();
      if (!token) {
        console.log('No access token found');
        return null;
      }
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const now = Math.floor(Date.now() / 1000);
        console.log('Access Token Payload:', {
          ...payload,
          expiresAt: new Date(payload.exp * 1000).toISOString(),
          expiresInSeconds: payload.exp - now,
          isExpired: payload.exp <= now,
        });
        return payload;
      } catch (e) {
        console.error('Failed to decode token:', e);
        return null;
      }
    },
  };
  
  console.log('[Auth System] Debug helpers installed: window.authSystem');
  console.log('[Auth System] Available commands:');
  console.log('  - window.authSystem.status()         - Get basic auth status');
  console.log('  - window.authSystem.debugStatus()    - Get detailed debug info');
  console.log('  - window.authSystem.logDebugStatus() - Log debug info to console');
  console.log('  - window.authSystem.disableAutoRefresh() - Disable auto-refresh');
  console.log('  - window.authSystem.enableAutoRefresh()  - Enable auto-refresh');
  console.log('  - window.authSystem.testRefresh()    - Manually test token refresh');
  console.log('  - window.authSystem.decodeAccessToken() - Decode and display JWT');
}

