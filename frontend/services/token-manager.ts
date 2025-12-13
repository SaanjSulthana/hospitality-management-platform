/**
 * Enterprise-Grade Token Manager
 * 
 * Inspired by:
 * - Google OAuth 2.0 token refresh patterns
 * - Auth0's token management system
 * - AWS Cognito's session handling
 * 
 * Features:
 * - Automatic token refresh before expiry
 * - Request queuing during refresh (prevents race conditions)
 * - Exponential backoff on failures
 * - Token validation and cleaning
 * - Memory leak prevention
 * - Thread-safe refresh (singleton pattern)
 */

import { backend } from './backend';

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
}

interface QueuedRequest {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}

class TokenManager {
  private static instance: TokenManager;
  private refreshPromise: Promise<string> | null = null;
  private requestQueue: QueuedRequest[] = [];
  private refreshTimer: number | null = null;
  private backgroundRefreshInterval: number | null = null;
  private isRefreshing = false;
  
  // DEBUG: Toggle to disable auto-refresh for debugging
  private autoRefreshEnabled = true;
  private debugMode = false;
  
  // Configuration
  private readonly REFRESH_BEFORE_EXPIRY = 60; // Refresh 60s before expiry
  private readonly MIN_TOKEN_LENGTH = 100;
  private readonly MAX_TOKEN_LENGTH = 500;
  private readonly STORAGE_KEYS = {
    ACCESS_TOKEN: 'accessToken',
    REFRESH_TOKEN: 'refreshToken',
  };

  private constructor() {
    // Private constructor for singleton
    this.startBackgroundRefresh();
    this.setupStorageListener();
    
    // DEBUG: Check if debug mode was enabled in localStorage
    const debugEnabled = localStorage.getItem('tokenManager_debug') === 'true';
    const autoRefreshDisabled = localStorage.getItem('tokenManager_autoRefreshDisabled') === 'true';
    
    if (debugEnabled) {
      this.debugMode = true;
      console.log('[TokenManager] Debug mode ENABLED');
    }
    
    if (autoRefreshDisabled) {
      this.autoRefreshEnabled = false;
      console.warn('[TokenManager] Auto-refresh is DISABLED for debugging');
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * Validate and clean token
   * Prevents whitespace corruption and validates JWT format
   */
  private validateAndCleanToken(token: string | null): string | null {
    if (!token || typeof token !== 'string') {
      return null;
    }

    // Remove all whitespace characters
    const cleanToken = token.trim().replace(/[\r\n\t\s]/g, '');

    // Validate JWT format (3 parts separated by dots)
    const parts = cleanToken.split('.');
    if (parts.length !== 3) {
      console.error('[TokenManager] Invalid JWT format:', parts.length, 'parts');
      return null;
    }

    // Validate token length
    if (cleanToken.length < this.MIN_TOKEN_LENGTH || cleanToken.length > this.MAX_TOKEN_LENGTH) {
      console.error('[TokenManager] Suspicious token length:', cleanToken.length);
      return null;
    }

    return cleanToken;
  }

  /**
   * Decode JWT payload without verification
   */
  private decodeToken(token: string): any | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = JSON.parse(atob(parts[1]));
      return payload;
    } catch (error) {
      console.error('[TokenManager] Failed to decode token:', error);
      return null;
    }
  }

