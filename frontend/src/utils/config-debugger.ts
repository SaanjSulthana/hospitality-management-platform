/**
 * Configuration debugging and logging system
 */

import React from 'react';
import { EnvironmentConfig } from '../config/environment-loader';
import { EnvironmentInfo } from './environment-detector';
import { ValidationResult } from './config-validator-simple';

export interface DebugInfo {
  timestamp: string;
  environment: string;
  config: EnvironmentConfig;
  validation: ValidationResult;
  performance: {
    loadTime: number;
    memoryUsage?: number;
  };
  metadata: {
    userAgent: string;
    hostname: string;
    protocol: string;
    port: number | null;
  };
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
  timestamp: string;
  source: string;
}

/**
 * Configuration debugger and logger
 */
export class ConfigDebugger {
  private static instance: ConfigDebugger;
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private startTime: number = Date.now();

  private constructor() {}

  public static getInstance(): ConfigDebugger {
    if (!ConfigDebugger.instance) {
      ConfigDebugger.instance = new ConfigDebugger();
    }
    return ConfigDebugger.instance;
  }

  /**
   * Log a message
   */
  public log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any, source: string = 'ConfigDebugger'): void {
    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      source,
    };

    this.logs.push(entry);

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console logging based on level
    if (this.shouldLogToConsole(level)) {
      this.logToConsole(entry);
    }
  }

  /**
   * Debug log
   */
  public debug(message: string, data?: any, source?: string): void {
    this.log('debug', message, data, source);
  }

  /**
   * Info log
   */
  public info(message: string, data?: any, source?: string): void {
    this.log('info', message, data, source);
  }

  /**
   * Warning log
   */
  public warn(message: string, data?: any, source?: string): void {
    this.log('warn', message, data, source);
  }

  /**
   * Error log
   */
  public error(message: string, data?: any, source?: string): void {
    this.log('error', message, data, source);
  }

  /**
   * Log configuration loading
   */
  public logConfigLoad(config: EnvironmentConfig, envInfo: EnvironmentInfo, loadTime: number): void {
    this.info('Configuration loaded', {
      environment: envInfo.name,
      debug: config.debug,
      apiBaseUrl: config.api.baseUrl,
      loadTime,
    }, 'ConfigLoader');
  }

  /**
   * Log configuration validation
   */
  public logConfigValidation(validation: ValidationResult, config: EnvironmentConfig): void {
    if (validation.isValid) {
      this.info('Configuration validation passed', {
        score: validation.score,
        errors: validation.errors.length,
        warnings: validation.warnings.length,
      }, 'ConfigValidator');
    } else {
      this.error('Configuration validation failed', {
        score: validation.score,
        errors: validation.errors,
        warnings: validation.warnings,
      }, 'ConfigValidator');
    }
  }

  /**
   * Log environment detection
   */
  public logEnvironmentDetection(envInfo: EnvironmentInfo): void {
    this.info('Environment detected', {
      name: envInfo.name,
      isLocal: envInfo.isLocal,
      hostname: envInfo.hostname,
      protocol: envInfo.protocol,
    }, 'EnvironmentDetector');
  }

  /**
   * Get debug information
   */
  public getDebugInfo(config: EnvironmentConfig, envInfo: EnvironmentInfo, validation: ValidationResult): DebugInfo {
    const loadTime = Date.now() - this.startTime;
    
    return {
      timestamp: new Date().toISOString(),
      environment: envInfo.name,
      config,
      validation,
      performance: {
        loadTime,
        memoryUsage: this.getMemoryUsage(),
      },
      metadata: {
        userAgent: envInfo.userAgent,
        hostname: envInfo.hostname,
        protocol: envInfo.protocol,
        port: envInfo.port,
      },
    };
  }

  /**
   * Get all logs
   */
  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs by level
   */
  public getLogsByLevel(level: 'debug' | 'info' | 'warn' | 'error'): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Get logs by source
   */
  public getLogsBySource(source: string): LogEntry[] {
    return this.logs.filter(log => log.source === source);
  }

  /**
   * Clear logs
   */
  public clearLogs(): void {
    this.logs = [];
    this.info('Logs cleared', undefined, 'ConfigDebugger');
  }

  /**
   * Export logs as JSON
   */
  public exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Export debug info as JSON
   */
  public exportDebugInfo(config: EnvironmentConfig, envInfo: EnvironmentInfo, validation: ValidationResult): string {
    const debugInfo = this.getDebugInfo(config, envInfo, validation);
    return JSON.stringify(debugInfo, null, 2);
  }

  /**
   * Get configuration summary
   */
  public getConfigSummary(config: EnvironmentConfig): string {
    return `
Configuration Summary:
- Environment: ${config.name}
- Debug: ${config.debug}
- API Base URL: ${config.api.baseUrl}
- API Timeout: ${config.api.timeout}ms
- JWT Expiry: ${config.security.jwtExpiry}ms
- Refresh Expiry: ${config.security.refreshExpiry}ms
- HTTPS Required: ${config.security.requireHttps}
- CORS Enabled: ${config.security.enableCors}
- Caching Enabled: ${config.performance.enableCaching}
- Compression Enabled: ${config.performance.enableCompression}
- Max File Size: ${config.performance.maxFileSize} bytes
- Dev Tools: ${config.features.enableDevTools}
- Mock Data: ${config.features.enableMockData}
- Analytics: ${config.features.enableAnalytics}
- Error Reporting: ${config.features.enableErrorReporting}
- PWA: ${config.features.enablePwa}
- Offline Mode: ${config.features.enableOfflineMode}
- Theme: ${config.ui.theme}
- Animations: ${config.ui.enableAnimations}
- Performance Monitoring: ${config.monitoring.enablePerformanceMonitoring}
- Error Tracking: ${config.monitoring.enableErrorTracking}
- User Analytics: ${config.monitoring.enableUserAnalytics}
- Sample Rate: ${config.monitoring.sampleRate}
    `.trim();
  }

  /**
   * Get environment summary
   */
  public getEnvironmentSummary(envInfo: EnvironmentInfo): string {
    return `
Environment Summary:
- Name: ${envInfo.name}
- Development: ${envInfo.isDevelopment}
- Production: ${envInfo.isProduction}
- Staging: ${envInfo.isStaging}
- Test: ${envInfo.isTest}
- Local: ${envInfo.isLocal}
- Server: ${envInfo.isServer}
- Client: ${envInfo.isClient}
- Node Env: ${envInfo.nodeEnv}
- Vite Env: ${envInfo.viteEnv}
- Hostname: ${envInfo.hostname}
- Protocol: ${envInfo.protocol}
- Port: ${envInfo.port}
- User Agent: ${envInfo.userAgent}
- Timestamp: ${envInfo.timestamp}
    `.trim();
  }

  /**
   * Get validation summary
   */
  public getValidationSummary(validation: ValidationResult): string {
    return `
Validation Summary:
- Valid: ${validation.isValid}
- Score: ${validation.score}/100
- Errors: ${validation.errors.length}
- Warnings: ${validation.warnings.length}

${validation.errors.length > 0 ? `Errors:\n${validation.errors.map(e => `  ❌ ${e}`).join('\n')}` : ''}
${validation.warnings.length > 0 ? `Warnings:\n${validation.warnings.map(w => `  ⚠️  ${w}`).join('\n')}` : ''}
    `.trim();
  }

  /**
   * Check if should log to console
   */
  private shouldLogToConsole(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    // In development, log everything
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      return true;
    }

    // In production, only log warnings and errors
    return level === 'warn' || level === 'error';
  }

  /**
   * Log to console
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const prefix = `[${timestamp}] [${entry.source}]`;
    
    switch (entry.level) {
      case 'debug':
        console.debug(`${prefix} ${entry.message}`, entry.data);
        break;
      case 'info':
        console.info(`${prefix} ${entry.message}`, entry.data);
        break;
      case 'warn':
        console.warn(`${prefix} ${entry.message}`, entry.data);
        break;
      case 'error':
        console.error(`${prefix} ${entry.message}`, entry.data);
        break;
    }
  }

  /**
   * Get memory usage (if available)
   */
  private getMemoryUsage(): number | undefined {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return undefined;
  }

  /**
   * Create a debug report
   */
  public createDebugReport(config: EnvironmentConfig, envInfo: EnvironmentInfo, validation: ValidationResult): string {
    const debugInfo = this.getDebugInfo(config, envInfo, validation);
    
    return `
# Configuration Debug Report

## Environment Information
${this.getEnvironmentSummary(envInfo)}

## Configuration Details
${this.getConfigSummary(config)}

## Validation Results
${this.getValidationSummary(validation)}

## Performance Metrics
- Load Time: ${debugInfo.performance.loadTime}ms
- Memory Usage: ${debugInfo.performance.memoryUsage ? `${Math.round(debugInfo.performance.memoryUsage / 1024 / 1024)}MB` : 'N/A'}

## Recent Logs
${this.logs.slice(-10).map(log => `[${log.level.toUpperCase()}] ${log.message}`).join('\n')}

## Timestamp
${debugInfo.timestamp}
    `.trim();
  }
}

