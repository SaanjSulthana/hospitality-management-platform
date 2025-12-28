import log from "encore.dev/log";

/**
 * Environment configuration for Encore.js backend
 */
export interface BackendEnvironmentConfig {
  name: string;
  debug: boolean;
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableConsole: boolean;
    enableRemote: boolean;
  };
  database: {
    name: string;
    maxConnections: number;
    connectionTimeout: number;
    queryTimeout: number;
  };
  security: {
    jwtExpiry: number;
    refreshExpiry: number;
    enableCors: boolean;
    requireHttps: boolean;
  };
  performance: {
    enableCaching: boolean;
    cacheTimeout: number;
    enableCompression: boolean;
    maxFileSize: number;
  };
  features: {
    enableDevTools: boolean;
    enableMockData: boolean;
    enableAnalytics: boolean;
    enableErrorReporting: boolean;
  };
}

/**
 * Development environment configuration
 */
const developmentConfig: BackendEnvironmentConfig = {
  name: 'development',
  debug: true,
  logging: {
    level: 'debug',
    enableConsole: true,
    enableRemote: false,
  },
  database: {
    name: 'hospitality',
    maxConnections: 10,
    connectionTimeout: 30000,
    queryTimeout: 60000,
  },
  security: {
    jwtExpiry: 24 * 60 * 60 * 1000, // 24 hours
    refreshExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
    enableCors: true,
    requireHttps: false,
  },
  performance: {
    enableCaching: false,
    cacheTimeout: 0,
    enableCompression: false,
    maxFileSize: 200 * 1024 * 1024, // 200MB - Updated to match image processor limits
  },
  features: {
    enableDevTools: true,
    enableMockData: true,
    enableAnalytics: false,
    enableErrorReporting: false,
  },
};

/**
 * Production environment configuration
 */
const productionConfig: BackendEnvironmentConfig = {
  name: 'production',
  debug: false,
  logging: {
    level: 'error',
    enableConsole: false,
    enableRemote: true,
  },
  database: {
    name: 'hospitality',
    maxConnections: 50,
    connectionTimeout: 10000,
    queryTimeout: 30000,
  },
  security: {
    jwtExpiry: 2 * 60 * 60 * 1000, // 2 hours
    refreshExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
    enableCors: false,
    requireHttps: true,
  },
  performance: {
    enableCaching: true,
    cacheTimeout: 5 * 60 * 1000, // 5 minutes
    enableCompression: true,
    maxFileSize: 200 * 1024 * 1024, // 200MB - Updated for document uploads
  },
  features: {
    enableDevTools: false,
    enableMockData: false,
    enableAnalytics: true,
    enableErrorReporting: true,
  },
};

/**
 * Test environment configuration
 */
const testConfig: BackendEnvironmentConfig = {
  name: 'test',
  debug: true,
  logging: {
    level: 'error',
    enableConsole: false,
    enableRemote: false,
  },
  database: {
    name: 'hospitality_test',
    maxConnections: 5,
    connectionTimeout: 5000,
    queryTimeout: 10000,
  },
  security: {
    jwtExpiry: 60 * 60 * 1000, // 1 hour
    refreshExpiry: 24 * 60 * 60 * 1000, // 1 day
    enableCors: true,
    requireHttps: false,
  },
  performance: {
    enableCaching: false,
    cacheTimeout: 0,
    enableCompression: false,
    maxFileSize: 1024 * 1024, // 1MB
  },
  features: {
    enableDevTools: false,
    enableMockData: true,
    enableAnalytics: false,
    enableErrorReporting: false,
  },
};

/**
 * Staging environment configuration
 */
const stagingConfig: BackendEnvironmentConfig = {
  name: 'staging',
  debug: true,
  logging: {
    level: 'info',
    enableConsole: true,
    enableRemote: true,
  },
  database: {
    name: 'hospitality',
    maxConnections: 20,
    connectionTimeout: 15000,
    queryTimeout: 45000,
  },
  security: {
    jwtExpiry: 4 * 60 * 60 * 1000, // 4 hours
    refreshExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
    enableCors: true,
    requireHttps: true,
  },
  performance: {
    enableCaching: true,
    cacheTimeout: 2 * 60 * 1000, // 2 minutes
    enableCompression: true,
    maxFileSize: 8 * 1024 * 1024, // 8MB
  },
  features: {
    enableDevTools: true,
    enableMockData: false,
    enableAnalytics: true,
    enableErrorReporting: true,
  },
};

/**
 * Get current environment name
 */
function getCurrentEnvironment(): string {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/33d595d9-e296-4216-afc6-6fa72f7ee3e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'config/environment.ts:191',message:'Environment detection start',data:{nodeEnv:process.env.NODE_ENV,encoreEnv:process.env.ENCORE_ENV},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  // In Encore.js, we can detect environment through various means
  const nodeEnv = process.env.NODE_ENV;
  const encoreEnv = process.env.ENCORE_ENV;
  
  let detectedEnv: string;
  if (encoreEnv) {
    detectedEnv = encoreEnv;
  } else if (nodeEnv) {
    detectedEnv = nodeEnv;
  } else {
    detectedEnv = 'development';
  }
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/33d595d9-e296-4216-afc6-6fa72f7ee3e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'config/environment.ts:205',message:'Environment detected',data:{detectedEnv,nodeEnv,encoreEnv},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  return detectedEnv;
}

