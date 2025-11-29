import { api } from "encore.dev/api";
import { metricsCollector } from "./metrics_collector";
import { v1Path } from "../shared/http";

// Alert severity levels
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

// Alert interface
export interface Alert {
  id: string;
  name: string;
  severity: AlertSeverity;
  message: string;
  metric: string;
  threshold: number;
  currentValue: number;
  timestamp: string;
  acknowledged: boolean;
}

// Request interfaces for path parameters
interface AcknowledgeAlertRequest {
  alertId: string;
}

interface ClearAlertRequest {
  alertId: string;
}

// Alert configuration
interface AlertRule {
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq';
  threshold: number;
  severity: AlertSeverity;
  message: string;
}

class AlertingSystem {
  private alerts = new Map<string, Alert>();
  private alertRules: AlertRule[] = [];
  private alertHistory: Alert[] = [];
  private readonly maxHistorySize = 1000;

  constructor() {
    this.initializeAlertRules();
    this.startAlertMonitoring();
  }

  private initializeAlertRules(): void {
    this.alertRules = [
      // Cache alerts
      {
        name: 'Cache Redis Down',
        metric: 'cache.redis.connected',
        condition: 'eq',
        threshold: 0,
        severity: AlertSeverity.WARNING,
        message: 'Redis cache is not available, falling back to memory cache',
      },
      {
        name: 'High Cache Invalidation Queue',
        metric: 'cache.invalidation.queue.size',
        condition: 'gt',
        threshold: 1000,
        severity: AlertSeverity.WARNING,
        message: 'Cache invalidation queue size exceeds 1000 entries',
      },
      {
        name: 'Critical Cache Invalidation Queue',
        metric: 'cache.invalidation.queue.size',
        condition: 'gt',
        threshold: 5000,
        severity: AlertSeverity.CRITICAL,
        message: 'Cache invalidation queue size exceeds 5000 entries - system may be overloaded',
      },
      
      // Replica alerts
      {
        name: 'Replica Unhealthy',
        metric: 'replica.unhealthy.count',
        condition: 'gt',
        threshold: 0,
        severity: AlertSeverity.WARNING,
        message: 'One or more read replicas are unhealthy',
      },
      {
        name: 'All Replicas Unhealthy',
        metric: 'replica.healthy.count',
        condition: 'eq',
        threshold: 0,
        severity: AlertSeverity.CRITICAL,
        message: 'All read replicas are unhealthy - falling back to primary database',
      },
      {
        name: 'High Replica Lag',
        metric: 'replica.lag.max',
        condition: 'gt',
        threshold: 60,
        severity: AlertSeverity.WARNING,
        message: 'Replica lag exceeds 60 seconds - data may be stale',
      },
      {
        name: 'Critical Replica Lag',
        metric: 'replica.lag.max',
        condition: 'gt',
        threshold: 300,
        severity: AlertSeverity.CRITICAL,
        message: 'Replica lag exceeds 5 minutes - immediate attention required',
      },
      
      // Database connection alerts
      {
        name: 'High Database Connections',
        metric: 'db.primary.connections.active',
        condition: 'gt',
        threshold: 80,
        severity: AlertSeverity.WARNING,
        message: 'Active database connections exceed 80 - approaching connection limit',
      },
      {
        name: 'Critical Database Connections',
        metric: 'db.primary.connections.active',
        condition: 'gt',
        threshold: 95,
        severity: AlertSeverity.CRITICAL,
        message: 'Active database connections exceed 95 - connection pool exhaustion imminent',
      },
      
      // Partition alerts
      {
        name: 'Partition Maintenance Running',
        metric: 'partition.maintenance.running',
        condition: 'eq',
        threshold: 1,
        severity: AlertSeverity.INFO,
        message: 'Partition maintenance is currently running',
      },
    ];

    console.log(`[AlertingSystem] ✅ Initialized ${this.alertRules.length} alert rules`);
  }

  private startAlertMonitoring(): void {
    const interval = parseInt(process.env.ALERT_CHECK_INTERVAL || '60000'); // 1 minute

    setInterval(() => {
      this.checkAlerts();
    }, interval);

    console.log(`[AlertingSystem] ✅ Started alert monitoring (interval: ${interval}ms)`);
  }

  private checkAlerts(): void {
    const allMetrics = metricsCollector.getAllMetrics();

    for (const rule of this.alertRules) {
      const metricData = allMetrics[rule.metric];
      if (!metricData) continue;

      const currentValue = metricData.value;
      const shouldAlert = this.evaluateCondition(currentValue, rule.condition, rule.threshold);

      const alertId = `${rule.metric}:${rule.threshold}`;

      if (shouldAlert) {
        if (!this.alerts.has(alertId)) {
          // Create new alert
          const alert: Alert = {
            id: alertId,
            name: rule.name,
            severity: rule.severity,
            message: rule.message,
            metric: rule.metric,
            threshold: rule.threshold,
            currentValue,
            timestamp: new Date().toISOString(),
            acknowledged: false,
          };

          this.alerts.set(alertId, alert);
          this.alertHistory.push(alert);

          // Keep history size in check
          if (this.alertHistory.length > this.maxHistorySize) {
            this.alertHistory.shift();
          }

          console.warn(`[AlertingSystem] 🚨 ${rule.severity.toUpperCase()}: ${rule.name} - ${rule.message} (current: ${currentValue}, threshold: ${rule.threshold})`);
          
          // In production, send to alerting system (PagerDuty, Slack, etc.)
          this.sendAlert(alert);
        }
      } else {
        // Clear alert if condition no longer met
        if (this.alerts.has(alertId)) {
          const alert = this.alerts.get(alertId)!;
          console.log(`[AlertingSystem] ✅ Resolved: ${alert.name}`);
          this.alerts.delete(alertId);
        }
      }
    }
  }

