/**
 * Configuration health check system
 */

import { EnvironmentConfig } from '../config/environment-loader';
import { EnvironmentInfo } from './environment-detector';
import { ValidationResult } from './config-validator-simple';

export interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  score: number; // 0-100
  checks: HealthCheck[];
  summary: string;
  timestamp: string;
  recommendations: string[];
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warning' | 'fail' | 'skip';
  message: string;
  details?: any;
  impact: 'low' | 'medium' | 'high' | 'critical';
  category: 'security' | 'performance' | 'functionality' | 'compliance';
}

export interface HealthCheckConfig {
  enabled: boolean;
  timeout: number;
  retryAttempts: number;
  criticalThreshold: number;
  warningThreshold: number;
}

/**
 * Configuration health checker
 */
export class ConfigHealthChecker {
  private static instance: ConfigHealthChecker;
  private healthCheckConfig: HealthCheckConfig;

  private constructor() {
    this.healthCheckConfig = {
      enabled: true,
      timeout: 5000, // 5 seconds
      retryAttempts: 3,
      criticalThreshold: 70, // Below 70% is critical
      warningThreshold: 85, // Below 85% is warning
    };
  }

  public static getInstance(): ConfigHealthChecker {
    if (!ConfigHealthChecker.instance) {
      ConfigHealthChecker.instance = new ConfigHealthChecker();
    }
    return ConfigHealthChecker.instance;
  }

  /**
   * Perform comprehensive health check
   */
  public async performHealthCheck(
    config: EnvironmentConfig,
    envInfo: EnvironmentInfo,
    validation: ValidationResult
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checks: HealthCheck[] = [];

    // Run all health checks
    checks.push(...this.checkSecurityHealth(config, envInfo));
    checks.push(...this.checkPerformanceHealth(config, envInfo));
    checks.push(...this.checkFunctionalityHealth(config, envInfo));
    checks.push(...this.checkComplianceHealth(config, envInfo));
    checks.push(...this.checkValidationHealth(validation));

    // Calculate overall health score
    const score = this.calculateHealthScore(checks);
    
    // Determine overall status
    const status = this.determineHealthStatus(score);
    
    // Generate summary
    const summary = this.generateHealthSummary(checks, score, status);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(checks, config, envInfo);

    return {
      status,
      score,
      checks,
      summary,
      timestamp: new Date().toISOString(),
      recommendations,
    };
  }

  /**
   * Check security health
   */
  private checkSecurityHealth(config: EnvironmentConfig, envInfo: EnvironmentInfo): HealthCheck[] {
    const checks: HealthCheck[] = [];

    // HTTPS requirement check
    checks.push({
      name: 'HTTPS Requirement',
      status: this.checkHttpsRequirement(config, envInfo),
      message: this.getHttpsMessage(config, envInfo),
      impact: 'high',
      category: 'security',
      details: {
        requireHttps: config.security.requireHttps,
        isProduction: envInfo.isProduction,
        protocol: envInfo.protocol,
      },
    });

    // CORS configuration check
    checks.push({
      name: 'CORS Configuration',
      status: this.checkCorsConfiguration(config, envInfo),
      message: this.getCorsMessage(config, envInfo),
      impact: 'medium',
      category: 'security',
      details: {
        enableCors: config.security.enableCors,
        allowedOrigins: config.security.allowedOrigins,
        isProduction: envInfo.isProduction,
      },
    });

    // JWT security check
    checks.push({
      name: 'JWT Security',
      status: this.checkJwtSecurity(config),
      message: this.getJwtMessage(config),
      impact: 'high',
      category: 'security',
      details: {
        jwtExpiry: config.security.jwtExpiry,
        refreshExpiry: config.security.refreshExpiry,
        jwtExpiryHours: Math.round(config.security.jwtExpiry / (1000 * 60 * 60)),
        refreshExpiryDays: Math.round(config.security.refreshExpiry / (1000 * 60 * 60 * 24)),
      },
    });

    // API security check
    checks.push({
      name: 'API Security',
      status: this.checkApiSecurity(config),
      message: this.getApiSecurityMessage(config),
      impact: 'medium',
      category: 'security',
      details: {
        baseUrl: config.api.baseUrl,
        timeout: config.api.timeout,
        retryAttempts: config.api.retryAttempts,
      },
    });

    return checks;
  }

