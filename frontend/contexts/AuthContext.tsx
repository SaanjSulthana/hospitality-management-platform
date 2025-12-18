import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { backend, getAuthenticatedBackend } from '../services/backend';
import type { AuthData } from '~backend/auth/types';
import { useQueryClient } from '@tanstack/react-query';
import { getUserLocation, getUserIP, getUserAgent, getUserLocale } from '../utils/geolocation';
import { tokenManager } from '../services/token-manager';

interface AuthContextType {
  user: AuthData | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  getAuthenticatedBackend: () => any;
  trackActivity: () => Promise<void>;
  refreshUser: () => Promise<void>;
  showLogoutProgress: boolean;
  setShowLogoutProgress: (show: boolean) => void;
  setIsTestingLogoutDialog: (testing: boolean) => void;
  clearCorruptedTokens: () => void;
  clearAllAuthData: () => void;
  authError: 'expired' | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthData | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLogoutProgress, setShowLogoutProgress] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isTestingLogoutDialog, setIsTestingLogoutDialog] = useState(false);
  const [authError, setAuthError] = useState<'expired' | null>(null);

  // Cross-tab coordination
  const refreshChannelRef = useRef<BroadcastChannel | null>(null);
  const isRefreshingRef = useRef<boolean>(false);
  const refreshWaitersRef = useRef<Array<(ok: boolean) => void>>([]);
  const retryStreakRef = useRef<number>(0);
  const tabIdRef = useRef<string>((() => {
    try {
      const existing = sessionStorage.getItem('auth-tab-id');
      if (existing) return existing;
      const id = Math.random().toString(36).slice(2);
      sessionStorage.setItem('auth-tab-id', id);
      return id;
    } catch {
      return Math.random().toString(36).slice(2);
    }
  })());
  const authControlChannelRef = useRef<BroadcastChannel | null>(null);
  const receivedExternalLogoutRef = useRef<boolean>(false);

  // State change logging for debugging (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 AuthContext State Change:', {
        showLogoutProgress,
        isLoggingIn,
        isInitializing,
        isLoggingOut,
        user: !!user,
        timestamp: new Date().toISOString()
      });
    }
  }, [showLogoutProgress, isLoggingIn, isInitializing, isLoggingOut, user]);
  const queryClient = useQueryClient();

  // Add debouncing for token refresh to prevent multiple simultaneous calls
  const refreshPromiseRef = useRef<Promise<string> | null>(null);

  // Helper function to validate and clean tokens before use
  const validateAndCleanToken = (token: string | null): string | null => {
    if (!token || typeof token !== 'string') {
      return null;
    }

    // Clean the token
    const cleanedToken = token.trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '');
    
    // Validate JWT format (3 parts separated by dots)
    const parts = cleanedToken.split('.');
    if (parts.length !== 3) {
      console.error('Invalid JWT format, token has', parts.length, 'parts');
      return null;
    }

    // Check if token length is reasonable (should be around 200-300 chars)
    if (cleanedToken.length < 100 || cleanedToken.length > 500) {
      console.error('Suspicious token length:', cleanedToken.length);
      return null;
    }

    return cleanedToken;
  };

  // Helper function to safely store tokens
  const safelyStoreTokens = (accessToken: string, refreshToken: string) => {
    // Validate tokens before storing
    const validAccessToken = validateAndCleanToken(accessToken);
    const validRefreshToken = validateAndCleanToken(refreshToken);
    
    if (!validAccessToken || !validRefreshToken) {
      console.error('Invalid tokens, cannot store');
      return false;
    }
    
    // Check for suspicious duplication
    if (validAccessToken.length > 400) {
      console.error('SUSPICIOUS: Access token length > 400 chars, this indicates corruption');
      return false;
    }
    
    // Store tokens
    localStorage.setItem('accessToken', validAccessToken);
    localStorage.setItem('refreshToken', validRefreshToken);
    
    console.log('Tokens safely stored:', {
      accessTokenLength: validAccessToken.length,
      refreshTokenLength: validRefreshToken.length
    });
    
    return true;
  };

  // Always read the latest token from localStorage when creating the backend client.
  // This prevents stale tokens being used across re-renders or after navigating.

  // Track user activity with geolocation data
  const trackUserActivity = async (userId: number, activityType: 'login' | 'activity' | 'logout') => {
    try {
      const authenticatedBackend = getAuthenticatedBackend();
      
      // Get geolocation and device information
      const [locationData, ipAddress, userAgent] = await Promise.all([
        getUserLocation(),
        getUserIP(),
        Promise.resolve(getUserAgent()),
      ]);

      // Update user activity in the backend
      await authenticatedBackend.users.updateActivity({
        activityType,
        ipAddress: ipAddress || undefined,
        userAgent,
        locationData: locationData || undefined,
      });

      console.log('User activity tracked:', { activityType, locationData });
    } catch (error) {
      console.warn('Failed to track user activity:', error);
      // Don't throw error as this is not critical for the main functionality
    }
  };

  const login = async (email: string, password: string) => {
    try {
      console.log('[AuthContext] Login started');
      setIsLoggingIn(true);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/33d595d9-e296-4216-afc6-6fa72f7ee3e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.tsx:login:start',message:'Login attempt starting',data:{email,timestamp:new Date().toISOString()},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      
      // Reset logout progress state immediately to prevent popup after login
      setShowLogoutProgress(false);
      setIsLoggingOut(false);
      
      // #region agent log - visible debug
      const apiUrl = (await import('../src/utils/env')).getVersionedApiUrl();
      console.log('[DEBUG] API URL:', apiUrl);
      localStorage.setItem('__debug_api_url', apiUrl);
      // #endregion
      
      const response = await backend.auth.login({ email, password });
      
      // #region agent log - visible debug after login API
      console.log('[DEBUG] Login API response received:', !!response);
      localStorage.setItem('__debug_login_response', JSON.stringify({
        hasResponse: !!response,
        hasAccessToken: !!response?.accessToken,
        hasUser: !!response?.user,
        timestamp: new Date().toISOString()
      }));
      // #endregion
      
      // Use TokenManager to store tokens (includes validation and cleaning)
      const stored = tokenManager.setTokens(response.accessToken, response.refreshToken);
      
      // #region agent log - visible debug token storage
      console.log('[DEBUG] Token storage result:', stored);
      localStorage.setItem('__debug_token_stored', JSON.stringify({
        stored,
        timestamp: new Date().toISOString()
      }));
      // #endregion
      
      if (!stored) {
        throw new Error('Failed to store tokens safely');
      }
      
      // Set the token in state
      setAccessToken(response.accessToken);
      setUser({
        ...response.user,
        userID: response.user.id.toString()
      });
      
      // Clear any previous cached data to avoid stale views after user switch
      console.log('[AuthContext] Clearing query cache after login...');
      queryClient.clear();

      // IMPORTANT: Wait a moment to ensure token is stored, then create authenticated backend
      await new Promise(resolve => setTimeout(resolve, 200));

      const authenticatedBackend = getAuthenticatedBackend();
      if (!authenticatedBackend) {
        console.error('[AuthContext] Failed to create authenticated backend client');
        throw new Error('Failed to create authenticated backend client');
      }
      
      console.log('[AuthContext] Calling /auth/me with authenticated backend...');
      const meResponse = await authenticatedBackend.auth.me();
      setUser(meResponse.user);
      
      // #region agent log - visible debug success
      console.log('[DEBUG] Login complete, user set:', meResponse.user?.email);
      localStorage.setItem('__debug_login_success', JSON.stringify({
        success: true,
        userEmail: meResponse.user?.email,
        timestamp: new Date().toISOString()
      }));
      // Show success alert for debugging
      if (typeof window !== 'undefined') {
        window.alert(`Login Success! User: ${meResponse.user?.email}`);
      }
      // #endregion
      
      // Track login activity with geolocation (non-blocking)
      trackUserActivity(parseInt(meResponse.user.userID), 'login').catch(error => {
        console.warn('[AuthContext] Login activity tracking failed (non-critical):', error);
      });
      
      console.log('[AuthContext] Login successful, user set:', meResponse.user);
    } catch (error) {
      console.error('[AuthContext] Login failed:', error);
      
      // #region agent log - visible debug for mobile
      const errorInfo = {
        message: String(error),
        name: (error as any)?.name || 'Unknown',
        stack: (error as any)?.stack?.substring(0, 300) || 'No stack'
      };
      // Store debug info for visibility
      try {
        localStorage.setItem('__debug_last_login_error', JSON.stringify(errorInfo));
        // Show alert on mobile for debugging
        if (typeof window !== 'undefined' && window.alert) {
          window.alert(`Login Error: ${errorInfo.message}`);
        }
      } catch (e) { /* ignore storage errors */ }
      // #endregion
      
      // Clear tokens using TokenManager
      tokenManager.clearTokens();
      setAccessToken(null);
      setUser(null);
      
      throw error;
    } finally {
      console.log('[AuthContext] Login completed');
      setIsLoggingIn(false);
    }
  };

  const clearCorruptedTokens = () => {
    console.log('Clearing corrupted tokens...');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setAccessToken(null);
    setUser(null);
    queryClient.clear();
    // Don't show logout modal when clearing corrupted tokens
    // This is typically called during auth initialization or token refresh failures
  };

  const clearAllAuthData = () => {
    console.log('Clearing all auth data...');
    localStorage.clear();
    setAccessToken(null);
    setUser(null);
    queryClient.clear();
    window.location.href = '/login';
  };

  const logout = async () => {
    // Prevent multiple logout calls
    if (isLoggingOut) {
      console.log('Logout already in progress, ignoring duplicate call');
      return;
    }
    
    setIsLoggingOut(true);
    
    // Store whether we should show progress dialog
    const shouldShowProgress = !isLoggingIn && !isInitializing && !!user;
    console.log('🚪 Logout called - shouldShowProgress:', shouldShowProgress, 'isLoggingIn:', isLoggingIn, 'isInitializing:', isInitializing, 'user:', !!user);
    console.log('📊 Current state values:', { isLoggingIn, isInitializing, user: !!user, showLogoutProgress });
    
    // Enhanced state change tracking
    console.log('🔄 State transitions during logout:', {
      before: { isLoggingOut: false, showLogoutProgress },
      action: 'Starting logout process',
      timestamp: new Date().toISOString()
    });
    
    try {
      // Broadcast logout to sibling tabs first (idempotent)
      try {
        const id = (window.crypto && 'randomUUID' in window.crypto) ? (window.crypto as any).randomUUID() : Math.random().toString(36).slice(2);
        const payload = { t: 'logout', id, ts: Date.now() };
        authControlChannelRef.current?.postMessage(payload);
        try { localStorage.setItem('auth-logout', JSON.stringify(payload)); } catch {}
      } catch {}

      // FORCE show progress dialog for testing
      console.log('🔧 FORCING showLogoutProgress to true for testing');
      setShowLogoutProgress(true);
      console.log('✅ setShowLogoutProgress(true) called - should trigger re-render');
      
      if (shouldShowProgress) {
        // Start logout progress dialog
        console.log('Setting showLogoutProgress to true');
        setShowLogoutProgress(true);
        
        // Add small delay to let the progress dialog appear
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('Progress dialog should be visible now');
      } else {
        console.log('Skipping logout progress dialog due to login/initialization state or no user');
      }
      
      // Track logout activity before clearing user data (non-blocking)
      if (user) {
        trackUserActivity(parseInt(user.userID), 'logout').catch(error => {
          console.warn('Logout activity tracking failed (non-critical):', error);
        });
      }
      
      // Start the logout API call in parallel with progress dialog
      const logoutPromise = (async () => {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          try {
            await backend.auth.logout({ refreshToken });
            console.log('Logout API call completed');
          } catch (error) {
            console.error('Logout API call failed:', error);
            // Continue with local logout even if API call fails
          }
        }
      })();
      
      // Wait for the logout API call to complete first
      await logoutPromise;
      
      // If showing progress dialog, wait for it to complete naturally
      if (shouldShowProgress) {
        const startTime = Date.now();
        console.log('Waiting for logout progress to complete naturally...', 'Start time:', startTime);
        
        // Wait for the progress dialog to complete (about 4.5 seconds total)
        await new Promise(resolve => setTimeout(resolve, 4500));
        
        const endTime = Date.now();
        const totalDuration = endTime - startTime;
        console.log('Logout progress wait completed', 'End time:', endTime, 'Total duration:', totalDuration + 'ms');
      } else {
        console.log('Not waiting for progress dialog - shouldShowProgress:', shouldShowProgress);
      }
      
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local storage and state
      console.log('[AuthContext] Finally block - clearing state, shouldShowProgress:', shouldShowProgress);
      tokenManager.clearTokens();
      setAccessToken(null);
      setUser(null);
      // Clear all cached queries so the next user/session gets fresh data
      console.log('[AuthContext] Clearing query cache after logout...');
      queryClient.clear();
      
      // If logout progress is showing, let it complete naturally
      if (shouldShowProgress) {
        // Progress dialog will continue and then hide itself
        console.log('Logout progress dialog will complete automatically');
      } else {
        // Force completion if not showing progress dialog
        console.log('Force closing logout progress dialog');
        setShowLogoutProgress(false);
      }
      
      // Reset logout state
      setIsLoggingOut(false);
    }
  };

  const refreshAccessToken = async (): Promise<string> => {
    // Mutex (Web Locks if available, else localStorage lease)
    if (isRefreshingRef.current) {
      // Gate followers until leader completes
      return await new Promise<string>((resolve, reject) => {
        refreshWaitersRef.current.push((ok) => {
          if (ok) {
            const token = localStorage.getItem('accessToken');
            if (token) resolve(token); else reject(new Error('No token after refresh'));
          } else {
            reject(new Error('Refresh failed'));
          }
        });
      });
    }

    const acquireLocalLease = (): boolean => {
      try {
        const key = 'auth_refresh_lock';
        const raw = localStorage.getItem(key);
        const now = Date.now();
        const lease = raw ? JSON.parse(raw) : null;
        if (!lease || lease.exp < now) {
          localStorage.setItem(key, JSON.stringify({ owner: tabIdRef.current, exp: now + 10000 }));
          return true;
        }
        return lease.owner === tabIdRef.current;
      } catch { return true; }
    };

    const releaseLocalLease = () => {
      try { localStorage.removeItem('auth_refresh_lock'); } catch {}
    };

    isRefreshingRef.current = true;
    refreshChannelRef.current?.postMessage({ t: 'refresh-started' });

    const doRefresh = async () => {
      try {
        console.log('[AuthContext] Refreshing access token via TokenManager...');
        const newToken = await tokenManager.getValidAccessToken();
        setAccessToken(newToken);
        retryStreakRef.current = 0;
        setAuthError(null);
        refreshChannelRef.current?.postMessage({ t: 'refresh-success', token: newToken });
        // Wake gated followers
        refreshWaitersRef.current.splice(0).forEach(fn => fn(true));
        return newToken;
      } catch (error) {
        console.error('[AuthContext] Token refresh failed:', error);
        retryStreakRef.current += 1;
        if (retryStreakRef.current >= 2) {
          setAuthError('expired');
        }
        refreshChannelRef.current?.postMessage({ t: 'refresh-failed' });
        refreshWaitersRef.current.splice(0).forEach(fn => fn(false));
        tokenManager.clearTokens();
        setAccessToken(null);
        setUser(null);
        throw error;
      } finally {
        isRefreshingRef.current = false;
        releaseLocalLease();
      }
    };

    // Prefer Web Locks API where available
    const runWithWebLock = async (): Promise<string> => {
      // @ts-ignore
      if (navigator?.locks?.request) {
        // @ts-ignore
        return await navigator.locks.request('auth-refresh', async () => await doRefresh());
      }
      if (!acquireLocalLease()) {
        // Another tab owns the lease; wait for broadcast
        return await new Promise<string>((resolve, reject) => {
          refreshWaitersRef.current.push((ok) => {
            if (ok) {
              const token = localStorage.getItem('accessToken');
              if (token) resolve(token); else reject(new Error('No token after refresh'));
            } else reject(new Error('Refresh failed'));
          });
        });
      }
      return await doRefresh();
    };

    return await runWithWebLock();
  };

  useEffect(() => {
    // Auth refresh coordination channel
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      refreshChannelRef.current = new BroadcastChannel('auth-refresh');
      refreshChannelRef.current.onmessage = (ev) => {
        const msg = ev.data || {};
        if (msg.t === 'refresh-success') {
          if (msg.token) {
            localStorage.setItem('accessToken', msg.token);
            setAccessToken(msg.token);
          }
          retryStreakRef.current = 0;
          setAuthError(null);
          refreshWaitersRef.current.splice(0).forEach(fn => fn(true));
        } else if (msg.t === 'refresh-failed') {
          retryStreakRef.current += 1;
          if (retryStreakRef.current >= 2) setAuthError('expired');
          refreshWaitersRef.current.splice(0).forEach(fn => fn(false));
        }
      };

      // Cross-tab auth control (logout broadcast)
      try {
        authControlChannelRef.current = new BroadcastChannel('auth-control');
        authControlChannelRef.current.onmessage = (ev) => {
          const msg = ev.data || {};
          if (msg.t === 'logout') {
            if (receivedExternalLogoutRef.current) return;
            receivedExternalLogoutRef.current = true;
            try {
              tokenManager.clearTokens();
              setAccessToken(null);
              setUser(null);
              queryClient.clear();
            } catch {}
            // Navigate away promptly to stop any polling
            try { window.location.assign('/login'); } catch {}
          }
        };
      } catch {}
    }

    // localStorage fallback for browsers without BroadcastChannel (fires only in other tabs)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'auth-logout' && e.newValue) {
        if (receivedExternalLogoutRef.current) return;
        receivedExternalLogoutRef.current = true;
        try {
          tokenManager.clearTokens();
          setAccessToken(null);
          setUser(null);
          queryClient.clear();
        } catch {}
        try { window.location.assign('/login'); } catch {}
      }
    };
    window.addEventListener('storage', onStorage);

    const initAuth = async () => {
      try {
        console.log('[AuthContext] Initializing authentication...');
        
        // Use TokenManager to check authentication
        if (!tokenManager.isAuthenticated()) {
          console.log('[AuthContext] No valid token found');
          setIsLoading(false);
          return;
        }

        // Get valid token (automatically refreshes if needed)
        try {
          const validToken = await tokenManager.getValidAccessToken();
          setAccessToken(validToken);
          
          const authenticatedBackend = getAuthenticatedBackend();
          if (!authenticatedBackend) {
            console.error('[AuthContext] Failed to create authenticated backend client');
            tokenManager.clearTokens();
            setIsLoading(false);
            return;
          }
          
          const meResponse = await authenticatedBackend.auth.me();
          setUser(meResponse.user);
          console.log('[AuthContext] Auth initialized with user:', meResponse.user);
        } catch (error) {
          console.error('[AuthContext] Auth initialization failed:', error);
          tokenManager.clearTokens();
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        clearCorruptedTokens();
      } finally {
        console.log('Auth initialization completed - setting isInitializing to false');
        setIsLoading(false);
        setIsInitializing(false);
      }
    };

    initAuth();
    return () => {
      try { refreshChannelRef.current?.close(); } catch {}
      try { authControlChannelRef.current?.close(); } catch {}
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Add global debug function for development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      (window as any).clearAuthTokens = () => {
        console.log('Clearing auth tokens via debug function...');
        clearCorruptedTokens();
        window.location.href = '/login';
      };
      
      (window as any).clearAllAuthData = () => {
        console.log('Clearing all auth data via debug function...');
        clearAllAuthData();
      };

      (window as any).checkTokenStatus = () => {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          console.log('No access token found');
          return;
        }
        
        try {
          const tokenParts = token.split('.');
          if (tokenParts.length !== 3) {
            console.log('Token format invalid');
            return;
          }
          
          const payload = JSON.parse(atob(tokenParts[1]));
          const currentTime = Math.floor(Date.now() / 1000);
          const isExpired = payload.exp && payload.exp < currentTime;
          
          console.log('Token status:', {
            token: token.substring(0, 20) + '...',
            expiresAt: new Date(payload.exp * 1000).toISOString(),
            isExpired,
            timeUntilExpiry: payload.exp ? payload.exp - currentTime : 'unknown'
          });
        } catch (error) {
          console.log('Failed to decode token:', error);
        }
      };

      (window as any).testAuthMe = async () => {
        try {
          const backend = getAuthenticatedBackend();
          const response = await backend.auth.me();
          console.log('Auth me test successful:', response);
        } catch (error) {
          console.error('Auth me test failed:', error);
        }
      };

      (window as any).debugTokenCorruption = () => {
        console.log('=== TOKEN CORRUPTION DEBUG ===');
        
        const accessToken = localStorage.getItem('accessToken');
        const refreshToken = localStorage.getItem('refreshToken');
        
        if (accessToken) {
          console.log('Access Token Analysis:');
          console.log('- Length:', accessToken.length);
          console.log('- Has spaces:', accessToken.includes(' '));
          console.log('- Has newlines:', accessToken.includes('\n'));
          console.log('- Has tabs:', accessToken.includes('\t'));
          console.log('- JWT parts:', accessToken.split('.').length);
          console.log('- First 50 chars:', accessToken.substring(0, 50));
          console.log('- Last 50 chars:', accessToken.substring(accessToken.length - 50));
          
          // Check for duplication patterns
          if (accessToken.length > 400) {
            console.log('- SUSPICIOUS: Token length > 400 chars');
            const parts = accessToken.split('.');
            if (parts.length > 3) {
              console.log('- SUSPICIOUS: More than 3 JWT parts detected');
              console.log('- Parts count:', parts.length);
            }
          }
        } else {
          console.log('No access token found');
        }
        
        if (refreshToken) {
          console.log('Refresh Token Analysis:');
          console.log('- Length:', refreshToken.length);
          console.log('- Has spaces:', refreshToken.includes(' '));
          console.log('- JWT parts:', refreshToken.split('.').length);
        } else {
          console.log('No refresh token found');
        }
        
        console.log('=== END DEBUG ===');
      };
    }
  }, []);

  // When user becomes available (login/refresh), invalidate key queries to ensure fresh data.
  useEffect(() => {
    if (user) {
      console.log('User available, invalidating queries for fresh data...');
      
      // Only reset logout progress state if we're actually logging in (not just testing)
      if (showLogoutProgress && isLoggingIn && !isTestingLogoutDialog) {
        console.log('Resetting logout progress state after user login');
        setShowLogoutProgress(false);
        setIsLoggingOut(false);
      }
      
      // Use a small delay to ensure the auth context is fully updated
      setTimeout(() => {
        // Check if property update is in progress before invalidating
        if (!(window as any).__propertyUpdateInProgress) {
          queryClient.invalidateQueries({ queryKey: ['properties'] });
        } else {
          console.log('Skipping properties invalidation - update in progress');
        }
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['users'] });
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
        queryClient.invalidateQueries({ queryKey: ['revenues'] });
        queryClient.invalidateQueries({ queryKey: ['profit-loss'] });
        queryClient.invalidateQueries({ queryKey: ['staff'] });
        queryClient.invalidateQueries({ queryKey: ['schedules'] });
        queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
        queryClient.invalidateQueries({ queryKey: ['analytics', 'overview'] });
      }, 100);
    }
  }, [user, queryClient, showLogoutProgress]);

  // Listen for automatic token refresh events
  useEffect(() => {
    const handleTokenRefresh = (event: CustomEvent) => {
      console.log('Token automatically refreshed, updating auth state');
      setAccessToken(event.detail.accessToken);
    };

    const handleTokenRefreshRequired = async (event: CustomEvent) => {
      console.log('Token refresh required, attempting refresh...');
      console.log('Refresh event detail:', event.detail);
      
      try {
        const newToken = await refreshAccessToken();
        console.log('Token refreshed successfully, retrying original request...');
        
        // If this was triggered by a specific request, retry it
        if (event.detail.url && event.detail.init) {
          const retryResponse = await fetch(event.detail.url, {
            ...event.detail.init,
            headers: {
              ...event.detail.init?.headers,
              'Authorization': `Bearer ${newToken}`,
            },
          });
          
          if (retryResponse.status === 401) {
            console.error('Still getting 401 after token refresh, clearing tokens...');
            clearCorruptedTokens();
            window.location.href = '/login';
          } else {
            console.log('Request retry successful after token refresh');
          }
        } else {
          // If this was triggered by token expiry detection, just clear the cache
          console.log('Token refresh completed, clearing backend cache...');
          // Clear the cached backend instance to force recreation with new token
          if (typeof window !== 'undefined') {
            // Dispatch event to clear backend cache
            const clearCacheEvent = new CustomEvent('clearBackendCache');
            window.dispatchEvent(clearCacheEvent);
          }
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        // Don't show logout modal for automatic token refresh failures
        clearCorruptedTokens();
        window.location.href = '/login';
      }
    };

    window.addEventListener('tokenRefreshed', handleTokenRefresh as EventListener);
    window.addEventListener('tokenRefreshRequired', handleTokenRefreshRequired as unknown as EventListener);
    
    return () => {
      window.removeEventListener('tokenRefreshed', handleTokenRefresh as EventListener);
      window.removeEventListener('tokenRefreshRequired', handleTokenRefreshRequired as unknown as EventListener);
    };
  }, []);

  const signup = async (data: any) => {
    try {
      console.log('Starting signup process...');
      const response = await backend.auth.signup(data);
      
      console.log('Signup successful:', response);
      // Note: After signup, user typically needs to login
      // We don't automatically log them in
    } catch (error) {
      console.error('Signup failed:', error);
      throw error;
    }
  };

  // Track general user activity
  const trackActivity = async () => {
    if (user) {
      await trackUserActivity(parseInt(user.userID), 'activity');
    }
  };

  // Refresh current user data from backend
  const refreshUser = async () => {
    try {
      console.log('🔄 Refreshing user data...');
      const authenticatedBackend = getAuthenticatedBackend();
      if (!authenticatedBackend) {
        console.error('No authenticated backend available for user refresh');
        return;
      }
      
      console.log('📡 Calling /auth/me endpoint...');
      const meResponse = await authenticatedBackend.auth.me();
      console.log('📥 Received fresh user data:', meResponse.user);
      setUser(meResponse.user);
      console.log('✅ User data refreshed successfully in AuthContext');
    } catch (error) {
      console.error('❌ Failed to refresh user data:', error);
      // Don't throw error as this is not critical for the main functionality
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      signup,
      logout,
      isLoading,
      getAuthenticatedBackend,
      trackActivity,
      refreshUser,
      showLogoutProgress,
      setShowLogoutProgress,
    setIsTestingLogoutDialog,
      clearCorruptedTokens,
      clearAllAuthData,
      authError,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
