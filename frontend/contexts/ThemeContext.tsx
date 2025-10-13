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
  timezone: string;
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
  currency: 'INR',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
  timezone: 'Asia/Kolkata',
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
      console.log('Updating theme with:', updates);
      
      const authenticatedBackend = getAuthenticatedBackend();
      const response = await authenticatedBackend.branding.updateTheme(updates);
      
      console.log('Theme update response:', response);
      
      // Immediately update local state with the new theme data
      setTheme(prev => {
        const newTheme = { ...prev, ...updates };
        console.log('Updated local theme state:', newTheme);
        return newTheme;
      });
      
      // Force a re-render by dispatching a custom event
      window.dispatchEvent(new CustomEvent('themeUpdated', { detail: updates }));
      
      // Force a reload of the theme to ensure consistency
      setTimeout(async () => {
        try {
          console.log('Reloading theme after update...');
          const reloadResponse = await authenticatedBackend.branding.getTheme();
          console.log('Theme reloaded:', reloadResponse.theme);
          
          // Update with the complete theme from backend
          setTheme(reloadResponse.theme);
          
          // Force another re-render
          window.dispatchEvent(new CustomEvent('themeReloaded', { detail: reloadResponse.theme }));
          
        } catch (reloadError) {
          console.warn('Failed to reload theme after update:', reloadError);
        }
      }, 1000);
      
    } catch (error: any) {
      console.error('Failed to update theme:', error);
      
      // Check if it's an authentication error
      if (error.status === 401 || error.message?.includes('Invalid token') || error.message?.includes('Unauthorized') || error.message?.includes('Authentication required')) {
        console.error('Authentication error during theme update:', error);
        
        // Try to refresh the token and retry once
        try {
          console.log('Attempting to refresh token and retry theme update...');
          
          // Wait a moment for token refresh to complete
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const authenticatedBackend = getAuthenticatedBackend();
          if (!authenticatedBackend) {
            throw new Error('No authenticated backend available');
          }
          
          const response = await authenticatedBackend.branding.updateTheme(updates);
          
          console.log('Theme update successful after retry:', response);
          
          // Update local state
          setTheme(prev => ({ ...prev, ...updates }));
          
          // Force a re-render
          window.dispatchEvent(new CustomEvent('themeUpdated', { detail: updates }));
          
          return; // Success, exit early
        } catch (retryError: any) {
          console.error('Theme update retry failed:', retryError);
          
          // Show a more specific error message for auth issues
          const errorMessage = 'Your session has expired. Please log in again to save your settings.';
          
          // Log additional error details for debugging
          console.error('Theme update authentication error details:', {
            message: retryError.message,
            status: retryError.status,
            statusText: retryError.statusText,
            response: retryError.response,
            stack: retryError.stack
          });
          
          throw new Error(errorMessage);
        }
      }
      
      // Provide more specific error messages for other issues
      let errorMessage = 'Failed to update theme settings';
      
      if (error.message) {
        if (error.message.includes('Organization not found')) {
          errorMessage = 'Organization not found. Please contact support.';
        } else if (error.message.includes('Invalid theme data')) {
          errorMessage = 'Invalid theme data provided. Please check your settings.';
        } else if (error.message.includes('Failed to update theme configuration')) {
          errorMessage = 'Server error while updating theme. Please try again.';
        } else if (error.message.includes('An internal error occurred')) {
          errorMessage = 'Server error occurred. Please try again later.';
        } else {
          errorMessage = error.message;
        }
      }
      
      // Log additional error details for debugging
      console.error('Theme update error details:', {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        response: error.response,
        stack: error.stack
      });
      
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadTheme = async () => {
      if (!user) {
        console.log('No user, using default theme');
        setTheme(defaultTheme);
        return;
      }

      try {
        setIsLoading(true);
        console.log('Loading theme for user:', user.email, 'org:', user.orgId);
        
        // Only try to get authenticated backend if user exists
        const authenticatedBackend = getAuthenticatedBackend();
        if (!authenticatedBackend) {
          console.warn('No authenticated backend available, using default theme');
          setTheme(defaultTheme);
          return;
        }
        
        const response = await authenticatedBackend.branding.getTheme();
        
        console.log('Theme loaded successfully:', response.theme);
        
        // Validate the theme data
        if (response.theme && typeof response.theme === 'object') {
          const validTheme = {
            brandName: response.theme.brandName || defaultTheme.brandName,
            logoUrl: response.theme.logoUrl,
            primaryColor: response.theme.primaryColor || defaultTheme.primaryColor,
            secondaryColor: response.theme.secondaryColor || defaultTheme.secondaryColor,
            accentColor: response.theme.accentColor || defaultTheme.accentColor,
            backgroundColor: response.theme.backgroundColor || defaultTheme.backgroundColor,
            textColor: response.theme.textColor || defaultTheme.textColor,
            currency: response.theme.currency || defaultTheme.currency,
            dateFormat: response.theme.dateFormat || defaultTheme.dateFormat,
            timeFormat: response.theme.timeFormat || defaultTheme.timeFormat,
            timezone: response.theme.timezone || defaultTheme.timezone,
          };
          
          console.log('Setting validated theme:', validTheme);
          setTheme(validTheme);
        } else {
          console.warn('Invalid theme response, using default');
          setTheme(defaultTheme);
        }
      } catch (error: any) {
        console.error('Failed to load theme:', error);
        
        // Check if this is an authentication error
        if (error.message && error.message.includes('Authentication required')) {
          console.log('Theme load failed due to authentication, using default theme');
          setTheme(defaultTheme);
          return;
        }
        
        // Provide more specific error messages for other errors
        let errorMessage = 'Failed to load theme settings';
        
        if (error.message) {
          if (error.message.includes('Organization not found')) {
            errorMessage = 'Organization not found. Please contact support.';
          } else if (error.message.includes('Too many properties to enumerate')) {
            errorMessage = 'Theme data is corrupted. Using default theme.';
          } else if (error.message.includes('An internal error occurred')) {
            errorMessage = 'Server error while loading theme. Using default theme.';
          } else {
            errorMessage = error.message;
          }
        }
        
        // Log additional error details for debugging
        console.error('Theme load error details:', {
          message: error.message,
          status: error.status,
          statusText: error.statusText,
          response: error.response,
          stack: error.stack
        });
        
        // Set a safe default theme instead of throwing
        const safeDefaultTheme: Theme = {
          brandName: "Hospitality Platform",
          primaryColor: "#3b82f6",
          secondaryColor: "#64748b",
          accentColor: "#10b981",
          backgroundColor: "#ffffff",
          textColor: "#1f2937",
          currency: "USD",
          dateFormat: "MM/DD/YYYY",
          timeFormat: "12h",
          timezone: "Asia/Kolkata",
        };
        
        console.log('Using safe default theme due to error');
        setTheme(safeDefaultTheme);
        
        // Show a toast notification about the fallback
        if (error.message && !error.message.includes('Organization not found')) {
          // Only show toast for non-critical errors
          console.warn('Theme load failed, using default theme');
        }
      } finally {
        setIsLoading(false);
      }
    };

    // Only load theme if user is authenticated
    if (user && user.userID && user.userID !== '0') {
      // Check if we have a valid token before trying to load theme
      const token = localStorage.getItem('accessToken');
      if (!token) {
        console.log('No access token found, using default theme');
        setTheme(defaultTheme);
        return;
      }
      
      console.log('User authenticated, loading theme for:', user.email);
      loadTheme();
    } else {
      // Set default theme for unauthenticated users
      console.log('User not fully authenticated, using default theme');
      setTheme(defaultTheme);
    }
  }, [user, getAuthenticatedBackend]);

  // Apply theme to CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    console.log('Applying theme to CSS custom properties:', {
      primaryColor: theme.primaryColor,
      secondaryColor: theme.secondaryColor,
      accentColor: theme.accentColor,
      backgroundColor: theme.backgroundColor,
      textColor: theme.textColor
    });
    
    root.style.setProperty('--primary-color', theme.primaryColor);
    root.style.setProperty('--secondary-color', theme.secondaryColor);
    root.style.setProperty('--accent-color', theme.accentColor);
    root.style.setProperty('--background-color', theme.backgroundColor);
    root.style.setProperty('--text-color', theme.textColor);
    
    // Force a re-render by dispatching a custom event
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: theme }));
    
    console.log('Theme applied successfully to CSS custom properties');
  }, [theme]);

  // Cleanup effect when user logs out
  useEffect(() => {
    if (!user) {
      console.log('User logged out, resetting theme to default');
      setTheme(defaultTheme);
    }
  }, [user]);

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
