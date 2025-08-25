import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import backend from '~backend/client';
import type { AuthData } from '~backend/auth/types';

interface AuthContextType {
  user: AuthData | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
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

  const getAuthenticatedBackend = () => {
    if (accessToken) {
      return backend.with({
        auth: () => Promise.resolve({ authorization: `Bearer ${accessToken}` })
      });
    }
    return backend;
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await backend.auth.login({ email, password });
      
      // Store tokens
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('refreshToken', response.refreshToken);
      setAccessToken(response.accessToken);

      // Get user data
      const authenticatedBackend = backend.with({
        auth: () => Promise.resolve({ authorization: `Bearer ${response.accessToken}` })
      });
      const meResponse = await authenticatedBackend.auth.me();
      setUser(meResponse.user);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await backend.auth.logout({ refreshToken });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setAccessToken(null);
      setUser(null);
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
      logout();
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
          const authenticatedBackend = backend.with({
            auth: () => Promise.resolve({ authorization: `Bearer ${storedAccessToken}` })
          });
          const meResponse = await authenticatedBackend.auth.me();
          setUser(meResponse.user);
        } catch (error) {
          // Token might be expired, try to refresh
          try {
            const newAccessToken = await refreshAccessToken();
            const authenticatedBackend = backend.with({
              auth: () => Promise.resolve({ authorization: `Bearer ${newAccessToken}` })
            });
            const meResponse = await authenticatedBackend.auth.me();
            setUser(meResponse.user);
          } catch (refreshError) {
            console.error('Auth initialization failed:', refreshError);
            logout();
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
