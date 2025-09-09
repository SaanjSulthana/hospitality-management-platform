/**
 * Robust environment detection system
 */

import React from 'react';


export type Environment = 'development' | 'production' | 'staging' | 'test';

export interface EnvironmentInfo {
  name: Environment;
  isDevelopment: boolean;
  isProduction: boolean;
  isStaging: boolean;
  isTest: boolean;
  isLocal: boolean;
  isServer: boolean;
  isClient: boolean;
  nodeEnv: string;
  viteEnv: string;
  hostname: string;
  protocol: string;
  port: number | null;
  userAgent: string;
  timestamp: string;
}

/**
 * Environment detection utilities
 */
export class EnvironmentDetector {
  private static instance: EnvironmentDetector;
  private cachedInfo: EnvironmentInfo | null = null;
  private lastDetectionTime: number = 0;
  private readonly CACHE_DURATION = 5000; // 5 seconds

  private constructor() {}

  public static getInstance(): EnvironmentDetector {
    if (!EnvironmentDetector.instance) {
      EnvironmentDetector.instance = new EnvironmentDetector();
    }
    return EnvironmentDetector.instance;
  }

  /**
   * Get comprehensive environment information
   */
  public getEnvironmentInfo(): EnvironmentInfo {
    const now = Date.now();
    
    // Return cached info if still valid
    if (this.cachedInfo && (now - this.lastDetectionTime) < this.CACHE_DURATION) {
      return this.cachedInfo;
    }

    const info = this.detectEnvironment();
    this.cachedInfo = info;
    this.lastDetectionTime = now;
    
    return info;
  }

  /**
   * Detect current environment
   */
  private detectEnvironment(): EnvironmentInfo {
    const nodeEnv = this.getNodeEnv();
    const viteEnv = this.getViteEnv();
    const hostname = this.getHostname();
    const protocol = this.getProtocol();
    const port = this.getPort();
    const userAgent = this.getUserAgent();

    // Determine environment name
    const name = this.determineEnvironmentName(nodeEnv, viteEnv, hostname);

    return {
      name,
      isDevelopment: name === 'development',
      isProduction: name === 'production',
      isStaging: name === 'staging',
      isTest: name === 'test',
      isLocal: this.isLocalEnvironment(hostname),
      isServer: typeof window === 'undefined',
      isClient: typeof window !== 'undefined',
      nodeEnv,
      viteEnv,
      hostname,
      protocol,
      port,
      userAgent,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get Node.js environment
   */
  private getNodeEnv(): string {
    if (typeof process !== 'undefined' && process.env) {
      return process.env.NODE_ENV || 'development';
    }
    return 'development';
  }

  /**
   * Get Vite environment
   */
  private getViteEnv(): string {
    try {
      // @ts-ignore - import.meta is available in Vite
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        // @ts-ignore - import.meta.env is available in Vite
        return import.meta.env.MODE || 'development';
      }
    } catch (e) {
      // import.meta not available, fall through to fallback
    }
    return 'development';
  }

  /**
   * Get hostname
   */
  private getHostname(): string {
    if (typeof window !== 'undefined' && window.location) {
      return window.location.hostname;
    }
    return 'localhost';
  }

  /**
   * Get protocol
   */
  private getProtocol(): string {
    if (typeof window !== 'undefined' && window.location) {
      return window.location.protocol;
    }
    return 'http:';
  }

  /**
   * Get port
   */
  private getPort(): number | null {
    if (typeof window !== 'undefined' && window.location) {
      const port = window.location.port;
      return port ? parseInt(port, 10) : null;
    }
    return null;
  }

  /**
   * Get user agent
   */
  private getUserAgent(): string {
    if (typeof navigator !== 'undefined' && navigator.userAgent) {
      return navigator.userAgent;
    }
    return 'unknown';
  }

  /**
   * Determine environment name based on various factors
   */
  private determineEnvironmentName(nodeEnv: string, viteEnv: string, hostname: string): Environment {
    // Check for explicit test environment
    if (nodeEnv === 'test' || viteEnv === 'test') {
      return 'test';
    }

    // Check for staging environment
    if (this.isStagingEnvironment(nodeEnv, viteEnv, hostname)) {
      return 'staging';
    }

    // Check for production environment
    if (this.isProductionEnvironment(nodeEnv, viteEnv, hostname)) {
      return 'production';
    }

    // Default to development
    return 'development';
  }

  /**
   * Check if environment is staging
   */
  private isStagingEnvironment(nodeEnv: string, viteEnv: string, hostname: string): boolean {
    const stagingIndicators = [
      'staging',
      'stage',
      'preview',
      'demo',
      'test-env',
      'dev-staging',
    ];

    return (
      stagingIndicators.some(indicator => 
        nodeEnv.toLowerCase().includes(indicator) ||
        viteEnv.toLowerCase().includes(indicator) ||
        hostname.toLowerCase().includes(indicator)
      ) ||
      hostname.includes('staging.') ||
      hostname.includes('stage.') ||
      hostname.includes('preview.')
    );
  }

  /**
   * Check if environment is production
   */
  private isProductionEnvironment(nodeEnv: string, viteEnv: string, hostname: string): boolean {
    const productionIndicators = [
      'production',
      'prod',
      'live',
    ];

    const localhostIndicators = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
    ];

    // Check for production indicators
    const hasProductionIndicator = productionIndicators.some(indicator =>
      nodeEnv.toLowerCase().includes(indicator) ||
      viteEnv.toLowerCase().includes(indicator)
    );

    // Check if not localhost
    const isNotLocalhost = !localhostIndicators.some(indicator =>
      hostname.toLowerCase().includes(indicator)
    );

    // Check for production domains
    const isProductionDomain = this.isProductionDomain(hostname);

    return (hasProductionIndicator || (isNotLocalhost && isProductionDomain)) && 
           !this.isStagingEnvironment(nodeEnv, viteEnv, hostname);
  }

