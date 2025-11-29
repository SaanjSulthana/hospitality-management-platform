/**
 * 🔥 CRITICAL FOR 1M ORGS: Event Validation Monitoring & Alerting
 * 
 * This module provides real-time monitoring and alerting for event validation
 * at production scale. Tracks:
 * - Validation success/failure rates
 * - Event type distribution
 * - Legacy event usage
 * - Error patterns
 * - Performance metrics
 */

import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { eventValidationMonitor, VALID_EVENT_TYPES } from "./event_validator";

// Monitoring response interface
export interface EventMonitoringResponse {
  status: 'healthy' | 'warning' | 'unhealthy';
  statistics: {
    totalValidated: number;
    validEvents: number;
    invalidEvents: number;
    legacyMappings: number;
    validationRate: number;
    invalidRate: number;
    legacyRate: number;
  };
  eventTypeDistribution: Record<string, number>;
  errorDistribution: Record<string, number>;
  alerts: string[];
  recommendations: string[];
  timestamp: string;
}

// Health check response
export interface EventHealthResponse {
  service: string;
  version: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  validEventTypes: string[];
  validationStats: {
    totalValidated: number;
    successRate: number;
    invalidRate: number;
    legacyRate: number;
  };
  alerts: string[];
  timestamp: string;
}

// Shared handler for getting event monitoring data
async function getEventMonitoringHandler(): Promise<EventMonitoringResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw new Error("Authentication required");
  }
  requireRole("ADMIN")(authData);

  const stats = eventValidationMonitor.getStats();
  const alerts = eventValidationMonitor.checkAlerts();

    // Generate recommendations based on stats
    const recommendations: string[] = [];

    if (stats.legacyRate > 0.05) {
      recommendations.push(
        "🔄 Migrate legacy event types: " +
        `${(stats.legacyRate * 100).toFixed(1)}% of events use deprecated types. ` +
        "Update services to use new event types for better type safety."
      );
    }

    if (stats.invalidRate > 0.01) {
      recommendations.push(
        "⚠️ Investigate invalid events: " +
        `${(stats.invalidRate * 100).toFixed(1)}% validation failure rate. ` +
        "Check error distribution and fix publishing services."
      );
    }

    if (stats.validationRate > 0.99) {
      recommendations.push(
        "✅ Excellent validation rate! System is working as expected."
      );
    }

    // Determine overall health status
    let status: 'healthy' | 'warning' | 'unhealthy';
    if (stats.invalidRate > 0.05 || stats.legacyRate > 0.2) {
      status = 'unhealthy';
    } else if (stats.invalidRate > 0.01 || stats.legacyRate > 0.05 || alerts.length > 0) {
      status = 'warning';
    } else {
      status = 'healthy';
    }

    return {
      status,
      statistics: {
        totalValidated: stats.totalValidated,
        validEvents: stats.validEvents,
        invalidEvents: stats.invalidEvents,
        legacyMappings: stats.legacyMappings,
        validationRate: stats.validationRate,
        invalidRate: stats.invalidRate,
        legacyRate: stats.legacyRate,
      },
      eventTypeDistribution: stats.eventTypeDistribution,
      errorDistribution: stats.errorDistribution,
      alerts,
      recommendations,
      timestamp: new Date().toISOString(),
    };
  }

/**
 * LEGACY: Get comprehensive event validation monitoring data (keep for backward compatibility)
 */
export const getEventMonitoring = api<{}, EventMonitoringResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/events/monitoring" },
  getEventMonitoringHandler
);

/**
 * V1: Get comprehensive event validation monitoring data
 */
export const getEventMonitoringV1 = api<{}, EventMonitoringResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/finance/events/monitoring" },
  getEventMonitoringHandler
);

// Shared handler for event validation health check
async function getEventValidationHealthHandler(): Promise<EventHealthResponse> {
  const stats = eventValidationMonitor.getStats();
  const alerts = eventValidationMonitor.checkAlerts();

  // Determine health status
  let status: 'healthy' | 'degraded' | 'unhealthy';
  if (stats.invalidRate > 0.05) {
    status = 'unhealthy';
  } else if (stats.invalidRate > 0.01 || alerts.length > 0) {
    status = 'degraded';
  } else {
    status = 'healthy';
  }

  return {
    service: 'finance-event-validation',
    version: '1.0.0',
    status,
    validEventTypes: Array.from(VALID_EVENT_TYPES),
    validationStats: {
      totalValidated: stats.totalValidated,
      successRate: stats.validationRate,
      invalidRate: stats.invalidRate,
      legacyRate: stats.legacyRate,
    },
    alerts,
    timestamp: new Date().toISOString(),
  };
}

