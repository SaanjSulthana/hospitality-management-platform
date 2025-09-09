/**
 * Environment-specific configuration loading system
 */

import React from 'react';
import { environmentDetector, EnvironmentInfo } from '../utils/environment-detector';

export interface EnvironmentConfig {
  name: string;
  debug: boolean;
  api: {
    baseUrl: string;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableConsole: boolean;
    enableRemote: boolean;
    remoteEndpoint?: string;
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
    allowedOrigins: string[];
  };
  performance: {
    enableCaching: boolean;
    cacheTimeout: number;
    enableCompression: boolean;
    maxFileSize: number;
    enableServiceWorker: boolean;
  };
  features: {
    enableDevTools: boolean;
    enableMockData: boolean;
    enableAnalytics: boolean;
    enableErrorReporting: boolean;
    enablePwa: boolean;
    enableOfflineMode: boolean;
  };
  ui: {
    theme: 'light' | 'dark' | 'auto';
    enableAnimations: boolean;
    enableTransitions: boolean;
    enableSoundEffects: boolean;
  };
  monitoring: {
    enablePerformanceMonitoring: boolean;
    enableErrorTracking: boolean;
    enableUserAnalytics: boolean;
    sampleRate: number;
  };
}

/**
 * Environment-specific configuration loader
 */
export class EnvironmentConfigLoader {
  private static instance: EnvironmentConfigLoader;
  private cachedConfig: EnvironmentConfig | null = null;
  private lastLoadTime: number = 0;
  private readonly CACHE_DURATION = 10000; // 10 seconds

  private constructor() {}

  public static getInstance(): EnvironmentConfigLoader {
    if (!EnvironmentConfigLoader.instance) {
      EnvironmentConfigLoader.instance = new EnvironmentConfigLoader();
    }
    return EnvironmentConfigLoader.instance;
  }

  /**
   * Load environment-specific configuration
   */
  public loadConfig(): EnvironmentConfig {
    const now = Date.now();
    
    // Return cached config if still valid
    if (this.cachedConfig && (now - this.lastLoadTime) < this.CACHE_DURATION) {
      return this.cachedConfig;
    }

    const envInfo = environmentDetector.getEnvironmentInfo();
    const config = this.buildConfigForEnvironment(envInfo);
    
    this.cachedConfig = config;
    this.lastLoadTime = now;
    
    return config;
  }

  /**
   * Build configuration for specific environment
   */
  private buildConfigForEnvironment(envInfo: EnvironmentInfo): EnvironmentConfig {
    const baseConfig = this.getBaseConfig();
    
    switch (envInfo.name) {
      case 'development':
        return this.mergeConfigs(baseConfig, this.getDevelopmentConfig(envInfo));
      case 'staging':
        return this.mergeConfigs(baseConfig, this.getStagingConfig(envInfo));
      case 'production':
        return this.mergeConfigs(baseConfig, this.getProductionConfig(envInfo));
      case 'test':
        return this.mergeConfigs(baseConfig, this.getTestConfig(envInfo));
      default:
        return this.mergeConfigs(baseConfig, this.getDevelopmentConfig(envInfo));
    }
  }

  /**
   * Get base configuration
   */
  private getBaseConfig(): Partial<EnvironmentConfig> {
    return {
      api: {
        baseUrl: this.getApiBaseUrl(),
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
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
        allowedOrigins: ['*'],
      },
      performance: {
        enableCaching: false,
        cacheTimeout: 0,
        enableCompression: false,
        maxFileSize: 10 * 1024 * 1024, // 10MB
        enableServiceWorker: false,
      },
      features: {
        enableDevTools: false,
        enableMockData: false,
        enableAnalytics: false,
        enableErrorReporting: false,
        enablePwa: false,
        enableOfflineMode: false,
      },
      ui: {
        theme: 'light',
        enableAnimations: true,
        enableTransitions: true,
        enableSoundEffects: false,
      },
      monitoring: {
        enablePerformanceMonitoring: false,
        enableErrorTracking: false,
        enableUserAnalytics: false,
        sampleRate: 0.1,
      },
    };
  }