  /**
   * Check performance health
   */
  private checkPerformanceHealth(config: EnvironmentConfig, envInfo: EnvironmentInfo): HealthCheck[] {
    const checks: HealthCheck[] = [];

    // Caching configuration check
    checks.push({
      name: 'Caching Configuration',
      status: this.checkCachingConfiguration(config, envInfo),
      message: this.getCachingMessage(config, envInfo),
      impact: 'medium',
      category: 'performance',
      details: {
        enableCaching: config.performance.enableCaching,
        cacheTimeout: config.performance.cacheTimeout,
        isProduction: envInfo.isProduction,
      },
    });

    // Compression configuration check
    checks.push({
      name: 'Compression Configuration',
      status: this.checkCompressionConfiguration(config, envInfo),
      message: this.getCompressionMessage(config, envInfo),
      impact: 'medium',
      category: 'performance',
      details: {
        enableCompression: config.performance.enableCompression,
        isProduction: envInfo.isProduction,
      },
    });

    // File size limits check
    checks.push({
      name: 'File Size Limits',
      status: this.checkFileSizeLimits(config),
      message: this.getFileSizeMessage(config),
      impact: 'low',
      category: 'performance',
      details: {
        maxFileSize: config.performance.maxFileSize,
        maxFileSizeMB: Math.round(config.performance.maxFileSize / (1024 * 1024)),
      },
    });

    // API timeout check
    checks.push({
      name: 'API Timeout Configuration',
      status: this.checkApiTimeout(config),
      message: this.getApiTimeoutMessage(config),
      impact: 'medium',
      category: 'performance',
      details: {
        timeout: config.api.timeout,
        timeoutSeconds: Math.round(config.api.timeout / 1000),
      },
    });

    return checks;
  }

  /**
   * Check functionality health
   */
  private checkFunctionalityHealth(config: EnvironmentConfig, envInfo: EnvironmentInfo): HealthCheck[] {
    const checks: HealthCheck[] = [];

    // Feature flags check
    checks.push({
      name: 'Feature Flags',
      status: this.checkFeatureFlags(config, envInfo),
      message: this.getFeatureFlagsMessage(config, envInfo),
      impact: 'low',
      category: 'functionality',
      details: {
        enableDevTools: config.features.enableDevTools,
        enableMockData: config.features.enableMockData,
        enableAnalytics: config.features.enableAnalytics,
        enableErrorReporting: config.features.enableErrorReporting,
        environment: envInfo.name,
      },
    });

    // Database configuration check
    checks.push({
      name: 'Database Configuration',
      status: this.checkDatabaseConfiguration(config),
      message: this.getDatabaseMessage(config),
      impact: 'high',
      category: 'functionality',
      details: {
        name: config.database.name,
        maxConnections: config.database.maxConnections,
        connectionTimeout: config.database.connectionTimeout,
        queryTimeout: config.database.queryTimeout,
      },
    });

    // Logging configuration check
    checks.push({
      name: 'Logging Configuration',
      status: this.checkLoggingConfiguration(config, envInfo),
      message: this.getLoggingMessage(config, envInfo),
      impact: 'medium',
      category: 'functionality',
      details: {
        level: config.logging.level,
        enableConsole: config.logging.enableConsole,
        enableRemote: config.logging.enableRemote,
        environment: envInfo.name,
      },
    });

    return checks;
  }

  /**
   * Check compliance health
   */
  private checkComplianceHealth(config: EnvironmentConfig, envInfo: EnvironmentInfo): HealthCheck[] {
    const checks: HealthCheck[] = [];

    // Environment compliance check
    checks.push({
      name: 'Environment Compliance',
      status: this.checkEnvironmentCompliance(config, envInfo),
      message: this.getEnvironmentComplianceMessage(config, envInfo),
      impact: 'high',
      category: 'compliance',
      details: {
        environment: envInfo.name,
        debug: config.debug,
        enableDevTools: config.features.enableDevTools,
        enableMockData: config.features.enableMockData,
      },
    });

    // Monitoring configuration check
    checks.push({
      name: 'Monitoring Configuration',
      status: this.checkMonitoringConfiguration(config, envInfo),
      message: this.getMonitoringMessage(config, envInfo),
      impact: 'medium',
      category: 'compliance',
      details: {
        enablePerformanceMonitoring: config.monitoring.enablePerformanceMonitoring,
        enableErrorTracking: config.monitoring.enableErrorTracking,
        enableUserAnalytics: config.monitoring.enableUserAnalytics,
        sampleRate: config.monitoring.sampleRate,
        environment: envInfo.name,
      },
    });

    return checks;
  }

