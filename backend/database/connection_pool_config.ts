// Database Connection Pool Optimization for Phase 1 Emergency Scaling
// Target: Optimize connection pool for high concurrency

import { SQLDatabase } from "encore.dev/storage/sqldb";

// Emergency scaling database configuration
export const EMERGENCY_DB_CONFIG = {
  maxConnections: 100,  // ✅ Increased from default (usually 10-20)
  minConnections: 10,   // ✅ Connection pool minimum
  maxIdleTime: "10m",   // ✅ Idle connection timeout
  maxLifetime: "1h",   // ✅ Connection lifetime
  connectionTimeout: "30s", // ✅ Connection timeout
  queryTimeout: "60s"   // ✅ Query timeout
};

// Optimized database instances with connection pool settings
export const financeDB = SQLDatabase.named("hospitality", {
  // Connection pool configuration
  maxConnections: EMERGENCY_DB_CONFIG.maxConnections,
  minConnections: EMERGENCY_DB_CONFIG.minConnections,
  maxIdleTime: EMERGENCY_DB_CONFIG.maxIdleTime,
  maxLifetime: EMERGENCY_DB_CONFIG.maxLifetime,
  connectionTimeout: EMERGENCY_DB_CONFIG.connectionTimeout,
  queryTimeout: EMERGENCY_DB_CONFIG.queryTimeout
});

export const reportsDB = SQLDatabase.named("hospitality", {
  // Connection pool configuration
  maxConnections: EMERGENCY_DB_CONFIG.maxConnections,
  minConnections: EMERGENCY_DB_CONFIG.minConnections,
  maxIdleTime: EMERGENCY_DB_CONFIG.maxIdleTime,
  maxLifetime: EMERGENCY_DB_CONFIG.maxLifetime,
  connectionTimeout: EMERGENCY_DB_CONFIG.connectionTimeout,
  queryTimeout: EMERGENCY_DB_CONFIG.queryTimeout
});

// Database performance monitoring
export class DatabasePerformanceMonitor {
  private metrics = {
    activeConnections: 0,
    totalConnections: 0,
    queryCount: 0,
    slowQueries: 0,
    connectionErrors: 0,
    avgQueryTime: 0,
    maxQueryTime: 0
  };

  private queryTimes: number[] = [];

  recordQuery(queryTime: number) {
    this.metrics.queryCount++;
    this.queryTimes.push(queryTime);
    
    // Keep only last 1000 query times for rolling average
    if (this.queryTimes.length > 1000) {
      this.queryTimes.shift();
    }
    
    this.metrics.avgQueryTime = this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length;
    this.metrics.maxQueryTime = Math.max(this.metrics.maxQueryTime, queryTime);
    
    if (queryTime > 1000) { // 1 second threshold
      this.metrics.slowQueries++;
    }
  }

  recordConnection(active: number, total: number) {
    this.metrics.activeConnections = active;
    this.metrics.totalConnections = total;
  }

  recordConnectionError() {
    this.metrics.connectionErrors++;
  }

  getMetrics() {
    return {
      ...this.metrics,
      connectionUtilization: this.metrics.activeConnections / this.metrics.totalConnections,
      slowQueryRate: this.metrics.slowQueries / this.metrics.queryCount,
      errorRate: this.metrics.connectionErrors / this.metrics.queryCount
    };
  }

  // Alert if performance degrades
  checkAlerts() {
    const connectionUtilization = this.metrics.activeConnections / this.metrics.totalConnections;
    const slowQueryRate = this.metrics.slowQueries / this.metrics.queryCount;
    const errorRate = this.metrics.connectionErrors / this.metrics.queryCount;

    if (connectionUtilization > 0.8) { // 80% connection utilization
      console.warn(`[DatabasePerformance] High connection utilization: ${(connectionUtilization * 100).toFixed(2)}%`);
    }

    if (slowQueryRate > 0.1) { // 10% slow query rate
      console.warn(`[DatabasePerformance] High slow query rate: ${(slowQueryRate * 100).toFixed(2)}%`);
    }

    if (errorRate > 0.05) { // 5% error rate
      console.warn(`[DatabasePerformance] High error rate: ${(errorRate * 100).toFixed(2)}%`);
    }
  }
}

export const dbPerformanceMonitor = new DatabasePerformanceMonitor();