  /**
   * Get development configuration
   */
  private getDevelopmentConfig(envInfo: EnvironmentInfo): Partial<EnvironmentConfig> {
    return {
      name: 'development',
      debug: true,
      api: {
        baseUrl: this.getApiBaseUrl(),
        timeout: 60000, // Longer timeout for development
        retryAttempts: 1, // Fewer retries for faster feedback
        retryDelay: 500,
      },
      logging: {
        level: 'debug',
        enableConsole: true,
        enableRemote: false,
      },
      security: {
        jwtExpiry: 24 * 60 * 60 * 1000, // 24 hours
        refreshExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
        enableCors: true,
        requireHttps: false,
        allowedOrigins: ['*'],
      },
      performance: {
        enableCaching: false,
        cacheTimeout: 0,
        enableCompression: false,
        maxFileSize: 50 * 1024 * 1024, // 50MB for development
        enableServiceWorker: false,
      },
      features: {
        enableDevTools: true,
        enableMockData: true,
        enableAnalytics: false,
        enableErrorReporting: false,
        enablePwa: false,
        enableOfflineMode: false,
      },
      ui: {
        theme: 'light',
        enableAnimations: true,
        enableTransitions: true,
        enableSoundEffects: true,
      },
      monitoring: {
        enablePerformanceMonitoring: true,
        enableErrorTracking: true,
        enableUserAnalytics: false,
        sampleRate: 1.0, // Full sampling in development
      },
    };
  }

  /**
   * Get staging configuration
   */
  private getStagingConfig(envInfo: EnvironmentInfo): Partial<EnvironmentConfig> {
    return {
      name: 'staging',
      debug: true,
      api: {
        baseUrl: this.getApiBaseUrl(),
        timeout: 45000,
        retryAttempts: 3,
        retryDelay: 1000,
      },
      logging: {
        level: 'info',
        enableConsole: true,
        enableRemote: true,
        remoteEndpoint: this.getLoggingEndpoint(),
      },
      security: {
        jwtExpiry: 4 * 60 * 60 * 1000, // 4 hours
        refreshExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
        enableCors: true,
        requireHttps: true,
        allowedOrigins: this.getAllowedOrigins(),
      },
      performance: {
        enableCaching: true,
        cacheTimeout: 2 * 60 * 1000, // 2 minutes
        enableCompression: true,
        maxFileSize: 8 * 1024 * 1024, // 8MB
        enableServiceWorker: true,
      },
      features: {
        enableDevTools: true,
        enableMockData: false,
        enableAnalytics: true,
        enableErrorReporting: true,
        enablePwa: true,
        enableOfflineMode: true,
      },
      ui: {
        theme: 'light',
        enableAnimations: true,
        enableTransitions: true,
        enableSoundEffects: false,
      },
      monitoring: {
        enablePerformanceMonitoring: true,
        enableErrorTracking: true,
        enableUserAnalytics: true,
        sampleRate: 0.5, // 50% sampling in staging
      },
    };
  }

  /**
   * Get production configuration
   */
  private getProductionConfig(envInfo: EnvironmentInfo): Partial<EnvironmentConfig> {
    return {
      name: 'production',
      debug: false,
      api: {
        baseUrl: this.getApiBaseUrl(),
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
      },
      logging: {
        level: 'error',
        enableConsole: false,
        enableRemote: true,
        remoteEndpoint: this.getLoggingEndpoint(),
      },
      security: {
        jwtExpiry: 2 * 60 * 60 * 1000, // 2 hours
        refreshExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
        enableCors: false,
        requireHttps: true,
        allowedOrigins: this.getAllowedOrigins(),
      },
      performance: {
        enableCaching: true,
        cacheTimeout: 5 * 60 * 1000, // 5 minutes
        enableCompression: true,
        maxFileSize: 5 * 1024 * 1024, // 5MB
        enableServiceWorker: true,
      },
      features: {
        enableDevTools: false,
        enableMockData: false,
        enableAnalytics: true,
        enableErrorReporting: true,
        enablePwa: true,
        enableOfflineMode: true,
      },
      ui: {
        theme: 'light',
        enableAnimations: true,
        enableTransitions: true,
        enableSoundEffects: false,
      },
      monitoring: {
        enablePerformanceMonitoring: true,
        enableErrorTracking: true,
        enableUserAnalytics: true,
        sampleRate: 0.1, // 10% sampling in production
      },
    };
  }

