import Client, { Local, Environment } from '../client';
import { isDevelopment } from '../src/utils/env';

// Test if the import is working
console.log('=== BACKEND IMPORT TEST ===');
console.log('Client class:', Client);
console.log('Local constant:', Local);
console.log('Environment function:', Environment);
console.log('Client type:', typeof Client);
console.log('Local type:', typeof Local);

// Determine the correct API URL based on environment
function getApiUrl(): string {
  if (isDevelopment()) {
    return Local; // Use localhost for development
  }
  
  // For production/staging, use the correct API URL from Encore Cloud
  // The staging API is at https://api.curat.ai according to the dashboard
  return 'https://api.curat.ai';
}

const apiUrl = getApiUrl();
console.log('Using API URL:', apiUrl);

// Create a client instance with the correct URL
const clientInstance = new Client(apiUrl);

console.log('Client instance created:', clientInstance);
console.log('Client instance type:', typeof clientInstance);
console.log('=== END IMPORT TEST ===');

// Use the pre-instantiated client instance
export const backend = clientInstance;

// Export the client instance for components that need to create their own instances
export { clientInstance as Client };

// Cache for authenticated backend instances to prevent multiple instances
let cachedAuthenticatedBackend: any = null;
let lastTokenCheck = 0;
const TOKEN_CACHE_DURATION = 1000; // 1 second

// Function to clear the backend cache
export function clearBackendCache() {
  console.log('Clearing backend cache...');
  cachedAuthenticatedBackend = null;
  lastTokenCheck = 0;
}

// Listen for cache clearing events
if (typeof window !== 'undefined') {
  window.addEventListener('clearBackendCache', () => {
    clearBackendCache();
  });
}

// Function to check if token is expired
function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    const payload = JSON.parse(atob(parts[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Add 30 second buffer to prevent edge cases
    return payload.exp && payload.exp < (currentTime + 30);
  } catch (error) {
    console.error('Failed to decode token for expiry check:', error);
    return true;
  }
}

// Function to get authenticated backend with caching and automatic token refresh
export function getAuthenticatedBackend() {
  const now = Date.now();
  const currentToken = localStorage.getItem('accessToken');

  console.log('=== GET AUTHENTICATED BACKEND DEBUG ===');
  console.log('Current time:', now);
  console.log('Last token check:', lastTokenCheck);
  console.log('Token cache duration:', TOKEN_CACHE_DURATION);
  console.log('Current token from localStorage:', currentToken ? `${currentToken.substring(0, 20)}...` : 'null');
  console.log('Cached backend exists:', !!cachedAuthenticatedBackend);
  
  // Debug token details
  if (currentToken) {
    console.log('Token length:', currentToken.length);
    console.log('Token contains whitespace:', /\s/.test(currentToken));
    console.log('Token contains newlines:', /\n/.test(currentToken));
    console.log('Token contains tabs:', /\t/.test(currentToken));
    
    // Check if token is expired
    const isExpired = isTokenExpired(currentToken);
    console.log('Token is expired:', isExpired);
    
    if (isExpired) {
      console.log('Token is expired, triggering refresh...');
      // Dispatch event to trigger token refresh
      const refreshEvent = new CustomEvent('tokenRefreshRequired', { 
        detail: { reason: 'token_expired', token: currentToken } 
      });
      window.dispatchEvent(refreshEvent);
      return null;
    }
  }
  
  // Check if we need to refresh the cached instance
  if (!cachedAuthenticatedBackend ||
      now - lastTokenCheck > TOKEN_CACHE_DURATION ||
      !currentToken) {

    console.log('Creating new authenticated backend instance...');

    const cleanToken = validateAndCleanToken(currentToken);
    if (!cleanToken) {
      console.error('Invalid token, cannot create authenticated backend');
      return null;
    }

    // Double-check token expiry after cleaning
    if (isTokenExpired(cleanToken)) {
      console.log('Cleaned token is also expired, triggering refresh...');
      const refreshEvent = new CustomEvent('tokenRefreshRequired', { 
        detail: { reason: 'cleaned_token_expired', token: cleanToken } 
      });
      window.dispatchEvent(refreshEvent);
      return null;
    }

    console.log('Token validated and cleaned successfully');
    console.log('Clean token length:', cleanToken.length);
    console.log('Clean token start:', cleanToken.substring(0, 20));
    console.log('Clean token end:', cleanToken.substring(cleanToken.length - 20));
    
    // Create new instance with current token
    const authConfig = {
      auth: async () => ({
        authorization: `Bearer ${cleanToken}`
      })
    };
    
    console.log('Creating backend with auth config:', authConfig);
    console.log('Auth config details:', {
      hasAuth: !!authConfig.auth,
      authType: typeof authConfig.auth,
      tokenLength: cleanToken.length
    });
    
    // Test the client instance
    console.log('Client instance type:', typeof clientInstance);
    console.log('Client instance has with method:', typeof clientInstance.with === 'function');
    
    cachedAuthenticatedBackend = clientInstance.with(authConfig);
    
    console.log('Authenticated backend created successfully');
    console.log('Created backend type:', typeof cachedAuthenticatedBackend);
    console.log('Created backend has auth method:', typeof cachedAuthenticatedBackend?.auth === 'object');
    console.log('Created backend has branding method:', typeof cachedAuthenticatedBackend?.branding === 'object');
    
    lastTokenCheck = now;
  } else {
    console.log('Using cached authenticated backend instance');
  }
  
  console.log('=== END DEBUG ===');
  return cachedAuthenticatedBackend;
}

// Helper function to validate and clean tokens
function validateAndCleanToken(token: string | null): string | null {
  if (!token || typeof token !== 'string') {
    return null;
  }
  
  // Clean the token by removing any whitespace, newlines, or tabs
  const cleanToken = token.trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '');
  
  // Validate JWT format (3 parts separated by dots)
  const tokenParts = cleanToken.split('.');
  if (tokenParts.length !== 3) {
    console.error('Invalid JWT format, token has', tokenParts.length, 'parts');
    return null;
  }
  
  // Check for suspicious token length (tokens should be 200-300 chars, not 500+)
  if (cleanToken.length < 100 || cleanToken.length > 400) {
    console.error('Suspicious token length:', cleanToken.length);
    return null;
  }
  
  // Update localStorage with the cleaned token if it changed
  if (cleanToken !== token) {
    console.warn('Token contained whitespace characters, cleaned before using');
    localStorage.setItem('accessToken', cleanToken);
  }
  
  return cleanToken;
}