  /**
   * Check validation health
   */
  private checkValidationHealth(validation: ValidationResult): HealthCheck[] {
    const checks: HealthCheck[] = [];

    // Validation result check
    checks.push({
      name: 'Configuration Validation',
      status: validation.isValid ? 'pass' : 'fail',
      message: validation.isValid 
        ? `Configuration validation passed with score ${validation.score}/100`
        : `Configuration validation failed with score ${validation.score}/100`,
      impact: 'critical',
      category: 'compliance',
      details: {
        isValid: validation.isValid,
        score: validation.score,
        errors: validation.errors,
        warnings: validation.warnings,
      },
    });

    // Validation score check
    checks.push({
      name: 'Validation Score',
      status: this.checkValidationScore(validation.score),
      message: this.getValidationScoreMessage(validation.score),
      impact: 'high',
      category: 'compliance',
      details: {
        score: validation.score,
        threshold: this.healthCheckConfig.criticalThreshold,
      },
    });

    return checks;
  }

  /**
   * Check HTTPS requirement
   */
  private checkHttpsRequirement(config: EnvironmentConfig, envInfo: EnvironmentInfo): 'pass' | 'warning' | 'fail' {
    if (envInfo.isProduction) {
      return config.security.requireHttps ? 'pass' : 'fail';
    }
    return 'pass';
  }

  /**
   * Check CORS configuration
   */
  private checkCorsConfiguration(config: EnvironmentConfig, envInfo: EnvironmentInfo): 'pass' | 'warning' | 'fail' {
    if (envInfo.isProduction) {
      if (config.security.enableCors && config.security.allowedOrigins.includes('*')) {
        return 'warning';
      }
      return 'pass';
    }
    return 'pass';
  }

  /**
   * Check JWT security
   */
  private checkJwtSecurity(config: EnvironmentConfig): 'pass' | 'warning' | 'fail' {
    if (config.security.jwtExpiry <= 0 || config.security.refreshExpiry <= 0) {
      return 'fail';
    }
    if (config.security.refreshExpiry <= config.security.jwtExpiry) {
      return 'fail';
    }
    if (config.security.jwtExpiry > 24 * 60 * 60 * 1000) { // More than 24 hours
      return 'warning';
    }
    return 'pass';
  }

  /**
   * Check API security
   */
  private checkApiSecurity(config: EnvironmentConfig): 'pass' | 'warning' | 'fail' {
    if (!config.api.baseUrl || config.api.timeout <= 0) {
      return 'fail';
    }
    if (config.api.retryAttempts < 0 || config.api.retryDelay <= 0) {
      return 'fail';
    }
    return 'pass';
  }

  /**
   * Check caching configuration
   */
  private checkCachingConfiguration(config: EnvironmentConfig, envInfo: EnvironmentInfo): 'pass' | 'warning' | 'fail' {
    if (envInfo.isProduction && !config.performance.enableCaching) {
      return 'warning';
    }
    if (config.performance.cacheTimeout < 0) {
      return 'fail';
    }
    return 'pass';
  }

  /**
   * Check compression configuration
   */
  private checkCompressionConfiguration(config: EnvironmentConfig, envInfo: EnvironmentInfo): 'pass' | 'warning' | 'fail' {
    if (envInfo.isProduction && !config.performance.enableCompression) {
      return 'warning';
    }
    return 'pass';
  }

  /**
   * Check file size limits
   */
  private checkFileSizeLimits(config: EnvironmentConfig): 'pass' | 'warning' | 'fail' {
    if (config.performance.maxFileSize <= 0) {
      return 'fail';
    }
    if (config.performance.maxFileSize > 100 * 1024 * 1024) { // More than 100MB
      return 'warning';
    }
    return 'pass';
  }

  /**
   * Check API timeout
   */
  private checkApiTimeout(config: EnvironmentConfig): 'pass' | 'warning' | 'fail' {
    if (config.api.timeout <= 0) {
      return 'fail';
    }
    if (config.api.timeout > 120000) { // More than 2 minutes
      return 'warning';
    }
    return 'pass';
  }

  /**
   * Check feature flags
   */
  private checkFeatureFlags(config: EnvironmentConfig, envInfo: EnvironmentInfo): 'pass' | 'warning' | 'fail' {
    if (envInfo.isProduction) {
      if (config.features.enableDevTools || config.features.enableMockData) {
        return 'warning';
      }
    }
    return 'pass';
  }