  private evaluateCondition(value: number, condition: 'gt' | 'lt' | 'eq', threshold: number): boolean {
    switch (condition) {
      case 'gt':
        return value > threshold;
      case 'lt':
        return value < threshold;
      case 'eq':
        return value === threshold;
      default:
        return false;
    }
  }

  private sendAlert(alert: Alert): void {
    // In production, implement integrations with:
    // - PagerDuty
    // - Slack
    // - Email
    // - SMS
    
    // For now, just log
    console.warn(`[AlertingSystem] 📧 Would send alert: ${JSON.stringify(alert)}`);
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  getAlertHistory(limit: number = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      console.log(`[AlertingSystem] ✓ Acknowledged alert: ${alert.name}`);
      return true;
    }
    return false;
  }

  clearAlert(alertId: string): boolean {
    if (this.alerts.has(alertId)) {
      const alert = this.alerts.get(alertId)!;
      console.log(`[AlertingSystem] ✓ Cleared alert: ${alert.name}`);
      this.alerts.delete(alertId);
      return true;
    }
    return false;
  }

  getAlertStats(): {
    active: number;
    critical: number;
    warning: number;
    info: number;
    acknowledged: number;
  } {
    const activeAlerts = Array.from(this.alerts.values());
    
    return {
      active: activeAlerts.length,
      critical: activeAlerts.filter(a => a.severity === AlertSeverity.CRITICAL).length,
      warning: activeAlerts.filter(a => a.severity === AlertSeverity.WARNING).length,
      info: activeAlerts.filter(a => a.severity === AlertSeverity.INFO).length,
      acknowledged: activeAlerts.filter(a => a.acknowledged).length,
    };
  }
}

// Global alerting system instance
const alertingSystem = new AlertingSystem();

// API Endpoints

export interface AlertsResponse {
  timestamp: string;
  stats: {
    active: number;
    critical: number;
    warning: number;
    info: number;
    acknowledged: number;
  };
  alerts: Alert[];
}

async function getActiveAlertsHandler(): Promise<AlertsResponse> {
    return {
      timestamp: new Date().toISOString(),
      stats: alertingSystem.getAlertStats(),
      alerts: alertingSystem.getActiveAlerts(),
    };
  }

export const getActiveAlerts = api(
  { expose: true, method: "GET", path: "/alerts/active" },
  getActiveAlertsHandler
);

export const getActiveAlertsV1 = api(
  { expose: true, method: "GET", path: "/v1/system/alerts/active" },
  getActiveAlertsHandler
);

async function getAlertHistoryHandler({ limit }: { limit?: number }): Promise<{
    timestamp: string;
    count: number;
    alerts: Alert[];
  }> {
    const alerts = alertingSystem.getAlertHistory(limit || 100);
    
    return {
      timestamp: new Date().toISOString(),
      count: alerts.length,
      alerts,
    };
  }

export const getAlertHistory = api(
  { expose: true, method: "GET", path: "/alerts/history" },
  getAlertHistoryHandler
);

export const getAlertHistoryV1 = api(
  { expose: true, method: "GET", path: "/v1/system/alerts/history" },
  getAlertHistoryHandler
);

async function acknowledgeAlertHandler({ alertId }: AcknowledgeAlertRequest): Promise<{
    success: boolean;
    message: string;
  }> {
    const success = alertingSystem.acknowledgeAlert(alertId);
    
    return {
      success,
      message: success 
        ? `Alert ${alertId} acknowledged successfully`
        : `Alert ${alertId} not found`,
    };
  }

export const acknowledgeAlert = api<AcknowledgeAlertRequest, { success: boolean; message: string }>(
  { expose: true, method: "POST", path: "/alerts/:alertId/acknowledge" },
  acknowledgeAlertHandler
);

export const acknowledgeAlertV1 = api<AcknowledgeAlertRequest, { success: boolean; message: string }>(
  { expose: true, method: "POST", path: "/v1/system/alerts/:alertId/acknowledge" },
  acknowledgeAlertHandler
);

async function clearAlertHandler({ alertId }: ClearAlertRequest): Promise<{
    success: boolean;
    message: string;
  }> {
    const success = alertingSystem.clearAlert(alertId);
    
    return {
      success,
      message: success 
        ? `Alert ${alertId} cleared successfully`
        : `Alert ${alertId} not found`,
    };
  }

export const clearAlert = api<ClearAlertRequest, { success: boolean; message: string }>(
  { expose: true, method: "POST", path: "/alerts/:alertId/clear" },
  clearAlertHandler
);

export const clearAlertV1 = api<ClearAlertRequest, { success: boolean; message: string }>(
  { expose: true, method: "POST", path: "/v1/system/alerts/:alertId/clear" },
  clearAlertHandler
);

async function getAlertStatsHandler(): Promise<{
    timestamp: string;
    stats: {
      active: number;
      critical: number;
      warning: number;
      info: number;
      acknowledged: number;
    };
  }> {
    return {
      timestamp: new Date().toISOString(),
      stats: alertingSystem.getAlertStats(),
    };
  }

export const getAlertStats = api(
  { expose: true, method: "GET", path: "/alerts/stats" },
  getAlertStatsHandler
);

export const getAlertStatsV1 = api(
  { expose: true, method: "GET", path: "/v1/system/alerts/stats" },
  getAlertStatsHandler
);

// Export alerting system for internal use
export { alertingSystem };