  /**
   * Check if hostname is a production domain
   */
  private isProductionDomain(hostname: string): boolean {
    const productionDomains = [
      '.com',
      '.org',
      '.net',
      '.io',
      '.co',
      '.app',
    ];

    // Check for common production TLDs
    const hasProductionTld = productionDomains.some(domain =>
      hostname.toLowerCase().endsWith(domain)
    );

    // Check for IP addresses (not production)
    const isIpAddress = /^\d+\.\d+\.\d+\.\d+$/.test(hostname);

    return hasProductionTld && !isIpAddress;
  }

  /**
   * Check if environment is local
   */
  private isLocalEnvironment(hostname: string): boolean {
    const localIndicators = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '192.168.',
      '10.0.',
      '172.16.',
      '172.17.',
      '172.18.',
      '172.19.',
      '172.20.',
      '172.21.',
      '172.22.',
      '172.23.',
      '172.24.',
      '172.25.',
      '172.26.',
      '172.27.',
      '172.28.',
      '172.29.',
      '172.30.',
      '172.31.',
    ];

    return localIndicators.some(indicator => hostname.includes(indicator));
  }

  /**
   * Clear cached environment info
   */
  public clearCache(): void {
    this.cachedInfo = null;
    this.lastDetectionTime = 0;
  }

  /**
   * Force refresh environment detection
   */
  public refresh(): EnvironmentInfo {
    this.clearCache();
    return this.getEnvironmentInfo();
  }

  /**
   * Get environment-specific configuration
   */
  public getEnvironmentConfig() {
    const info = this.getEnvironmentInfo();
    
    return {
      environment: info.name,
      debug: info.isDevelopment || info.isStaging,
      logging: {
        level: info.isProduction ? 'error' : info.isTest ? 'error' : 'debug',
        enableConsole: !info.isProduction,
        enableRemote: info.isProduction || info.isStaging,
      },
      security: {
        requireHttps: info.isProduction || info.isStaging,
        enableCors: !info.isProduction,
        jwtExpiry: info.isProduction ? 2 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000, // 2h vs 24h
      },
      performance: {
        enableCaching: info.isProduction || info.isStaging,
        enableCompression: info.isProduction || info.isStaging,
        maxFileSize: info.isProduction ? 5 * 1024 * 1024 : 10 * 1024 * 1024, // 5MB vs 10MB
      },
      features: {
        enableDevTools: info.isDevelopment || info.isStaging,
        enableMockData: info.isDevelopment || info.isTest,
        enableAnalytics: info.isProduction || info.isStaging,
        enableErrorReporting: info.isProduction || info.isStaging,
      },
    };
  }

  /**
   * Validate environment configuration
   */
  public validateEnvironment(): { isValid: boolean; errors: string[]; warnings: string[] } {
    const info = this.getEnvironmentInfo();
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for conflicting environment indicators
    if (info.isProduction && info.isLocal) {
      warnings.push('Production environment detected on localhost - this may be incorrect');
    }

    if (info.isDevelopment && !info.isLocal && !info.isStaging) {
      warnings.push('Development environment detected on non-local host - this may be incorrect');
    }

    // Check for missing environment variables
    if (info.isProduction && !info.isLocal) {
      if (info.protocol === 'http:') {
        errors.push('Production environment should use HTTPS');
      }
    }

    // Check for test environment
    if (info.isTest && !info.isLocal) {
      warnings.push('Test environment detected on non-local host - this may be incorrect');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get environment-specific error messages
   */
  public getErrorMessages() {
    const info = this.getEnvironmentInfo();
    
    if (info.isDevelopment || info.isStaging) {
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
}

/**
 * Global environment detector instance
 */
export const environmentDetector = EnvironmentDetector.getInstance();

/**
 * Utility functions for environment detection
 */
export const envUtils = {
  /**
   * Get current environment name
   */
  getCurrentEnvironment: (): Environment => {
    return environmentDetector.getEnvironmentInfo().name;
  },

  /**
   * Check if current environment is development
   */
  isDevelopment: (): boolean => {
    return environmentDetector.getEnvironmentInfo().isDevelopment;
  },

  /**
   * Check if current environment is production
   */
  isProduction: (): boolean => {
    return environmentDetector.getEnvironmentInfo().isProduction;
  },

  /**
   * Check if current environment is staging
   */
  isStaging: (): boolean => {
    return environmentDetector.getEnvironmentInfo().isStaging;
  },

  /**
   * Check if current environment is test
   */
  isTest: (): boolean => {
    return environmentDetector.getEnvironmentInfo().isTest;
  },

  /**
   * Check if current environment is local
   */
  isLocal: (): boolean => {
    return environmentDetector.getEnvironmentInfo().isLocal;
  },

  /**
   * Get environment-specific configuration
   */
  getConfig: () => {
    return environmentDetector.getEnvironmentConfig();
  },

  /**
   * Validate current environment
   */
  validate: () => {
    return environmentDetector.validateEnvironment();
  },

  /**
   * Get environment-specific error messages
   */
  getErrorMessages: () => {
    return environmentDetector.getErrorMessages();
  },

  /**
   * Refresh environment detection
   */
  refresh: () => {
    return environmentDetector.refresh();
  },
};

/**
 * Environment detection hook for React components
 */
export function useEnvironment() {
  const [envInfo, setEnvInfo] = React.useState<EnvironmentInfo>(() => 
    environmentDetector.getEnvironmentInfo()
  );

  React.useEffect(() => {
    const refreshEnv = () => {
      setEnvInfo(environmentDetector.refresh());
    };

    // Refresh environment info on window focus
    window.addEventListener('focus', refreshEnv);
    
    // Refresh environment info periodically
    const interval = setInterval(refreshEnv, 30000); // Every 30 seconds

    return () => {
      window.removeEventListener('focus', refreshEnv);
      clearInterval(interval);
    };
  }, []);

  return envInfo;
}

// Export default instance
export default environmentDetector;