  /**
   * Check database configuration
   */
  private checkDatabaseConfiguration(config: EnvironmentConfig): 'pass' | 'warning' | 'fail' {
    if (!config.database.name || 
        config.database.maxConnections <= 0 || 
        config.database.connectionTimeout <= 0 || 
        config.database.queryTimeout <= 0) {
      return 'fail';
    }
    return 'pass';
  }

  /**
   * Check logging configuration
   */
  private checkLoggingConfiguration(config: EnvironmentConfig, envInfo: EnvironmentInfo): 'pass' | 'warning' | 'fail' {
    if (!['debug', 'info', 'warn', 'error'].includes(config.logging.level)) {
      return 'fail';
    }
    if (envInfo.isProduction && config.logging.enableConsole) {
      return 'warning';
    }
    return 'pass';
  }

  /**
   * Check environment compliance
   */
  private checkEnvironmentCompliance(config: EnvironmentConfig, envInfo: EnvironmentInfo): 'pass' | 'warning' | 'fail' {
    if (envInfo.isProduction) {
      if (config.debug || config.features.enableDevTools || config.features.enableMockData) {
        return 'fail';
      }
    }
    return 'pass';
  }

  /**
   * Check monitoring configuration
   */
  private checkMonitoringConfiguration(config: EnvironmentConfig, envInfo: EnvironmentInfo): 'pass' | 'warning' | 'fail' {
    if (envInfo.isProduction) {
      if (!config.monitoring.enableErrorTracking || !config.features.enableErrorReporting) {
        return 'warning';
      }
    }
    if (config.monitoring.sampleRate < 0 || config.monitoring.sampleRate > 1) {
      return 'fail';
    }
    return 'pass';
  }

  /**
   * Check validation score
   */
  private checkValidationScore(score: number): 'pass' | 'warning' | 'fail' {
    if (score >= this.healthCheckConfig.warningThreshold) {
      return 'pass';
    } else if (score >= this.healthCheckConfig.criticalThreshold) {
      return 'warning';
    } else {
      return 'fail';
    }
  }

  /**
   * Get HTTPS message
   */
  private getHttpsMessage(config: EnvironmentConfig, envInfo: EnvironmentInfo): string {
    if (envInfo.isProduction) {
      return config.security.requireHttps 
        ? 'HTTPS is properly required for production'
        : 'HTTPS should be required for production security';
    }
    return 'HTTPS configuration is appropriate for development';
  }

  /**
   * Get CORS message
   */
  private getCorsMessage(config: EnvironmentConfig, envInfo: EnvironmentInfo): string {
    if (envInfo.isProduction && config.security.enableCors && config.security.allowedOrigins.includes('*')) {
      return 'CORS is enabled with wildcard origin in production - consider restricting origins';
    }
    return 'CORS configuration is appropriate';
  }

  /**
   * Get JWT message
   */
  private getJwtMessage(config: EnvironmentConfig): string {
    const jwtHours = Math.round(config.security.jwtExpiry / (1000 * 60 * 60));
    const refreshDays = Math.round(config.security.refreshExpiry / (1000 * 60 * 60 * 24));
    
    if (config.security.jwtExpiry <= 0 || config.security.refreshExpiry <= 0) {
      return 'JWT expiry values must be positive';
    }
    if (config.security.refreshExpiry <= config.security.jwtExpiry) {
      return 'Refresh token expiry must be greater than JWT expiry';
    }
    if (jwtHours > 24) {
      return `JWT expiry is ${jwtHours} hours - consider shorter duration for security`;
    }
    return `JWT expires in ${jwtHours} hours, refresh expires in ${refreshDays} days`;
  }

  /**
   * Get API security message
   */
  private getApiSecurityMessage(config: EnvironmentConfig): string {
    if (!config.api.baseUrl) {
      return 'API base URL is required';
    }
    if (config.api.timeout <= 0) {
      return 'API timeout must be positive';
    }
    return `API configured with ${config.api.timeout}ms timeout and ${config.api.retryAttempts} retry attempts`;
  }

  /**
   * Get caching message
   */
  private getCachingMessage(config: EnvironmentConfig, envInfo: EnvironmentInfo): string {
    if (envInfo.isProduction && !config.performance.enableCaching) {
      return 'Caching should be enabled in production for better performance';
    }
    if (config.performance.cacheTimeout < 0) {
      return 'Cache timeout cannot be negative';
    }
    return config.performance.enableCaching 
      ? `Caching enabled with ${config.performance.cacheTimeout}ms timeout`
      : 'Caching disabled';
  }

