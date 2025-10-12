import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { 
  performHealthCheck, 
  getPerformanceReport, 
  getAllAlerts, 
  resolveAlert, 
  clearResolvedAlerts,
  HealthStatus,
  PerformanceReport,
  Alert
} from "./health_monitoring";

export interface HealthCheckResponse extends HealthStatus {
  // Additional response fields can be added here
}

export interface PerformanceReportResponse extends PerformanceReport {
  // Additional response fields can be added here
}

export interface AlertsResponse {
  alerts: Alert[];
  total_alerts: number;
  unresolved_alerts: number;
  critical_alerts: number;
}

export interface ResolveAlertRequest {
  alertId: string;
}

export interface ResolveAlertResponse {
  success: boolean;
  message: string;
}

/**
 * Database health check endpoint
 * GET /finance/health-check
 */
export const healthCheckEndpoint = api(
  { auth: true, expose: true, method: "GET", path: "/finance/health-check" },
  async (): Promise<HealthCheckResponse> => {
    try {
      console.log('Performing database health check...');
      
      const healthStatus = await performHealthCheck();
      
      console.log(`Health check completed. Status: ${healthStatus.overall_status}`);
      
      return healthStatus;
    } catch (error) {
      console.error('Health check failed:', error);
      throw new APIError('internal', `Health check failed: ${(error as Error).message}`);
    }
  }
);

/**
 * Performance report endpoint
 * GET /finance/performance-report
 */
export const performanceReportEndpoint = api(
  { auth: true, expose: true, method: "GET", path: "/finance/performance-report" },
  async (req: { hours?: number }): Promise<PerformanceReportResponse> => {
    try {
      const hours = req.hours || 24;
      console.log(`Generating performance report for last ${hours} hours...`);
      
      const report = getPerformanceReport(hours);
      
      console.log('Performance report generated successfully');
      
      return report;
    } catch (error) {
      console.error('Error generating performance report:', error);
      throw new APIError('internal', `Failed to generate performance report: ${(error as Error).message}`);
    }
  }
);

/**
 * Get all alerts endpoint
 * GET /finance/alerts
 */
export const getAlertsEndpoint = api(
  { auth: true, expose: true, method: "GET", path: "/finance/alerts" },
  async (): Promise<AlertsResponse> => {
    try {
      console.log('Getting all alerts...');
      
      const alerts = getAllAlerts();
      const unresolvedAlerts = alerts.filter(a => !a.resolved);
      const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.resolved);
      
      return {
        alerts,
        total_alerts: alerts.length,
        unresolved_alerts: unresolvedAlerts.length,
        critical_alerts: criticalAlerts.length
      };
    } catch (error) {
      console.error('Error getting alerts:', error);
      throw new APIError('internal', `Failed to get alerts: ${(error as Error).message}`);
    }
  }
);

/**
 * Resolve alert endpoint
 * POST /finance/alerts/resolve
 */
export const resolveAlertEndpoint = api(
  { auth: true, expose: true, method: "POST", path: "/finance/alerts/resolve" },
  async (req: ResolveAlertRequest): Promise<ResolveAlertResponse> => {
    try {
      // Require admin role for resolving alerts
      const authData = getAuthData();
      requireRole(authData, "ADMIN");
      
      console.log(`Resolving alert: ${req.alertId}`);
      
      resolveAlert(req.alertId);
      
      return {
        success: true,
        message: `Alert ${req.alertId} resolved successfully`
      };
    } catch (error) {
      console.error(`Error resolving alert ${req.alertId}:`, error);
      throw new APIError('internal', `Failed to resolve alert: ${(error as Error).message}`);
    }
  }
);

/**
 * Clear resolved alerts endpoint
 * POST /finance/alerts/clear-resolved
 */
export const clearResolvedAlertsEndpoint = api(
  { auth: true, expose: true, method: "POST", path: "/finance/alerts/clear-resolved" },
  async (): Promise<{ success: boolean; message: string; cleared_count: number }> => {
    try {
      // Require admin role for clearing alerts
      const authData = getAuthData();
      requireRole(authData, "ADMIN");
      
      console.log('Clearing resolved alerts...');
      
      const alertsBefore = getAllAlerts();
      const resolvedCount = alertsBefore.filter(a => a.resolved).length;
      
      clearResolvedAlerts();
      
      console.log(`Cleared ${resolvedCount} resolved alerts`);
      
      return {
        success: true,
        message: `Cleared ${resolvedCount} resolved alerts`,
        cleared_count: resolvedCount
      };
    } catch (error) {
      console.error('Error clearing resolved alerts:', error);
      throw new APIError('internal', `Failed to clear resolved alerts: ${(error as Error).message}`);
    }
  }
);

/**
 * Quick health check endpoint (no authentication required)
 * GET /finance/health-check/quick
 */
export const quickHealthCheckEndpoint = api(
  { auth: false, expose: true, method: "GET", path: "/finance/health-check/quick" },
  async (): Promise<{ status: string; timestamp: string; response_time_ms: number }> => {
    try {
      const startTime = Date.now();
      
      // Simple connection test
      const { financeDB } = await import('./db');
      await financeDB.queryRow`SELECT 1 as test`;
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        response_time_ms: responseTime
      };
    } catch (error) {
      console.error('Quick health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        response_time_ms: Date.now() - Date.now()
      };
    }
  }
);
