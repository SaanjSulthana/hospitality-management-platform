/**
 * Configuration performance monitoring system
 */

import { EnvironmentConfig } from '../config/environment-loader';
import { EnvironmentInfo } from './environment-detector';

export interface PerformanceMetrics {
  timestamp: string;
  operation: string;
  duration: number;
  memoryUsage?: number;
  cpuUsage?: number;
  success: boolean;
  error?: string;
  metadata?: any;
}

export interface PerformanceReport {
  period: string;
  startTime: string;
  endTime: string;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  p95Duration: number;
  p99Duration: number;
  averageMemoryUsage?: number;
  maxMemoryUsage?: number;
  operations: PerformanceMetrics[];
  summary: string;
}

export interface PerformanceThresholds {
  maxDuration: number;
  maxMemoryUsage: number;
  maxErrorRate: number;
  minSuccessRate: number;
}

export interface PerformanceAlert {
  id: string;
  timestamp: string;
  type: 'duration' | 'memory' | 'error_rate' | 'success_rate';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  operation: string;
  resolved: boolean;
  resolvedAt?: string;
}

/**
 * Configuration performance monitor
 */
export class ConfigPerformanceMonitor {
  private static instance: ConfigPerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private thresholds: PerformanceThresholds;
  private maxMetrics: number = 10000;
  private maxAlerts: number = 1000;

  private constructor() {
    this.thresholds = {
      maxDuration: 1000, // 1 second
      maxMemoryUsage: 50 * 1024 * 1024, // 50MB
      maxErrorRate: 0.05, // 5%
      minSuccessRate: 0.95, // 95%
    };
  }

  public static getInstance(): ConfigPerformanceMonitor {
    if (!ConfigPerformanceMonitor.instance) {
      ConfigPerformanceMonitor.instance = new ConfigPerformanceMonitor();
    }
    return ConfigPerformanceMonitor.instance;
  }

  /**
   * Start performance monitoring for an operation
   */
  public startOperation(operation: string, metadata?: any): () => void {
    const startTime = Date.now();
    const startMemory = this.getMemoryUsage();

    return () => {
      const endTime = Date.now();
      const endMemory = this.getMemoryUsage();
      const duration = endTime - startTime;
      const memoryUsage = endMemory ? endMemory - (startMemory || 0) : undefined;

      this.recordMetric({
        timestamp: new Date().toISOString(),
        operation,
        duration,
        memoryUsage,
        success: true,
        metadata,
      });
    };
  }