// Note: refreshAccessToken function has been moved to AuthContext.tsx to prevent conflicts
// This function is now handled centrally with proper debouncing

// Custom fetcher that handles automatic token refresh
const fetcherWithTokenRefresh = async (url: string, init: RequestInit) => {
  const response = await fetch(url, init);
  
  // If we get a 401 and it's not a refresh request, dispatch an event for token refresh
  if (response.status === 401 && !url.includes('/auth/refresh')) {
    console.log('Received 401 response, dispatching token refresh event...');
    console.log('Request URL:', url);
    console.log('Request method:', init.method);
    
    // Check if this is likely a token expiry issue
    const responseText = await response.clone().text();
    console.log('401 Response body:', responseText);
    
    // Dispatch a custom event to trigger token refresh in AuthContext
    const refreshEvent = new CustomEvent('tokenRefreshRequired', { 
      detail: { 
        url, 
        init, 
        originalResponse: response,
        responseText,
        timestamp: Date.now()
      } 
    });
    window.dispatchEvent(refreshEvent);
    
    // Return the original response - AuthContext will handle the retry
    return response;
  }
  
  return response;
};

// Clean existing tokens when module loads
const cleanExistingTokens = () => {
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');

  if (accessToken) {
    const cleanAccessToken = accessToken.trim().replace(/\s/g, '');
    if (cleanAccessToken !== accessToken) {
      console.warn('Access token contained whitespace characters, cleaning...');
      localStorage.setItem('accessToken', cleanAccessToken);
    }
  }

  if (refreshToken) {
    const cleanRefreshToken = refreshToken.trim().replace(/\s/g, '');
    if (cleanRefreshToken !== refreshToken) {
      console.warn('Refresh token contained whitespace characters, cleaning...');
      localStorage.setItem('refreshToken', cleanRefreshToken);
    }
  }
};