/**
 * Global configuration debugger instance
 */
export const configDebugger = ConfigDebugger.getInstance();

/**
 * Utility functions for configuration debugging
 */
export const debugUtils = {
  /**
   * Log configuration load
   */
  logConfigLoad: (config: EnvironmentConfig, envInfo: EnvironmentInfo, loadTime: number) => {
    configDebugger.logConfigLoad(config, envInfo, loadTime);
  },

  /**
   * Log configuration validation
   */
  logConfigValidation: (validation: ValidationResult, config: EnvironmentConfig) => {
    configDebugger.logConfigValidation(validation, config);
  },

  /**
   * Log environment detection
   */
  logEnvironmentDetection: (envInfo: EnvironmentInfo) => {
    configDebugger.logEnvironmentDetection(envInfo);
  },

  /**
   * Get debug info
   */
  getDebugInfo: (config: EnvironmentConfig, envInfo: EnvironmentInfo, validation: ValidationResult) => {
    return configDebugger.getDebugInfo(config, envInfo, validation);
  },

  /**
   * Create debug report
   */
  createDebugReport: (config: EnvironmentConfig, envInfo: EnvironmentInfo, validation: ValidationResult) => {
    return configDebugger.createDebugReport(config, envInfo, validation);
  },

  /**
   * Export logs
   */
  exportLogs: () => {
    return configDebugger.exportLogs();
  },

  /**
   * Clear logs
   */
  clearLogs: () => {
    configDebugger.clearLogs();
  },
};

/**
 * Configuration debugging hook for React components
 */
export function useConfigDebugging(config: EnvironmentConfig, envInfo: EnvironmentInfo, validation: ValidationResult) {
  const [debugInfo, setDebugInfo] = React.useState<DebugInfo>(() => 
    configDebugger.getDebugInfo(config, envInfo, validation)
  );

  React.useEffect(() => {
    const info = configDebugger.getDebugInfo(config, envInfo, validation);
    setDebugInfo(info);
  }, [config, envInfo, validation]);

  return {
    debugInfo,
    logs: configDebugger.getLogs(),
    summary: configDebugger.getConfigSummary(config),
    report: configDebugger.createDebugReport(config, envInfo, validation),
  };
}

// Export default instance
export default configDebugger;