  /**
   * Get test configuration
   */
  private getTestConfig(envInfo: EnvironmentInfo): Partial<EnvironmentConfig> {
    return {
      name: 'test',
      debug: true,
      api: {
        baseUrl: this.getApiBaseUrl(),
        timeout: 10000, // Shorter timeout for tests
        retryAttempts: 1, // No retries in tests
        retryDelay: 100,
      },
      logging: {
        level: 'error',
        enableConsole: false,
        enableRemote: false,
      },
      security: {
        jwtExpiry: 60 * 60 * 1000, // 1 hour
        refreshExpiry: 24 * 60 * 60 * 1000, // 1 day
        enableCors: true,
        requireHttps: false,
        allowedOrigins: ['*'],
      },
      performance: {
        enableCaching: false,
        cacheTimeout: 0,
        enableCompression: false,
        maxFileSize: 1024 * 1024, // 1MB for tests
        enableServiceWorker: false,
      },
      features: {
        enableDevTools: false,
        enableMockData: true,
        enableAnalytics: false,
        enableErrorReporting: false,
        enablePwa: false,
        enableOfflineMode: false,
      },
      ui: {
        theme: 'light',
        enableAnimations: false, // Disable animations in tests
        enableTransitions: false,
        enableSoundEffects: false,
      },
      monitoring: {
        enablePerformanceMonitoring: false,
        enableErrorTracking: false,
        enableUserAnalytics: false,
        sampleRate: 0,
      },
    };
  }

  /**
   * Get API base URL
   */
  private getApiBaseUrl(): string {
    // Check environment variables
    const viteApiUrl = typeof import.meta !== 'undefined' && (import.meta as any).env 
      ? (import.meta as any).env.VITE_API_URL 
      : undefined;
    
    const reactApiUrl = typeof process !== 'undefined' && process.env 
      ? process.env.REACT_APP_API_URL 
      : undefined;

    // Use environment variable if available
    if (viteApiUrl) return viteApiUrl;
    if (reactApiUrl) return reactApiUrl;

    // Default based on current hostname
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:4000';
    }
    