  /**
   * Get compression message
   */
  private getCompressionMessage(config: EnvironmentConfig, envInfo: EnvironmentInfo): string {
    if (envInfo.isProduction && !config.performance.enableCompression) {
      return 'Compression should be enabled in production for better performance';
    }
    return config.performance.enableCompression ? 'Compression enabled' : 'Compression disabled';
  }

  /**
   * Get file size message
   */
  private getFileSizeMessage(config: EnvironmentConfig): string {
    const sizeMB = Math.round(config.performance.maxFileSize / (1024 * 1024));
    if (config.performance.maxFileSize <= 0) {
      return 'Max file size must be positive';
    }
    if (config.performance.maxFileSize > 100 * 1024 * 1024) {
      return `Max file size is ${sizeMB}MB - consider reducing for better performance`;
    }
    return `Max file size is ${sizeMB}MB`;
  }

  /**
   * Get API timeout message
   */
  private getApiTimeoutMessage(config: EnvironmentConfig): string {
    const timeoutSeconds = Math.round(config.api.timeout / 1000);
    if (config.api.timeout <= 0) {
      return 'API timeout must be positive';
    }
    if (config.api.timeout > 120000) {
      return `API timeout is ${timeoutSeconds}s - consider reducing for better responsiveness`;
    }
    return `API timeout is ${timeoutSeconds}s`;
  }

  /**
   * Get feature flags message
   */
  private getFeatureFlagsMessage(config: EnvironmentConfig, envInfo: EnvironmentInfo): string {
    if (envInfo.isProduction) {
      const issues = [];
      if (config.features.enableDevTools) issues.push('dev tools');
      if (config.features.enableMockData) issues.push('mock data');
      if (issues.length > 0) {
        return `Production environment has ${issues.join(' and ')} enabled - should be disabled`;
      }
    }
    return 'Feature flags are appropriately configured';
  }

  /**
   * Get database message
   */
  private getDatabaseMessage(config: EnvironmentConfig): string {
    if (!config.database.name) {
      return 'Database name is required';
    }
    if (config.database.maxConnections <= 0) {
      return 'Database max connections must be positive';
    }
    return `Database '${config.database.name}' configured with ${config.database.maxConnections} max connections`;
  }

  /**
   * Get logging message
   */
  private getLoggingMessage(config: EnvironmentConfig, envInfo: EnvironmentInfo): string {
    if (!['debug', 'info', 'warn', 'error'].includes(config.logging.level)) {
      return 'Invalid logging level';
    }
    if (envInfo.isProduction && config.logging.enableConsole) {
      return 'Console logging should be disabled in production';
    }
    return `Logging level: ${config.logging.level}, Console: ${config.logging.enableConsole}, Remote: ${config.logging.enableRemote}`;
  }

  /**
   * Get environment compliance message
   */
  private getEnvironmentComplianceMessage(config: EnvironmentConfig, envInfo: EnvironmentInfo): string {
    if (envInfo.isProduction) {
      const issues = [];
      if (config.debug) issues.push('debug mode');
      if (config.features.enableDevTools) issues.push('dev tools');
      if (config.features.enableMockData) issues.push('mock data');
      if (issues.length > 0) {
        return `Production environment has ${issues.join(', ')} enabled - should be disabled`;
      }
    }
    return 'Environment compliance is appropriate';
  }

  /**
   * Get monitoring message
   */
  private getMonitoringMessage(config: EnvironmentConfig, envInfo: EnvironmentInfo): string {
    if (envInfo.isProduction && !config.monitoring.enableErrorTracking) {
      return 'Error tracking should be enabled in production';
    }
    if (config.monitoring.sampleRate < 0 || config.monitoring.sampleRate > 1) {
      return 'Monitoring sample rate must be between 0 and 1';
    }
    return `Monitoring: Performance: ${config.monitoring.enablePerformanceMonitoring}, Error: ${config.monitoring.enableErrorTracking}, Sample: ${config.monitoring.sampleRate}`;
  }

  /**
   * Get validation score message
   */
  private getValidationScoreMessage(score: number): string {
    if (score >= this.healthCheckConfig.warningThreshold) {
      return `Validation score ${score}/100 is excellent`;
    } else if (score >= this.healthCheckConfig.criticalThreshold) {
      return `Validation score ${score}/100 needs improvement`;
    } else {
      return `Validation score ${score}/100 is critical - immediate attention required`;
    }
  }