/**
 * LEGACY: Health check endpoint for event validation system (keep for backward compatibility)
 */
export const getEventValidationHealth = api<{}, EventHealthResponse>(
  { auth: false, expose: true, method: "GET", path: "/finance/events/health" },
  getEventValidationHealthHandler
);

/**
 * V1: Health check endpoint for event validation system  
 */
export const getEventValidationHealthV1 = api<{}, EventHealthResponse>(
  { auth: false, expose: true, method: "GET", path: "/v1/system/finance/events/health" },
  getEventValidationHealthHandler
);

// Shared handler for getting valid event types
async function getValidEventTypesHandler(): Promise<{ eventTypes: string[]; count: number }> {
  return {
    eventTypes: [...VALID_EVENT_TYPES],
    count: VALID_EVENT_TYPES.length,
  };
}

/**
 * LEGACY: Get list of valid event types (keep for backward compatibility)
 */
export const getValidEventTypes = api<{}, { eventTypes: string[]; count: number }>(
  { auth: false, expose: true, method: "GET", path: "/finance/events/types" },
  getValidEventTypesHandler
);

/**
 * V1: Get list of valid event types
 */
export const getValidEventTypesV1 = api<{}, { eventTypes: string[]; count: number }>(
  { auth: false, expose: true, method: "GET", path: "/v1/system/finance/events/types" },
  getValidEventTypesHandler
);

/**
 * Background alert checker (can be called by cron job)
 * Logs warnings when thresholds are exceeded
 */
export function checkEventValidationAlerts(): void {
  const alerts = eventValidationMonitor.checkAlerts();
  
  if (alerts.length > 0) {
    console.warn(
      `[EventMonitoring] 🚨 ${alerts.length} alert(s) detected:\n` +
      alerts.map(a => `  - ${a}`).join('\n')
    );
  } else {
    console.log('[EventMonitoring] ✅ All event validation metrics healthy');
  }
}

/**
 * Performance monitoring for event validation
 */
export class EventPerformanceMonitor {
  private performanceMetrics = {
    validationTimes: [] as number[],
    avgValidationTime: 0,
    maxValidationTime: 0,
    p95ValidationTime: 0,
    p99ValidationTime: 0,
  };

  recordValidationTime(timeMs: number): void {
    this.performanceMetrics.validationTimes.push(timeMs);

    // Keep only last 10000 measurements
    if (this.performanceMetrics.validationTimes.length > 10000) {
      this.performanceMetrics.validationTimes.shift();
    }

    // Calculate metrics
    const times = this.performanceMetrics.validationTimes;
    this.performanceMetrics.avgValidationTime = 
      times.reduce((a, b) => a + b, 0) / times.length;
    this.performanceMetrics.maxValidationTime = Math.max(...times);

    // Calculate percentiles
    const sorted = [...times].sort((a, b) => a - b);
    this.performanceMetrics.p95ValidationTime = 
      sorted[Math.floor(sorted.length * 0.95)];
    this.performanceMetrics.p99ValidationTime = 
      sorted[Math.floor(sorted.length * 0.99)];
  }

  getMetrics() {
    return {
      ...this.performanceMetrics,
      sampleSize: this.performanceMetrics.validationTimes.length,
    };
  }

  checkPerformance(): string[] {
    const alerts: string[] = [];

    if (this.performanceMetrics.avgValidationTime > 10) {
      alerts.push(
        `⚠️ High average validation time: ${this.performanceMetrics.avgValidationTime.toFixed(2)}ms`
      );
    }

    if (this.performanceMetrics.p99ValidationTime > 50) {
      alerts.push(
        `⚠️ High p99 validation time: ${this.performanceMetrics.p99ValidationTime.toFixed(2)}ms`
      );
    }

    return alerts;
  }
}

// Global performance monitor instance
export const eventPerformanceMonitor = new EventPerformanceMonitor();

