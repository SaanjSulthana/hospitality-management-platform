import { getEnvMode, getEnvVar, isDevelopment, isProduction } from '../utils/env';

/**
 * Environment-specific configuration
 */
export interface EnvironmentConfig {
  name: string;
  apiUrl: string;
  debug: boolean;
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableConsole: boolean;
    enableRemote: boolean;
  };
  features: {
    enableDevTools: boolean;
    enableMockData: boolean;
    enableAnalytics: boolean;
    enableErrorReporting: boolean;
  };
  performance: {
    enableCaching: boolean;
    cacheTimeout: number;
    enableCompression: boolean;
  };
  security: {
    enableHttps: boolean;
    enableCors: boolean;
    tokenExpiry: number;
  };
}

/**
 * Development environment configuration
 */
const developmentConfig: EnvironmentConfig = {
  name: 'development',
  apiUrl: getEnvVar('VITE_API_URL') || getEnvVar('REACT_APP_API_URL') || 'http://localhost:4000',
  debug: true,
  logging: {
    level: 'debug',
    enableConsole: true,
    enableRemote: false,
  },
  features: {
    enableDevTools: true,
    enableMockData: true,
    enableAnalytics: false,
    enableErrorReporting: false,
  },
  performance: {
    enableCaching: false,
    cacheTimeout: 0,
    enableCompression: false,
  },
  security: {
    enableHttps: false,
    enableCors: true,
    tokenExpiry: 24 * 60 * 60 * 1000, // 24 hours
  },
};

/**
 * Production environment configuration
 */
const productionConfig: EnvironmentConfig = {
  name: 'production',
  apiUrl: getEnvVar('VITE_API_URL') || getEnvVar('REACT_APP_API_URL') || 'https://api.hospitality-platform.com',
  debug: false,
  logging: {
    level: 'error',
    enableConsole: false,
    enableRemote: true,
  },
  features: {
    enableDevTools: false,
    enableMockData: false,
    enableAnalytics: true,
    enableErrorReporting: true,
  },
  performance: {
    enableCaching: true,
    cacheTimeout: 5 * 60 * 1000, // 5 minutes
    enableCompression: true,
  },
  security: {
    enableHttps: true,
    enableCors: false,
    tokenExpiry: 2 * 60 * 60 * 1000, // 2 hours
  },
};

/**
 * Test environment configuration
 */
const testConfig: EnvironmentConfig = {
  name: 'test',
  apiUrl: 'http://localhost:4000',
  debug: true,
  logging: {
    level: 'error',
    enableConsole: false,
    enableRemote: false,
  },
  features: {
    enableDevTools: false,
    enableMockData: true,
    enableAnalytics: false,
    enableErrorReporting: false,
  },
  performance: {
    enableCaching: false,
    cacheTimeout: 0,
    enableCompression: false,
  },
  security: {
    enableHttps: false,
    enableCors: true,
    tokenExpiry: 60 * 60 * 1000, // 1 hour
  },
};

/**
 * Staging environment configuration
 */
const stagingConfig: EnvironmentConfig = {
  name: 'staging',
  apiUrl: getEnvVar('VITE_API_URL') || 'https://staging-api.hospitality-platform.com',
  debug: true,
  logging: {
    level: 'info',
    enableConsole: true,
    enableRemote: true,
  },
  features: {
    enableDevTools: true,
    enableMockData: false,
    enableAnalytics: true,
    enableErrorReporting: true,
  },
  performance: {
    enableCaching: true,
    cacheTimeout: 2 * 60 * 1000, // 2 minutes
    enableCompression: true,
  },
  security: {
    enableHttps: true,
    enableCors: true,
    tokenExpiry: 4 * 60 * 60 * 1000, // 4 hours
  },
};

/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const mode = getEnvMode();
  
  switch (mode) {
    case 'development':
      return developmentConfig;
    case 'production':
      return productionConfig;
    case 'test':
      return testConfig;
    default:
      // Check for staging environment
      if (getEnvVar('VITE_ENVIRONMENT') === 'staging' || 
          getEnvVar('REACT_APP_ENVIRONMENT') === 'staging') {
        return stagingConfig;
      }
      
      // Default to production for unknown environments
      return productionConfig;
  }
}

/**
 * Get current environment name
 */
export function getCurrentEnvironment(): string {
  return getEnvironmentConfig().name;
}

/**
 * Check if current environment is development
 */
export function isDevEnvironment(): boolean {
  return getCurrentEnvironment() === 'development';
}

/**
 * Check if current environment is production
 */
export function isProdEnvironment(): boolean {
  return getCurrentEnvironment() === 'production';
}

/**
 * Check if current environment is staging
 */
export function isStagingEnvironment(): boolean {
  return getCurrentEnvironment() === 'staging';
}

/**
 * Check if current environment is test
 */
export function isTestEnvironment(): boolean {
  return getCurrentEnvironment() === 'test';
}

/**
 * Get API URL for current environment
 */
export function getEnvironmentApiUrl(): string {
  return getEnvironmentConfig().apiUrl;
}

/**
 * Check if debug mode is enabled
 */
export function isDebugEnabled(): boolean {
  return getEnvironmentConfig().debug;
}

/**
 * Get logging configuration
 */
export function getLoggingConfig() {
  return getEnvironmentConfig().logging;
}

/**
 * Get feature flags
 */
export function getFeatureFlags() {
  return getEnvironmentConfig().features;
}

/**
 * Get performance configuration
 */
export function getPerformanceConfig() {
  return getEnvironmentConfig().performance;
}

/**
 * Get security configuration
 */
export function getSecurityConfig() {
  return getEnvironmentConfig().security;
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof EnvironmentConfig['features']): boolean {
  return getFeatureFlags()[feature];
}

/**
 * Get environment-specific API configuration
 */
export function getEnvironmentApiConfig() {
  const config = getEnvironmentConfig();
  
  return {
    baseUrl: config.apiUrl,
    timeout: config.name === 'production' ? 30000 : 60000,
    retryAttempts: config.name === 'production' ? 3 : 1,
    retryDelay: config.name === 'production' ? 1000 : 500,
    debug: config.debug,
  };
}

/**
 * Validate environment configuration
 */
export function validateEnvironmentConfig(): { isValid: boolean; errors: string[] } {
  const config = getEnvironmentConfig();
  const errors: string[] = [];

  // Validate API URL
  if (!config.apiUrl || !config.apiUrl.startsWith('http')) {
    errors.push('Invalid API URL configuration');
  }

  // Validate logging level
  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLogLevels.includes(config.logging.level)) {
    errors.push('Invalid logging level');
  }

  // Validate token expiry
  if (config.security.tokenExpiry <= 0) {
    errors.push('Invalid token expiry configuration');
  }

  // Validate cache timeout
  if (config.performance.cacheTimeout < 0) {
    errors.push('Invalid cache timeout configuration');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get environment-specific error messages
 */
export function getEnvironmentErrorMessages() {
  const config = getEnvironmentConfig();
  
  if (config.debug) {
    return {
      networkError: 'Network error occurred. Check console for details.',
      serverError: 'Server error occurred. Check console for details.',
      validationError: 'Validation error occurred. Check console for details.',
    };
  }
  
  return {
    networkError: 'Network error. Please check your connection and try again.',
    serverError: 'Server error. Please try again later.',
    validationError: 'Please check your input and try again.',
  };
}

// Export the current environment configuration
export const ENVIRONMENT_CONFIG = getEnvironmentConfig();
