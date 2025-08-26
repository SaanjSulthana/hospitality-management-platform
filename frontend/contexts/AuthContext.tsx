import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import backend from '~backend/client';
import type { AuthData } from '~backend/auth/types';
import { useQueryClient } from '@tanstack/react-query';

interface AuthContextType {
  user: AuthData | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  getAuthenticatedBackend: () => typeof backend;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Always read the latest token from localStorage when creating the backend client.
  // This prevents stale tokens being used across re-renders or after navigating.
  const getAuthenticatedBackend = () => {
    return backend.with({
      auth: async () => {
        const token = localStorage.getItem('accessToken');
        if (!token) return null;
        return { authorization: `Bearer ${token}` };
      },
    });
  };

  const login = async (email: string, password: string) => {
    try {
      console.log('Starting login process...');
      const response = await backend.auth.login({ email, password });
      
      // Clear any previous cached data to avoid stale views after user switch
      console.log('Clearing query cache after login...');
      queryClient.clear();

      // Store tokens
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('refreshToken', response.refreshToken);
      setAccessToken(response.accessToken);

      // Get user data using the latest token from localStorage
      const authenticatedBackend = getAuthenticatedBackend();
      const meResponse = await authenticatedBackend.auth.me();
      setUser(meResponse.user);
      
      console.log('Login successful, user set:', meResponse.user);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          await backend.auth.logout({ refreshToken });
        } catch (error) {
          console.error('Logout API call failed:', error);
          // Continue with local logout even if API call fails
        }
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local storage and state
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setAccessToken(null);
      setUser(null);
      // Clear all cached queries so the next user/session gets fresh data
      console.log('Clearing query cache after logout...');
      queryClient.clear();
    }
  };

  const refreshAccessToken = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      const response = await backend.auth.refresh({ refreshToken });
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('refreshToken', response.refreshToken);
      setAccessToken(response.accessToken);

      return response.accessToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      await logout();
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

        setAccessToken(storedAccessToken);

        // Try to get user data with stored token
        try {
          const authenticatedBackend = getAuthenticatedBackend();
          const meResponse = await authenticatedBackend.auth.me();
          setUser(meResponse.user);
          console.log('Auth initialized with existing token, user:', meResponse.user);
        } catch (error) {
          // Token might be expired, try to refresh
          try {
            await refreshAccessToken();
            const authenticatedBackend = getAuthenticatedBackend();
            const meResponse = await authenticatedBackend.auth.me();
            setUser(meResponse.user);
            console.log('Auth initialized after token refresh, user:', meResponse.user);
          } catch (refreshError) {
            console.error('Auth initialization failed:', refreshError);
            await logout();
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // When user becomes available (login/refresh), invalidate key queries to ensure fresh data.
  useEffect(() => {
    if (user) {
      console.log('User available, invalidating queries for fresh data...');
      // Use a small delay to ensure the auth context is fully updated
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['properties'] });
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
  }, [user, queryClient]);

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isLoading,
      getAuthenticatedBackend,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