  /**
   * Calculate health score
   */
  private calculateHealthScore(checks: HealthCheck[]): number {
    if (checks.length === 0) return 0;

    let totalScore = 0;
    let totalWeight = 0;

    for (const check of checks) {
      let score = 0;
      let weight = 1;

      switch (check.status) {
        case 'pass':
          score = 100;
          break;
        case 'warning':
          score = 70;
          break;
        case 'fail':
          score = 0;
          break;
        case 'skip':
          continue;
      }

      // Weight by impact
      switch (check.impact) {
        case 'critical':
          weight = 4;
          break;
        case 'high':
          weight = 3;
          break;
        case 'medium':
          weight = 2;
          break;
        case 'low':
          weight = 1;
          break;
      }

      totalScore += score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  }

  /**
   * Determine health status
   */
  private determineHealthStatus(score: number): 'healthy' | 'warning' | 'critical' | 'unknown' {
    if (score >= this.healthCheckConfig.warningThreshold) {
      return 'healthy';
    } else if (score >= this.healthCheckConfig.criticalThreshold) {
      return 'warning';
    } else if (score > 0) {
      return 'critical';
    } else {
      return 'unknown';
    }
  }

  /**
   * Generate health summary
   */
  private generateHealthSummary(checks: HealthCheck[], score: number, status: string): string {
    const passCount = checks.filter(c => c.status === 'pass').length;
    const warningCount = checks.filter(c => c.status === 'warning').length;
    const failCount = checks.filter(c => c.status === 'fail').length;
    const skipCount = checks.filter(c => c.status === 'skip').length;

    return `Health Status: ${status.toUpperCase()} (${score}/100). ` +
           `Checks: ${passCount} passed, ${warningCount} warnings, ${failCount} failed, ${skipCount} skipped.`;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(checks: HealthCheck[], config: EnvironmentConfig, envInfo: EnvironmentInfo): string[] {
    const recommendations: string[] = [];

    for (const check of checks) {
      if (check.status === 'fail' || check.status === 'warning') {
        switch (check.name) {
          case 'HTTPS Requirement':
            if (envInfo.isProduction && !config.security.requireHttps) {
              recommendations.push('Enable HTTPS requirement for production security');
            }
            break;
          case 'CORS Configuration':
            if (envInfo.isProduction && config.security.enableCors && config.security.allowedOrigins.includes('*')) {
              recommendations.push('Restrict CORS origins in production instead of using wildcard');
            }
            break;
          case 'JWT Security':
            if (config.security.jwtExpiry > 24 * 60 * 60 * 1000) {
              recommendations.push('Consider reducing JWT expiry time for better security');
            }
            break;
          case 'Caching Configuration':
            if (envInfo.isProduction && !config.performance.enableCaching) {
              recommendations.push('Enable caching in production for better performance');
            }
            break;
          case 'Compression Configuration':
            if (envInfo.isProduction && !config.performance.enableCompression) {
              recommendations.push('Enable compression in production for better performance');
            }
            break;
          case 'Feature Flags':
            if (envInfo.isProduction && (config.features.enableDevTools || config.features.enableMockData)) {
              recommendations.push('Disable development tools and mock data in production');
            }
            break;
          case 'Environment Compliance':
            if (envInfo.isProduction && config.debug) {
              recommendations.push('Disable debug mode in production');
            }
            break;
          case 'Monitoring Configuration':
            if (envInfo.isProduction && !config.monitoring.enableErrorTracking) {
              recommendations.push('Enable error tracking in production for monitoring');
            }
            break;
        }
      }
    }

    return recommendations;
  }

  /**
   * Get health check configuration
   */
  public getHealthCheckConfig(): HealthCheckConfig {
    return { ...this.healthCheckConfig };
  }

  /**
   * Update health check configuration
   */
  public updateHealthCheckConfig(config: Partial<HealthCheckConfig>): void {
    this.healthCheckConfig = { ...this.healthCheckConfig, ...config };
  }
}

/**
 * Global configuration health checker instance
 */
export const configHealthChecker = ConfigHealthChecker.getInstance();

/**
 * Utility functions for configuration health checking
 */
export const healthCheckUtils = {
  /**
   * Perform health check
   */
  performHealthCheck: (config: EnvironmentConfig, envInfo: EnvironmentInfo, validation: ValidationResult) => 
    configHealthChecker.performHealthCheck(config, envInfo, validation),

  /**
   * Get health check configuration
   */
  getConfig: () => configHealthChecker.getHealthCheckConfig(),

  /**
   * Update health check configuration
   */
  updateConfig: (config: Partial<HealthCheckConfig>) => configHealthChecker.updateHealthCheckConfig(config),
};

// Export default instance
export default configHealthChecker;
