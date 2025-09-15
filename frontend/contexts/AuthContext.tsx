import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { backend, getAuthenticatedBackend } from '../services/backend';
import type { AuthData } from '~backend/auth/types';
import { useQueryClient } from '@tanstack/react-query';
import { getUserLocation, getUserIP, getUserAgent, getUserLocale } from '../utils/geolocation';

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
      console.log('Login started - setting isLoggingIn to true');
      setIsLoggingIn(true);
      
      // Reset logout progress state immediately to prevent popup after login
      setShowLogoutProgress(false);
      setIsLoggingOut(false);
      const response = await backend.auth.login({ email, password });
      
      // Clean tokens before storing (remove ALL whitespace, newlines, tabs, and any other whitespace characters)
      const cleanAccessToken = response.accessToken.trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '');
      const cleanRefreshToken = response.refreshToken.trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '');
      
      // Validate cleaned tokens
      if (cleanAccessToken !== response.accessToken || cleanRefreshToken !== response.refreshToken) {
        console.warn('Tokens contained whitespace characters, cleaned before storing');
        console.log('Original access token length:', response.accessToken.length);
        console.log('Cleaned access token length:', cleanAccessToken.length);
        console.log('Original refresh token length:', response.refreshToken.length);
        console.log('Cleaned refresh token length:', cleanRefreshToken.length);
      }
      
      // Safely store tokens to prevent corruption
      if (!safelyStoreTokens(cleanAccessToken, cleanRefreshToken)) {
        throw new Error('Failed to store tokens safely');
      }
      
      // Set the token in state FIRST
      setAccessToken(cleanAccessToken);
      setUser({
        ...response.user,
        userID: response.user.id.toString()
      });
      
      // Clear any previous cached data to avoid stale views after user switch
      console.log('Clearing query cache after login...');
      queryClient.clear();

      // IMPORTANT: Wait a moment to ensure token is stored, then create authenticated backend
      await new Promise(resolve => setTimeout(resolve, 200));

      const authenticatedBackend = getAuthenticatedBackend();
      if (!authenticatedBackend) {
        console.error('Failed to create authenticated backend client');
        throw new Error('Failed to create authenticated backend client');
      }
      
      console.log('Calling /auth/me with authenticated backend...');
      const meResponse = await authenticatedBackend.auth.me();
      setUser(meResponse.user);
      
      // Track login activity with geolocation (non-blocking)
      trackUserActivity(parseInt(meResponse.user.userID), 'login').catch(error => {
        console.warn('Login activity tracking failed (non-critical):', error);
      });
      
      console.log('Login successful, user set:', meResponse.user);
    } catch (error) {
      console.error('Login failed:', error);
      
      // Clear any stored tokens on login failure
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setAccessToken(null);
      setUser(null);
      
      throw error;
    } finally {
      console.log('Login completed - setting isLoggingIn to false');
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
      console.log('Finally block - clearing state, shouldShowProgress:', shouldShowProgress);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setAccessToken(null);
      setUser(null);
      // Clear all cached queries so the next user/session gets fresh data
      console.log('Clearing query cache after logout...');
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
    // If there's already a refresh in progress, return that promise
    if (refreshPromiseRef.current) {
      console.log('Token refresh already in progress, returning existing promise');
      return refreshPromiseRef.current;
    }

    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      // Create the refresh promise and store it
      const refreshPromise = (async () => {
        try {
          const response = await backend.auth.refresh({ refreshToken });
          
          // Clean tokens before storing (remove ALL whitespace, newlines, tabs, and any other whitespace characters)
          const cleanAccessToken = response.accessToken.trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '');
          const cleanRefreshToken = response.refreshToken.trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '');
          
          // Validate cleaned tokens
          if (cleanAccessToken !== response.accessToken || cleanRefreshToken !== response.refreshToken) {
            console.warn('Tokens contained whitespace characters, cleaned before storing');
          }
          
          // Store refreshed tokens safely to prevent corruption
          if (!safelyStoreTokens(cleanAccessToken, cleanRefreshToken)) {
            throw new Error('Failed to store refreshed tokens safely');
          }
          
          setAccessToken(cleanAccessToken);

          return cleanAccessToken;
        } catch (error) {
          console.error('Token refresh failed:', error);
          // Don't show logout modal for automatic token refresh failures
          // Just clear tokens silently and redirect to login
          clearCorruptedTokens();
          window.location.href = '/login';
          throw error;
        }
      })();

      // Store the promise reference
      refreshPromiseRef.current = refreshPromise;

      // Wait for the refresh to complete
      const result = await refreshPromise;
      
      // Clear the promise reference
      refreshPromiseRef.current = null;
      
      return result;
    } catch (error) {
      // Clear the promise reference on error
      refreshPromiseRef.current = null;
      throw error;
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedAccessToken = localStorage.getItem('accessToken');
        if (!storedAccessToken) {
          setIsLoading(false);
          return;
        }

        // Validate stored token format
        if (typeof storedAccessToken !== 'string' || storedAccessToken.trim() === '') {
          console.error('Invalid stored token format, clearing...');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setIsLoading(false);
          return;
        }

        // Check if token looks like a valid JWT
        const tokenParts = storedAccessToken.split('.');
        if (tokenParts.length !== 3) {
          console.error('Stored token does not appear to be a valid JWT, clearing...');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setIsLoading(false);
          return;
        }

        // Check for suspicious token length (tokens should be 200-300 chars, not 500+)
        if (storedAccessToken.length > 400) {
          console.error(`SUSPICIOUS: Stored token length ${storedAccessToken.length} chars indicates corruption, clearing...`);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setIsLoading(false);
          return;
        }

        // Check if token is expired by decoding the payload
        try {
          const payload = JSON.parse(atob(tokenParts[1]));
          const currentTime = Math.floor(Date.now() / 1000);
          if (payload.exp && payload.exp < currentTime) {
            console.log('Stored token is expired, attempting refresh...');
            // Token is expired, try to refresh it
            try {
              await refreshAccessToken();
              const authenticatedBackend = getAuthenticatedBackend();
              if (!authenticatedBackend) {
                console.error('Failed to create authenticated backend client after token refresh');
                clearCorruptedTokens();
                setIsLoading(false);
                return;
              }
              
              const meResponse = await authenticatedBackend.auth.me();
              setUser(meResponse.user);
              console.log('Auth initialized after token refresh, user:', meResponse.user);
            } catch (refreshError) {
              console.error('Token refresh failed during init:', refreshError);
              clearCorruptedTokens();
            }
            setIsLoading(false);
            return;
          }
        } catch (decodeError) {
          console.error('Failed to decode token payload:', decodeError);
          clearCorruptedTokens();
          setIsLoading(false);
          return;
        }

        setAccessToken(storedAccessToken);

        // Try to get user data with stored token
        try {
          const authenticatedBackend = getAuthenticatedBackend();
          const meResponse = await authenticatedBackend.auth.me();
          setUser(meResponse.user);
          console.log('Auth initialized with existing token, user:', meResponse.user);
        } catch (error) {
          // If the first attempt failed, don't try to refresh again
          // The token refresh was already attempted above if the token was expired
          console.error('Auth initialization failed:', error);
          clearCorruptedTokens();
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
    }}>
      {children}
    </AuthContext.Provider>
  );
}