/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig(): BackendEnvironmentConfig {
  const env = getCurrentEnvironment();
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/33d595d9-e296-4216-afc6-6fa72f7ee3e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'config/environment.ts:211',message:'Getting environment config',data:{env},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  let config: BackendEnvironmentConfig;
  switch (env) {
    case 'development':
      config = developmentConfig;
      break;
    case 'production':
      config = productionConfig;
      break;
    case 'test':
      config = testConfig;
      break;
    case 'staging':
      config = stagingConfig;
      break;
    default:
      log.warn(`Unknown environment: ${env}, defaulting to development`);
      config = developmentConfig;
  }
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/33d595d9-e296-4216-afc6-6fa72f7ee3e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'config/environment.ts:226',message:'Environment config selected',data:{env,configName:config.name,debug:config.debug,dbMaxConnections:config.database.maxConnections,dbTimeout:config.database.queryTimeout},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  return config;
}

/**
 * Get current environment name
 */
export function getEnvironmentName(): string {
  return getCurrentEnvironment();
}

/**
 * Check if current environment is development
 */
export function isDevelopment(): boolean {
  return getCurrentEnvironment() === 'development';
}

/**
 * Check if current environment is production
 */
export function isProduction(): boolean {
  return getCurrentEnvironment() === 'production';
}

/**
 * Check if current environment is staging
 */
export function isStaging(): boolean {
  return getCurrentEnvironment() === 'staging';
}

/**
 * Check if current environment is test
 */
export function isTest(): boolean {
  return getCurrentEnvironment() === 'test';
}

/**
 * Get database configuration
 */
export function getDatabaseConfig() {
  return getEnvironmentConfig().database;
}

/**
 * Get security configuration
 */
export function getSecurityConfig() {
  return getEnvironmentConfig().security;
}

/**
 * Get performance configuration
 */
export function getPerformanceConfig() {
  return getEnvironmentConfig().performance;
}

/**
 * Get feature flags
 */
export function getFeatureFlags() {
  return getEnvironmentConfig().features;
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof BackendEnvironmentConfig['features']): boolean {
  return getFeatureFlags()[feature];
}

/**
 * Get logging configuration
 */
export function getLoggingConfig() {
  return getEnvironmentConfig().logging;
}

/**
 * Log environment information
 */
export function logEnvironmentInfo(): void {
  const config = getEnvironmentConfig();
  
  log.info('Environment configuration loaded', {
    environment: config.name,
    debug: config.debug,
    database: config.database.name,
    features: Object.entries(config.features)
      .filter(([, enabled]) => enabled)
      .map(([feature]) => feature),
  });
}

/**
 * Validate environment configuration
 */
export function validateEnvironmentConfig(): { isValid: boolean; errors: string[] } {
  const config = getEnvironmentConfig();
  const errors: string[] = [];

  // Validate database configuration
  if (!config.database.name || config.database.name.length === 0) {
    errors.push('Database name is required');
  }

  if (config.database.maxConnections <= 0) {
    errors.push('Database max connections must be greater than 0');
  }

  if (config.database.connectionTimeout <= 0) {
    errors.push('Database connection timeout must be greater than 0');
  }

  // Validate security configuration
  if (config.security.jwtExpiry <= 0) {
    errors.push('JWT expiry must be greater than 0');
  }

  if (config.security.refreshExpiry <= 0) {
    errors.push('Refresh token expiry must be greater than 0');
  }

  // Validate performance configuration
  if (config.performance.maxFileSize <= 0) {
    errors.push('Max file size must be greater than 0');
  }

  if (config.performance.cacheTimeout < 0) {
    errors.push('Cache timeout cannot be negative');
  }

  // Validate logging level
  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLogLevels.includes(config.logging.level)) {
    errors.push(`Invalid logging level: ${config.logging.level}`);
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
      databaseError: 'Database error occurred. Check logs for details.',
      validationError: 'Validation error occurred. Check logs for details.',
      authenticationError: 'Authentication error occurred. Check logs for details.',
      authorizationError: 'Authorization error occurred. Check logs for details.',
      internalError: 'Internal server error occurred. Check logs for details.',
    };
  }
  
  return {
    databaseError: 'Database error. Please try again later.',
    validationError: 'Invalid request. Please check your input.',
    authenticationError: 'Authentication failed. Please log in again.',
    authorizationError: 'Access denied. You do not have permission to perform this action.',
    internalError: 'Internal server error. Please try again later.',
  };
}

// Export the current environment configuration
export const ENVIRONMENT_CONFIG = getEnvironmentConfig();

// Log environment info on module load
if (isDevelopment()) {
  logEnvironmentInfo();
}
