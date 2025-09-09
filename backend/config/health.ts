import { api, APIError } from "encore.dev/api";
import { getEnvironmentConfig, validateEnvironmentConfig, getEnvironmentName } from "./environment";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import log from "encore.dev/log";

// Database connection for health checks
const healthDB = SQLDatabase.named("hospitality");

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  environment: string;
  version: string;
  services: {
    database: ServiceStatus;
    configuration: ServiceStatus;
    environment: ServiceStatus;
  };
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
}

/**
 * Service status
 */
export interface ServiceStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  responseTime?: number;
  lastChecked: string;
}

/**
 * Configuration validation response
 */
export interface ConfigValidationResponse {
  isValid: boolean;
  environment: string;
  errors: string[];
  warnings: string[];
  configuration: {
    database: any;
    security: any;
    performance: any;
    features: any;
  };
}

/**
 * Health check endpoint
 */
export const healthCheck = api(
  { method: "GET", path: "/health" },
  async (): Promise<HealthCheckResponse> => {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const environment = getEnvironmentName();
    
    // Check database connectivity
    const databaseStatus = await checkDatabaseHealth();
    
    // Check configuration
    const configValidation = validateEnvironmentConfig();
    const configurationStatus: ServiceStatus = {
      status: configValidation.isValid ? 'healthy' : 'unhealthy',
      message: configValidation.isValid ? 'Configuration is valid' : 'Configuration has errors',
      lastChecked: timestamp,
    };
    
    // Check environment
    const environmentStatus: ServiceStatus = {
      status: 'healthy',
      message: `Environment: ${environment}`,
      lastChecked: timestamp,
    };
    
    // Determine overall status
    const services = {
      database: databaseStatus,
      configuration: configurationStatus,
      environment: environmentStatus,
    };
    
    const overallStatus = determineOverallStatus(services);
    
    // Get system information
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp,
      environment,
      version: process.env.npm_package_version || '1.0.0',
      services,
      uptime,
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
      },
    };
    
    // Log health check
    log.info('Health check performed', {
      status: overallStatus,
      environment,
      databaseStatus: databaseStatus.status,
      configValid: configValidation.isValid,
    });
    
    return response;
  }
);

/**
 * Configuration validation endpoint
 */
export const validateConfig = api(
  { method: "GET", path: "/config/validate" },
  async (): Promise<ConfigValidationResponse> => {
    const environment = getEnvironmentName();
    const config = getEnvironmentConfig();
    const validation = validateEnvironmentConfig();
    
    // Generate warnings
    const warnings: string[] = [];
    
    if (config.name === 'production' && config.features.enableDevTools) {
      warnings.push('Development tools enabled in production');
    }
    
    if (config.name === 'production' && config.features.enableMockData) {
      warnings.push('Mock data enabled in production');
    }
    
    if (config.name === 'production' && !config.security.requireHttps) {
      warnings.push('HTTPS not required in production');
    }
    
    if (config.performance.maxFileSize > 10 * 1024 * 1024) {
      warnings.push('Max file size is very large (>10MB)');
    }
    
    const response: ConfigValidationResponse = {
      isValid: validation.isValid,
      environment,
      errors: validation.errors,
      warnings,
      configuration: {
        database: {
          name: config.database.name,
          maxConnections: config.database.maxConnections,
          connectionTimeout: config.database.connectionTimeout,
        },
        security: {
          jwtExpiry: config.security.jwtExpiry,
          refreshExpiry: config.security.refreshExpiry,
          enableCors: config.security.enableCors,
          requireHttps: config.security.requireHttps,
        },
        performance: {
          enableCaching: config.performance.enableCaching,
          cacheTimeout: config.performance.cacheTimeout,
          enableCompression: config.performance.enableCompression,
          maxFileSize: config.performance.maxFileSize,
        },
        features: config.features,
      },
    };
    
    log.info('Configuration validation performed', {
      isValid: validation.isValid,
      environment,
      errorCount: validation.errors.length,
      warningCount: warnings.length,
    });
    
    return response;
  }
);

/**
 * Environment information endpoint
 */
export const getEnvironmentInfo = api(
  { method: "GET", path: "/config/environment" },
  async () => {
    const config = getEnvironmentConfig();
    
    return {
      environment: config.name,
      debug: config.debug,
      features: config.features,
      database: {
        name: config.database.name,
        maxConnections: config.database.maxConnections,
      },
      security: {
        jwtExpiry: config.security.jwtExpiry,
        refreshExpiry: config.security.refreshExpiry,
        enableCors: config.security.enableCors,
        requireHttps: config.security.requireHttps,
      },
      performance: {
        enableCaching: config.performance.enableCaching,
        cacheTimeout: config.performance.cacheTimeout,
        enableCompression: config.performance.enableCompression,
        maxFileSize: config.performance.maxFileSize,
      },
    };
  }
);

/**
 * Check database health
 */
async function checkDatabaseHealth(): Promise<ServiceStatus> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  try {
    // Simple query to check database connectivity
    const result = await healthDB.query("SELECT 1 as health_check");
    
    if (result.rows.length > 0 && result.rows[0].health_check === 1) {
      return {
        status: 'healthy',
        message: 'Database is accessible',
        responseTime: Date.now() - startTime,
        lastChecked: timestamp,
      };
    } else {
      return {
        status: 'unhealthy',
        message: 'Database query returned unexpected result',
        responseTime: Date.now() - startTime,
        lastChecked: timestamp,
      };
    }
  } catch (error) {
    log.error('Database health check failed', { error: error.message });
    
    return {
      status: 'unhealthy',
      message: `Database error: ${error.message}`,
      responseTime: Date.now() - startTime,
      lastChecked: timestamp,
    };
  }
}

/**
 * Determine overall health status
 */
function determineOverallStatus(services: HealthCheckResponse['services']): 'healthy' | 'unhealthy' | 'degraded' {
  const statuses = Object.values(services).map(service => service.status);
  
  if (statuses.every(status => status === 'healthy')) {
    return 'healthy';
  }
  
  if (statuses.some(status => status === 'unhealthy')) {
    return 'unhealthy';
  }
  
  return 'degraded';
}

/**
 * Database connection test endpoint
 */
export const testDatabaseConnection = api(
  { method: "GET", path: "/config/test-database" },
  async () => {
    try {
      const startTime = Date.now();
      
      // Test basic connectivity
      const connectivityResult = await healthDB.query("SELECT 1 as test");
      
      // Test table existence
      const tablesResult = await healthDB.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);
      
      // Test a simple operation
      const operationResult = await healthDB.query("SELECT NOW() as current_time");
      
      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        responseTime,
        connectivity: connectivityResult.rows.length > 0,
        tables: tablesResult.rows.map(row => row.table_name),
        currentTime: operationResult.rows[0]?.current_time,
        message: 'Database connection test successful',
      };
    } catch (error) {
      log.error('Database connection test failed', { error: error.message });
      
      throw new APIError(
        'Database connection test failed',
        'INTERNAL_ERROR',
        500,
        { error: error.message }
      );
    }
  }
);