  /**
   * Record a performance metric
   */
  public recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);

    // Keep only the last maxMetrics entries
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Check for performance issues
    this.checkPerformanceThresholds(metric);

    // Log performance issues
    if (this.shouldLogMetric(metric)) {
      this.logPerformanceIssue(metric);
    }
  }

  /**
   * Record a failed operation
   */
  public recordFailure(operation: string, error: string, duration: number, metadata?: any): void {
    this.recordMetric({
      timestamp: new Date().toISOString(),
      operation,
      duration,
      success: false,
      error,
      metadata,
    });
  }

  /**
   * Get performance metrics for a specific operation
   */
  public getMetricsForOperation(operation: string, limit?: number): PerformanceMetrics[] {
    const filtered = this.metrics.filter(m => m.operation === operation);
    return limit ? filtered.slice(-limit) : filtered;
  }

  /**
   * Get performance metrics for a time period
   */
  public getMetricsForPeriod(startTime: Date, endTime: Date): PerformanceMetrics[] {
    return this.metrics.filter(m => {
      const metricTime = new Date(m.timestamp);
      return metricTime >= startTime && metricTime <= endTime;
    });
  }

  /**
   * Generate performance report
   */
  public generateReport(period: string, startTime: Date, endTime: Date): PerformanceReport {
    const periodMetrics = this.getMetricsForPeriod(startTime, endTime);
    
    if (periodMetrics.length === 0) {
      return {
        period,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        p95Duration: 0,
        p99Duration: 0,
        operations: [],
        summary: 'No operations recorded in this period',
      };
    }

    const successfulOperations = periodMetrics.filter(m => m.success).length;
    const failedOperations = periodMetrics.length - successfulOperations;
    const durations = periodMetrics.map(m => m.duration).sort((a, b) => a - b);
    const memoryUsages = periodMetrics.map(m => m.memoryUsage).filter(m => m !== undefined) as number[];

    const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minDuration = durations[0];
    const maxDuration = durations[durations.length - 1];
    const p95Duration = durations[Math.floor(durations.length * 0.95)];
    const p99Duration = durations[Math.floor(durations.length * 0.99)];

    const averageMemoryUsage = memoryUsages.length > 0 
      ? memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length 
      : undefined;
    const maxMemoryUsage = memoryUsages.length > 0 ? Math.max(...memoryUsages) : undefined;

    const successRate = successfulOperations / periodMetrics.length;
    const errorRate = failedOperations / periodMetrics.length;

    let summary = `Performance Report for ${period}: `;
    summary += `${periodMetrics.length} operations, `;
    summary += `${Math.round(successRate * 100)}% success rate, `;
    summary += `avg ${Math.round(averageDuration)}ms duration`;

    if (averageMemoryUsage) {
      summary += `, avg ${Math.round(averageMemoryUsage / 1024)}KB memory`;
    }

    return {
      period,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      totalOperations: periodMetrics.length,
      successfulOperations,
      failedOperations,
      averageDuration,
      minDuration,
      maxDuration,
      p95Duration,
      p99Duration,
      averageMemoryUsage,
      maxMemoryUsage,
      operations: periodMetrics,
      summary,
    };
  }

  /**
   * Get performance alerts
   */
  public getAlerts(limit?: number): PerformanceAlert[] {
    const sorted = this.alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /**
   * Get active alerts (unresolved)
   */
  public getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Resolve an alert
   */
  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  /**
   * Clear resolved alerts
   */
  public clearResolvedAlerts(): void {
    this.alerts = this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Get performance thresholds
   */
  public getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  /**
   * Update performance thresholds
   */
  public updateThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Monitor configuration loading performance
   */
  public monitorConfigLoading(config: EnvironmentConfig, envInfo: EnvironmentInfo): () => void {
    return this.startOperation('config_loading', {
      environment: envInfo.name,
      configName: config.name,
      debug: config.debug,
    });
  }

  /**
   * Monitor configuration validation performance
   */
  public monitorConfigValidation(validationResult: any): void {
    const endTime = Date.now();
    this.recordMetric({
      timestamp: new Date().toISOString(),
      operation: 'config_validation',
      duration: 0, // Will be set by the calling function
      success: validationResult.isValid,
      error: validationResult.isValid ? undefined : validationResult.errors.join(', '),
      metadata: {
        score: validationResult.score,
        errors: validationResult.errors.length,
        warnings: validationResult.warnings.length,
      },
    });
  }

  /**
   * Monitor environment detection performance
   */
  public monitorEnvironmentDetection(envInfo: EnvironmentInfo): () => void {
    return this.startOperation('environment_detection', {
      environment: envInfo.name,
      hostname: envInfo.hostname,
      protocol: envInfo.protocol,
      isLocal: envInfo.isLocal,
    });
  }

  /**
   * Monitor API call performance
   */
  public monitorApiCall(endpoint: string, method: string): () => void {
    return this.startOperation('api_call', {
      endpoint,
      method,
    });
  }

  /**
   * Monitor database operation performance
   */
  public monitorDatabaseOperation(operation: string, table?: string): () => void {
    return this.startOperation('database_operation', {
      operation,
      table,
    });
  }

  /**
   * Monitor file upload performance
   */
  public monitorFileUpload(fileName: string, fileSize: number): () => void {
    return this.startOperation('file_upload', {
      fileName,
      fileSize,
    });
  }

  /**
   * Monitor cache operation performance
   */
  public monitorCacheOperation(operation: string, key?: string): () => void {
    return this.startOperation('cache_operation', {
      operation,
      key,
    });
  }

  /**
   * Get performance statistics
   */
  public getPerformanceStats(): {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageDuration: number;
    successRate: number;
    errorRate: number;
    activeAlerts: number;
    totalAlerts: number;
  } {
    const totalOperations = this.metrics.length;
    const successfulOperations = this.metrics.filter(m => m.success).length;
    const failedOperations = totalOperations - successfulOperations;
    const averageDuration = totalOperations > 0 
      ? this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalOperations 
      : 0;
    const successRate = totalOperations > 0 ? successfulOperations / totalOperations : 0;
    const errorRate = totalOperations > 0 ? failedOperations / totalOperations : 0;
    const activeAlerts = this.getActiveAlerts().length;
    const totalAlerts = this.alerts.length;

    return {
      totalOperations,
      successfulOperations,
      failedOperations,
      averageDuration,
      successRate,
      errorRate,
      activeAlerts,
      totalAlerts,
    };
  }

  /**
   * Export performance data
   */
  public exportPerformanceData(): string {
    const data = {
      metrics: this.metrics,
      alerts: this.alerts,
      thresholds: this.thresholds,
      stats: this.getPerformanceStats(),
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Clear all performance data
   */
  public clearPerformanceData(): void {
    this.metrics = [];
    this.alerts = [];
  }

  /**
   * Check performance thresholds
   */
  private checkPerformanceThresholds(metric: PerformanceMetrics): void {
    // Check duration threshold
    if (metric.duration > this.thresholds.maxDuration) {
      this.createAlert('duration', 'high', 
        `Operation ${metric.operation} took ${metric.duration}ms (threshold: ${this.thresholds.maxDuration}ms)`,
        metric.duration, this.thresholds.maxDuration, metric.operation);
    }

    // Check memory usage threshold
    if (metric.memoryUsage && metric.memoryUsage > this.thresholds.maxMemoryUsage) {
      this.createAlert('memory', 'high',
        `Operation ${metric.operation} used ${Math.round(metric.memoryUsage / 1024 / 1024)}MB memory (threshold: ${Math.round(this.thresholds.maxMemoryUsage / 1024 / 1024)}MB)`,
        metric.memoryUsage, this.thresholds.maxMemoryUsage, metric.operation);
    }

    // Check error rate (calculated over recent operations)
    const recentMetrics = this.metrics.slice(-100); // Last 100 operations
    if (recentMetrics.length >= 10) { // Only check if we have enough data
      const recentErrors = recentMetrics.filter(m => !m.success).length;
      const errorRate = recentErrors / recentMetrics.length;
      
      if (errorRate > this.thresholds.maxErrorRate) {
        this.createAlert('error_rate', 'critical',
          `Error rate is ${Math.round(errorRate * 100)}% (threshold: ${Math.round(this.thresholds.maxErrorRate * 100)}%)`,
          errorRate, this.thresholds.maxErrorRate, 'system');
      }
    }

    // Check success rate (calculated over recent operations)
    if (recentMetrics.length >= 10) {
      const recentSuccesses = recentMetrics.filter(m => m.success).length;
      const successRate = recentSuccesses / recentMetrics.length;
      
      if (successRate < this.thresholds.minSuccessRate) {
        this.createAlert('success_rate', 'critical',
          `Success rate is ${Math.round(successRate * 100)}% (threshold: ${Math.round(this.thresholds.minSuccessRate * 100)}%)`,
          successRate, this.thresholds.minSuccessRate, 'system');
      }
    }
  }

  /**
   * Create performance alert
   */
  private createAlert(
    type: 'duration' | 'memory' | 'error_rate' | 'success_rate',
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string,
    value: number,
    threshold: number,
    operation: string
  ): void {
    const alert: PerformanceAlert = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type,
      severity,
      message,
      value,
      threshold,
      operation,
      resolved: false,
    };

    this.alerts.push(alert);

    // Keep only the last maxAlerts entries
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(-this.maxAlerts);
    }
  }

  /**
   * Check if metric should be logged
   */
  private shouldLogMetric(metric: PerformanceMetrics): boolean {
    const hasError = !(metric.success ?? false);
    const exceedsDuration = metric.duration > this.thresholds.maxDuration;
    const exceedsMemory = metric.memoryUsage ? metric.memoryUsage > this.thresholds.maxMemoryUsage : false;
    
    return hasError || exceedsDuration || exceedsMemory;
  }

  /**
   * Log performance issue
   */
  private logPerformanceIssue(metric: PerformanceMetrics): void {
    const level = metric.success ? 'warn' : 'error';
    const message = `Performance ${metric.success ? 'warning' : 'error'}: ${metric.operation} `;
    
    if (!metric.success) {
      console.error(`${message}failed after ${metric.duration}ms: ${metric.error}`);
    } else if (metric.duration > this.thresholds.maxDuration) {
      console.warn(`${message}took ${metric.duration}ms (threshold: ${this.thresholds.maxDuration}ms)`);
    } else if (metric.memoryUsage && metric.memoryUsage > this.thresholds.maxMemoryUsage) {
      console.warn(`${message}used ${Math.round(metric.memoryUsage / 1024 / 1024)}MB memory (threshold: ${Math.round(this.thresholds.maxMemoryUsage / 1024 / 1024)}MB)`);
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
}

/**
 * Global configuration performance monitor instance
 */
export const configPerformanceMonitor = ConfigPerformanceMonitor.getInstance();

/**
 * Utility functions for configuration performance monitoring
 */
export const performanceMonitorUtils = {
  /**
   * Start operation monitoring
   */
  startOperation: (operation: string, metadata?: any) => 
    configPerformanceMonitor.startOperation(operation, metadata),

  /**
   * Record metric
   */
  recordMetric: (metric: PerformanceMetrics) => 
    configPerformanceMonitor.recordMetric(metric),

  /**
   * Record failure
   */
  recordFailure: (operation: string, error: string, duration: number, metadata?: any) => 
    configPerformanceMonitor.recordFailure(operation, error, duration, metadata),

  /**
   * Get metrics for operation
   */
  getMetricsForOperation: (operation: string, limit?: number) => 
    configPerformanceMonitor.getMetricsForOperation(operation, limit),

  /**
   * Generate report
   */
  generateReport: (period: string, startTime: Date, endTime: Date) => 
    configPerformanceMonitor.generateReport(period, startTime, endTime),

  /**
   * Get alerts
   */
  getAlerts: (limit?: number) => configPerformanceMonitor.getAlerts(limit),

  /**
   * Get active alerts
   */
  getActiveAlerts: () => configPerformanceMonitor.getActiveAlerts(),

  /**
   * Resolve alert
   */
  resolveAlert: (alertId: string) => configPerformanceMonitor.resolveAlert(alertId),

  /**
   * Get performance stats
   */
  getStats: () => configPerformanceMonitor.getPerformanceStats(),

  /**
   * Export data
   */
  exportData: () => configPerformanceMonitor.exportPerformanceData(),

  /**
   * Clear data
   */
  clearData: () => configPerformanceMonitor.clearPerformanceData(),
};

// Export default instance
export default configPerformanceMonitor;