// Add global debug function for development
if (isDevelopment()) {
  (window as any).testBackend = () => {
    console.log('=== TESTING BACKEND ===');
    console.log('Client instance:', clientInstance);
    console.log('Client type:', typeof clientInstance);
    console.log('Client has with method:', typeof clientInstance.with === 'function');
    
    const token = localStorage.getItem('accessToken');
    console.log('Current token:', token);
    
    if (token) {
      const authConfig = {
        auth: {
          authorization: `Bearer ${token}`
        }
      };
      
      console.log('Auth config:', authConfig);
      
      try {
        const testBackend = clientInstance.with(authConfig);
        console.log('Test backend created:', testBackend);
        console.log('Test backend type:', typeof testBackend);
        console.log('Test backend has auth:', !!testBackend?.auth);
        console.log('Test backend has branding:', !!testBackend?.branding);
        
        return testBackend;
      } catch (error) {
        console.error('Error creating test backend:', error);
        return null;
      }
    } else {
      console.log('No token found');
      return null;
    }
  };
  
  (window as any).testTokenStorage = () => {
    console.log('=== TESTING TOKEN STORAGE ===');
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    
    console.log('Access token:', accessToken);
    console.log('Refresh token:', refreshToken);
    
    if (accessToken) {
      console.log('Access token length:', accessToken.length);
      console.log('Access token contains spaces:', accessToken.includes(' '));
      console.log('Access token contains newlines:', accessToken.includes('\n'));
      console.log('Access token contains tabs:', accessToken.includes('\t'));
      console.log('Access token starts with "Bearer":', accessToken.startsWith('Bearer '));
    }
  };
  
  (window as any).testAuthenticatedBackend = () => {
    console.log('=== TESTING AUTHENTICATED BACKEND ===');
    const backend = getAuthenticatedBackend();
    console.log('Authenticated backend:', backend);
    
    if (backend) {
      console.log('Backend type:', typeof backend);
      console.log('Backend has auth:', !!backend.auth);
      console.log('Backend has branding:', !!backend.branding);
      console.log('Backend has tasks:', !!backend.tasks);
    }
    
    return backend;
  };
  
  (window as any).cleanAllTokens = () => {
    console.log('=== CLEANING ALL TOKENS ===');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    console.log('Tokens cleared');
  };
  
  (window as any).forceCleanTokens = () => {
    console.log('=== FORCE CLEANING TOKENS ===');
    localStorage.clear();
    console.log('All localStorage cleared');
  };
  
  (window as any).debugTokenCorruption = () => {
    console.log('=== DEBUGGING TOKEN CORRUPTION ===');
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      console.log('Raw token:', accessToken);
      console.log('Token length:', accessToken.length);
      console.log('Token char codes:', Array.from(accessToken).map(c => c.charCodeAt(0)));
      console.log('Contains whitespace:', /\s/.test(accessToken));
      console.log('Contains newlines:', /\n/.test(accessToken));
      console.log('Contains tabs:', /\t/.test(accessToken));
      console.log('Contains carriage returns:', /\r/.test(accessToken));
    }
  };
}

// Clean existing tokens when module loads
cleanExistingTokens();

// Monitor localStorage changes and clean tokens in real-time
if (typeof window !== 'undefined') {
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function(key: string, value: string) {
    if (key === 'accessToken' || key === 'refreshToken') {
      // Check for suspicious token lengths (tokens should be 200-300 chars, not 500+)
      if (value.length > 400) {
        console.error(`SUSPICIOUS TOKEN LENGTH: ${key} has ${value.length} characters! This indicates token corruption.`);
        console.error('Token value:', value.substring(0, 100) + '...');
        
        // Try to extract a valid token from the corrupted one
        // Look for JWT pattern: 3 parts separated by dots
        const parts = value.split('.');
        if (parts.length >= 3) {
          // Take the first 3 parts and reconstruct
          const validToken = parts.slice(0, 3).join('.');
          if (validToken.length >= 100 && validToken.length <= 400) {
            console.log('Attempting to extract valid token from corrupted data...');
            console.log('Extracted token length:', validToken.length);
            originalSetItem.call(this, key, validToken);
            return;
          }
        }
        
        // If we can't extract a valid token, clear it
        console.error('Cannot extract valid token, clearing corrupted token');
        originalSetItem.call(this, key, '');
        return;
      }
      
      const cleanValue = value.replace(/\s/g, '');
      if (cleanValue !== value) {
        console.warn(`Token ${key} contained whitespace, cleaning before storage`);
        console.log(`Original ${key} length:`, value.length, 'Cleaned length:', cleanValue.length);
        originalSetItem.call(this, key, cleanValue);
        return;
      }
    }
    originalSetItem.call(this, key, value);
  };
}