    return `${protocol}//${hostname}:4000`;
  }

  /**
   * Get logging endpoint
   */
  private getLoggingEndpoint(): string {
    const baseUrl = this.getApiBaseUrl();
    return `${baseUrl}/logs`;
  }

  /**
   * Get allowed origins for CORS
   */
  private getAllowedOrigins(): string[] {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
    
    return [
      `${protocol}//${hostname}`,
      `${protocol}//${hostname}:3000`,
      `${protocol}//${hostname}:4000`,
      `${protocol}//${hostname}:5000`,
    ];
  }

  /**
   * Merge two configuration objects
   */
  private mergeConfigs(base: Partial<EnvironmentConfig>, override: Partial<EnvironmentConfig>): EnvironmentConfig {
    return {
      ...base,
      ...override,
      api: {
        ...base.api,
        ...override.api,
      },
      logging: {
        ...base.logging,
        ...override.logging,
      },
      database: {
        ...base.database,
        ...override.database,
      },
      security: {
        ...base.security,
        ...override.security,
      },
      performance: {
        ...base.performance,
        ...override.performance,
      },
      features: {
        ...base.features,
        ...override.features,
      },
      ui: {
        ...base.ui,
        ...override.ui,
      },
      monitoring: {
        ...base.monitoring,
        ...override.monitoring,
      },
    } as EnvironmentConfig;
  }

  /**
   * Clear cached configuration
   */
  public clearCache(): void {
    this.cachedConfig = null;
    this.lastLoadTime = 0;
  }

  /**
   * Force reload configuration
   */
  public reload(): EnvironmentConfig {
    this.clearCache();
    return this.loadConfig();
  }

  /**
   * Get configuration for specific environment
   */
  public getConfigForEnvironment(environment: string): EnvironmentConfig {
    const envInfo = environmentDetector.getEnvironmentInfo();
    const originalName = envInfo.name;
    
    // Temporarily override environment
    (envInfo as any).name = environment;
    
    const config = this.buildConfigForEnvironment(envInfo);
    
    // Restore original environment
    (envInfo as any).name = originalName;
    
    return config;
  }

  /**
   * Validate configuration
   */
  public validateConfig(config: EnvironmentConfig): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate API configuration
    if (!config.api.baseUrl) {
      errors.push('API base URL is required');
    }

    if (config.api.timeout <= 0) {
      errors.push('API timeout must be greater than 0');
    }

    if (config.api.retryAttempts < 0) {
      errors.push('API retry attempts cannot be negative');
    }

    // Validate security configuration
    if (config.security.jwtExpiry <= 0) {
      errors.push('JWT expiry must be greater than 0');
    }

    if (config.security.refreshExpiry <= 0) {
      errors.push('Refresh token expiry must be greater than 0');
    }

    if (config.security.refreshExpiry <= config.security.jwtExpiry) {
      errors.push('Refresh token expiry must be greater than JWT expiry');
    }

    // Validate performance configuration
    if (config.performance.maxFileSize <= 0) {
      errors.push('Max file size must be greater than 0');
    }

    if (config.performance.cacheTimeout < 0) {
      errors.push('Cache timeout cannot be negative');
    }

    // Validate monitoring configuration
    if (config.monitoring.sampleRate < 0 || config.monitoring.sampleRate > 1) {
      errors.push('Monitoring sample rate must be between 0 and 1');
    }

    // Production-specific validations
    if (config.name === 'production') {
      if (!config.security.requireHttps) {
        warnings.push('Production environment should require HTTPS');
      }

      if (config.features.enableDevTools) {
        warnings.push('Development tools should not be enabled in production');
      }

      if (config.features.enableMockData) {
        warnings.push('Mock data should not be enabled in production');
      }

      if (config.debug) {
        warnings.push('Debug mode should not be enabled in production');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

/**
 * Global configuration loader instance
 */
export const configLoader = EnvironmentConfigLoader.getInstance();

/**
 * Utility functions for configuration loading
 */
export const configUtils = {
  /**
   * Load current environment configuration
   */
  load: (): EnvironmentConfig => {
    return configLoader.loadConfig();
  },

  /**
   * Get configuration for specific environment
   */
  getForEnvironment: (environment: string): EnvironmentConfig => {
    return configLoader.getConfigForEnvironment(environment);
  },

  /**
   * Reload configuration
   */
  reload: (): EnvironmentConfig => {
    return configLoader.reload();
  },

  /**
   * Validate configuration
   */
  validate: (config: EnvironmentConfig) => {
    return configLoader.validateConfig(config);
  },

  /**
   * Clear configuration cache
   */
  clearCache: (): void => {
    configLoader.clearCache();
  },
};

/**
 * Configuration loading hook for React components
 */
export function useEnvironmentConfig() {
  const [config, setConfig] = React.useState<EnvironmentConfig>(() => 
    configLoader.loadConfig()
  );

  React.useEffect(() => {
    const reloadConfig = () => {
      setConfig(configLoader.reload());
    };

    // Reload configuration on environment change
    const interval = setInterval(reloadConfig, 30000); // Every 30 seconds

    return () => {
      clearInterval(interval);
    };
  }, []);

  return config;
}

// Export default instance
export default configLoader;