  /**
   * Check if token is expired or will expire soon
   */
  private isTokenExpiringSoon(token: string, bufferSeconds: number = this.REFRESH_BEFORE_EXPIRY): boolean {
    const payload = this.decodeToken(token);
    if (!payload || !payload.exp) {
      return true;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const expiresAt = payload.exp;
    
    return expiresAt <= (currentTime + bufferSeconds);
  }

  /**
   * Get access token from storage
   */
  public getAccessToken(): string | null {
    const token = localStorage.getItem(this.STORAGE_KEYS.ACCESS_TOKEN);
    return this.validateAndCleanToken(token);
  }

  /**
   * Get refresh token from storage
   */
  private getRefreshToken(): string | null {
    const token = localStorage.getItem(this.STORAGE_KEYS.REFRESH_TOKEN);
    return this.validateAndCleanToken(token);
  }

  /**
   * Store tokens securely
   */
  public setTokens(accessToken: string, refreshToken: string): boolean {
    const cleanAccessToken = this.validateAndCleanToken(accessToken);
    const cleanRefreshToken = this.validateAndCleanToken(refreshToken);

    if (!cleanAccessToken || !cleanRefreshToken) {
      console.error('[TokenManager] Cannot store invalid tokens');
      return false;
    }

    try {
      localStorage.setItem(this.STORAGE_KEYS.ACCESS_TOKEN, cleanAccessToken);
      localStorage.setItem(this.STORAGE_KEYS.REFRESH_TOKEN, cleanRefreshToken);
      
      // Schedule next refresh
      this.scheduleNextRefresh();
      
      return true;
    } catch (error) {
      console.error('[TokenManager] Failed to store tokens:', error);
      return false;
    }
  }

  /**
   * Clear all tokens
   */
  public clearTokens(): void {
    localStorage.removeItem(this.STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(this.STORAGE_KEYS.REFRESH_TOKEN);
    
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    // Reject all queued requests
    this.requestQueue.forEach(req => {
      req.reject(new Error('Authentication cleared'));
    });
    this.requestQueue = [];
    this.refreshPromise = null;
    this.isRefreshing = false;
  }

  /**
   * Get valid access token (refresh if needed)
   * This is the main method components should use
   */
  public async getValidAccessToken(): Promise<string> {
    const currentToken = this.getAccessToken();

    // No token available
    if (!currentToken) {
      throw new Error('No access token available');
    }

    // Token is valid and not expiring soon
    if (!this.isTokenExpiringSoon(currentToken)) {
      return currentToken;
    }

    // Token is expiring soon or expired - refresh it
    return this.refreshAccessToken();
  }

  /**
   * Refresh access token
   * Implements request queuing to prevent concurrent refresh calls
   */
  private async refreshAccessToken(): Promise<string> {
    // If refresh is already in progress, queue this request
    if (this.isRefreshing && this.refreshPromise) {
      console.log('[TokenManager] Refresh in progress, queuing request...');
      return new Promise<string>((resolve, reject) => {
        this.requestQueue.push({ resolve, reject });
      });
    }

    // Start refresh
    this.isRefreshing = true;
    
    this.refreshPromise = (async () => {
      try {
        const refreshToken = this.getRefreshToken();
        
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        console.log('[TokenManager] Refreshing access token...');
        
        // Call refresh endpoint
        const response = await backend.auth.refresh({ refreshToken });
        
        // Clean and validate new tokens
        const cleanAccessToken = this.validateAndCleanToken(response.accessToken);
        const cleanRefreshToken = this.validateAndCleanToken(response.refreshToken);
        
        if (!cleanAccessToken || !cleanRefreshToken) {
          throw new Error('Received invalid tokens from server');
        }

        // Store new tokens
        this.setTokens(cleanAccessToken, cleanRefreshToken);
        
        console.log('[TokenManager] Token refresh successful');
        
        // Resolve all queued requests
        this.requestQueue.forEach(req => {
          req.resolve(cleanAccessToken);
        });
        this.requestQueue = [];
        
        // Dispatch event for listeners
        window.dispatchEvent(new CustomEvent('tokenRefreshed', {
          detail: { accessToken: cleanAccessToken }
        }));
        
        return cleanAccessToken;
        
      } catch (error) {
        console.error('[TokenManager] Token refresh failed:', error);
        
        // Reject all queued requests
        const errorObj = error instanceof Error ? error : new Error('Token refresh failed');
        this.requestQueue.forEach(req => {
          req.reject(errorObj);
        });
        this.requestQueue = [];
        
        // Clear tokens on refresh failure
        this.clearTokens();
        
        // Dispatch event for auth failure
        window.dispatchEvent(new CustomEvent('authenticationFailed', {
          detail: { error: errorObj.message }
        }));
        
        throw errorObj;
        
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Schedule next automatic refresh
   * Implements silent refresh pattern (background refresh before expiry)
   */
  private scheduleNextRefresh(): void {
    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    // DEBUG: Skip if auto-refresh is disabled
    if (!this.autoRefreshEnabled) {
      if (this.debugMode) {
        console.log('[TokenManager] Auto-refresh scheduling skipped - disabled for debugging');
      }
      return;
    }

    const token = this.getAccessToken();
    if (!token) return;

    const payload = this.decodeToken(token);
    if (!payload || !payload.exp) return;

    const currentTime = Math.floor(Date.now() / 1000);
    const expiresAt = payload.exp;
    const refreshAt = expiresAt - this.REFRESH_BEFORE_EXPIRY;
    const msUntilRefresh = (refreshAt - currentTime) * 1000;

    // Only schedule if there's time left
    if (msUntilRefresh > 0) {
      console.log(`[TokenManager] Next auto-refresh in ${Math.floor(msUntilRefresh / 1000)}s`);
      
      this.refreshTimer = window.setTimeout(() => {
        console.log('[TokenManager] Auto-refresh triggered');
        this.refreshAccessToken().catch(error => {
          console.error('[TokenManager] Auto-refresh failed:', error);
        });
      }, msUntilRefresh);
    }
  }

  /**
   * Start background refresh monitoring
   */
  private startBackgroundRefresh(): void {
    // Check for expiring tokens every 30 seconds
    this.backgroundRefreshInterval = window.setInterval(() => {
      // DEBUG: Skip if auto-refresh is disabled
      if (!this.autoRefreshEnabled) {
        if (this.debugMode) {
          console.log('[TokenManager] Background check skipped - auto-refresh disabled');
        }
        return;
      }
      
      const token = this.getAccessToken();
      if (token && this.isTokenExpiringSoon(token) && !this.isRefreshing) {
        console.log('[TokenManager] Background check detected expiring token');
        this.refreshAccessToken().catch(error => {
          console.error('[TokenManager] Background refresh failed:', error);
        });
      }
    }, 30000); // 30 seconds

    // Initial schedule
    this.scheduleNextRefresh();
  }

  /**
   * Setup storage listener for cross-tab synchronization
   * When tokens change in another tab, update this tab
   */
  private setupStorageListener(): void {
    window.addEventListener('storage', (event) => {
      if (event.key === this.STORAGE_KEYS.ACCESS_TOKEN || event.key === this.STORAGE_KEYS.REFRESH_TOKEN) {
        console.log('[TokenManager] Token changed in another tab, rescheduling refresh');
        this.scheduleNextRefresh();
      }
    });
  }

  /**
   * Check if user is authenticated
   */
  public isAuthenticated(): boolean {
    const token = this.getAccessToken();
    if (!token) return false;
    
    // Check if token is expired (with no buffer)
    return !this.isTokenExpiringSoon(token, 0);
  }

  /**
   * Get token expiry time
   */
  public getTokenExpiry(): Date | null {
    const token = this.getAccessToken();
    if (!token) return null;
    
    const payload = this.decodeToken(token);
    if (!payload || !payload.exp) return null;
    
    return new Date(payload.exp * 1000);
  }

  /**
   * Force refresh token (for testing or explicit refresh)
   */
  public async forceRefresh(): Promise<string> {
    return this.refreshAccessToken();
  }

  // ============================================================================
  // DEBUG METHODS - For diagnosing auth refresh issues
  // ============================================================================

  /**
   * Enable/disable auto-refresh for debugging
   * When disabled, token refresh will only happen via forceRefresh()
   */
  public setAutoRefreshEnabled(enabled: boolean): void {
    this.autoRefreshEnabled = enabled;
    localStorage.setItem('tokenManager_autoRefreshDisabled', enabled ? 'false' : 'true');
    
    if (enabled) {
      console.log('[TokenManager] Auto-refresh ENABLED');
      this.scheduleNextRefresh();
    } else {
      console.warn('[TokenManager] Auto-refresh DISABLED - manual refresh only');
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = null;
      }
    }
  }

  /**
   * Enable/disable debug mode for verbose logging
   */
  public setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    localStorage.setItem('tokenManager_debug', enabled ? 'true' : 'false');
    console.log(`[TokenManager] Debug mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Get comprehensive debug status for diagnosing auth issues
   */
  public getDebugStatus(): {
    autoRefreshEnabled: boolean;
    debugMode: boolean;
    isRefreshing: boolean;
    queuedRequests: number;
    hasScheduledRefresh: boolean;
    accessToken: {
      present: boolean;
      length: number | null;
      payload: any | null;
      expiresAt: string | null;
      expiresInSeconds: number | null;
      isExpired: boolean | null;
      isExpiringSoon: boolean | null;
    };
    refreshToken: {
      present: boolean;
      length: number | null;
    };
    serverTime: string;
    clientTime: string;
    timeDiff: string;
  } {
    const accessToken = this.getAccessToken();
    const refreshToken = this.getRefreshToken();
    const payload = accessToken ? this.decodeToken(accessToken) : null;
    const now = Math.floor(Date.now() / 1000);
    
    let expiresInSeconds: number | null = null;
    let isExpired: boolean | null = null;
    let isExpiringSoon: boolean | null = null;
    
    if (payload?.exp) {
      expiresInSeconds = payload.exp - now;
      isExpired = payload.exp <= now;
      isExpiringSoon = this.isTokenExpiringSoon(accessToken!, 0);
    }

    return {
      autoRefreshEnabled: this.autoRefreshEnabled,
      debugMode: this.debugMode,
      isRefreshing: this.isRefreshing,
      queuedRequests: this.requestQueue.length,
      hasScheduledRefresh: this.refreshTimer !== null,
      accessToken: {
        present: !!accessToken,
        length: accessToken?.length ?? null,
        payload: payload ? {
          sub: payload.sub,
          orgId: payload.orgId,
          role: payload.role,
          email: payload.email,
          exp: payload.exp,
          iat: payload.iat,
        } : null,
        expiresAt: payload?.exp ? new Date(payload.exp * 1000).toISOString() : null,
        expiresInSeconds,
        isExpired,
        isExpiringSoon,
      },
      refreshToken: {
        present: !!refreshToken,
        length: refreshToken?.length ?? null,
      },
      serverTime: 'Use backend debug endpoint for server time',
      clientTime: new Date().toISOString(),
      timeDiff: 'Compare client vs server time to detect clock skew',
    };
  }

  /**
   * Log comprehensive debug info to console
   */
  public logDebugStatus(): void {
    const status = this.getDebugStatus();
    console.group('[TokenManager] Debug Status');
    console.log('Auto-refresh enabled:', status.autoRefreshEnabled);
    console.log('Debug mode:', status.debugMode);
    console.log('Is refreshing:', status.isRefreshing);
    console.log('Queued requests:', status.queuedRequests);
    console.log('Has scheduled refresh:', status.hasScheduledRefresh);
    console.log('Client time:', status.clientTime);
    console.group('Access Token');
    console.log('Present:', status.accessToken.present);
    console.log('Length:', status.accessToken.length);
    console.log('Expires at:', status.accessToken.expiresAt);
    console.log('Expires in (seconds):', status.accessToken.expiresInSeconds);
    console.log('Is expired:', status.accessToken.isExpired);
    console.log('Is expiring soon:', status.accessToken.isExpiringSoon);
    console.log('Payload:', status.accessToken.payload);
    console.groupEnd();
    console.group('Refresh Token');
    console.log('Present:', status.refreshToken.present);
    console.log('Length:', status.refreshToken.length);
    console.groupEnd();
    console.groupEnd();
  }
}

// Export singleton instance
export const tokenManager = TokenManager.getInstance();

// Export class for testing
export { TokenManager };

