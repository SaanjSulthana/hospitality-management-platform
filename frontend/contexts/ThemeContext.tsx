import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface Theme {
  brandName: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  currency: string;
  dateFormat: string;
  timeFormat: string;
}

interface ThemeContextType {
  theme: Theme;
  updateTheme: (updates: Partial<Theme>) => Promise<void>;
  isLoading: boolean;
}

const defaultTheme: Theme = {
  brandName: 'Hospitality Platform',
  primaryColor: '#3b82f6',
  secondaryColor: '#64748b',
  accentColor: '#10b981',
  backgroundColor: '#ffffff',
  textColor: '#1f2937',
  currency: 'USD',
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12h',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  const [isLoading, setIsLoading] = useState(false);
  const { user, getAuthenticatedBackend } = useAuth();

  const updateTheme = async (updates: Partial<Theme>) => {
    try {
      setIsLoading(true);
      const authenticatedBackend = getAuthenticatedBackend();
      await authenticatedBackend.branding.updateTheme(updates);
      setTheme(prev => ({ ...prev, ...updates }));
    } catch (error) {
      console.error('Failed to update theme:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadTheme = async () => {
      if (!user) {
        setTheme(defaultTheme);
        return;
      }

      try {
        setIsLoading(true);
        const authenticatedBackend = getAuthenticatedBackend();
        const response = await authenticatedBackend.branding.getTheme();
        setTheme(response.theme);
      } catch (error) {
        console.error('Failed to load theme:', error);
        setTheme(defaultTheme);
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
  }, [user]);

  // Apply theme to CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', theme.primaryColor);
    root.style.setProperty('--secondary-color', theme.secondaryColor);
    root.style.setProperty('--accent-color', theme.accentColor);
    root.style.setProperty('--background-color', theme.backgroundColor);
    root.style.setProperty('--text-color', theme.textColor);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{
      theme,
      updateTheme,
      isLoading,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}
