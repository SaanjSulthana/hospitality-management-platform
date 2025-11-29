// Emergency Scaling Monitor for Phase 1
// Target: Comprehensive monitoring and performance tracking

interface PerformanceMetrics {
  // Pub/Sub metrics
  pubsubEventsProcessed: number;
  pubsubEventsPerSecond: number;
  pubsubBacklog: number;
  pubsubErrors: number;
  
  // Database metrics
  dbActiveConnections: number;
  dbTotalConnections: number;
  dbQueryCount: number;
  dbAvgQueryTime: number;
  dbSlowQueries: number;
  dbConnectionErrors: number;
  
  // Cache metrics
  cacheHitRate: number;
  cacheMissRate: number;
  cacheInvalidations: number;
  cacheSize: number;
  cacheMaxSize: number;
  
  // Auto-correction metrics
  correctionsQueued: number;
  correctionsProcessed: number;
  correctionsBatchSize: number;
  correctionsAvgLatency: number;
  
  // Application metrics
  responseTime: number;
  errorRate: number;
  throughput: number;
  memoryUsage: number;
  cpuUsage: number;
}

interface AlertThresholds {
  pubsubBacklog: number;
  dbConnectionUtilization: number;
  cacheHitRate: number;
  responseTime: number;
  errorRate: number;
}

export class EmergencyScalingMonitor {
  private metrics: PerformanceMetrics = {
    pubsubEventsProcessed: 0,
    pubsubEventsPerSecond: 0,
    pubsubBacklog: 0,
    pubsubErrors: 0,
    dbActiveConnections: 0,
    dbTotalConnections: 0,
    dbQueryCount: 0,
    dbAvgQueryTime: 0,
    dbSlowQueries: 0,
    dbConnectionErrors: 0,
    cacheHitRate: 0,
    cacheMissRate: 0,
    cacheInvalidations: 0,
    cacheSize: 0,
    cacheMaxSize: 10000,
    correctionsQueued: 0,
    correctionsProcessed: 0,
    correctionsBatchSize: 0,
    correctionsAvgLatency: 0,
    responseTime: 0,
    errorRate: 0,
    throughput: 0,
    memoryUsage: 0,
    cpuUsage: 0
  };

  private thresholds: AlertThresholds = {
    pubsubBacklog: 1000,
    dbConnectionUtilization: 0.8, // 80%
    cacheHitRate: 0.7, // 70%
    responseTime: 2000, // 2 seconds
    errorRate: 0.05 // 5%
  };

  private alerts: string[] = [];
  private startTime = Date.now();

  // Pub/Sub monitoring
  recordPubSubEvent(processed: boolean, error?: Error) {
    this.metrics.pubsubEventsProcessed++;
    if (error) {
      this.metrics.pubsubErrors++;
    }
    
    // Calculate events per second
    const elapsed = (Date.now() - this.startTime) / 1000;
    this.metrics.pubsubEventsPerSecond = this.metrics.pubsubEventsProcessed / elapsed;
  }

  recordPubSubBacklog(backlog: number) {
    this.metrics.pubsubBacklog = backlog;
  }

  // Database monitoring
  recordDatabaseQuery(queryTime: number, error?: Error) {
    this.metrics.dbQueryCount++;
    this.metrics.dbAvgQueryTime = (this.metrics.dbAvgQueryTime + queryTime) / 2;
    
    if (queryTime > 1000) { // 1 second threshold
      this.metrics.dbSlowQueries++;
    }
    
    if (error) {
      this.metrics.dbConnectionErrors++;
    }
  }

  recordDatabaseConnections(active: number, total: number) {
    this.metrics.dbActiveConnections = active;
    this.metrics.dbTotalConnections = total;
  }

  // Cache monitoring
  recordCacheHit() {
    const total = this.metrics.cacheHitRate + this.metrics.cacheMissRate;
    this.metrics.cacheHitRate = (this.metrics.cacheHitRate * total + 1) / (total + 1);
  }

  recordCacheMiss() {
    const total = this.metrics.cacheHitRate + this.metrics.cacheMissRate;
    this.metrics.cacheMissRate = (this.metrics.cacheMissRate * total + 1) / (total + 1);
  }

  recordCacheInvalidation() {
    this.metrics.cacheInvalidations++;
  }

  recordCacheSize(size: number) {
    this.metrics.cacheSize = size;
  }

  // Auto-correction monitoring
  recordCorrectionQueued() {
    this.metrics.correctionsQueued++;
  }

  recordCorrectionProcessed(batchSize: number, latency: number) {
    this.metrics.correctionsProcessed++;
    this.metrics.correctionsBatchSize = batchSize;
    this.metrics.correctionsAvgLatency = (this.metrics.correctionsAvgLatency + latency) / 2;
  }

  // Application monitoring
  recordResponse(responseTime: number, error?: Error) {
    this.metrics.responseTime = responseTime;
    this.metrics.throughput++;
    
    if (error) {
      this.metrics.errorRate = (this.metrics.errorRate + 1) / (this.metrics.throughput + 1);
    }
  }

  recordSystemMetrics(memoryUsage: number, cpuUsage: number) {
    this.metrics.memoryUsage = memoryUsage;
    this.metrics.cpuUsage = cpuUsage;
  }

  // Alert checking
  checkAlerts(): string[] {
    this.alerts = [];
    
    // Pub/Sub alerts
    if (this.metrics.pubsubBacklog > this.thresholds.pubsubBacklog) {
      this.alerts.push(`Pub/Sub backlog too high: ${this.metrics.pubsubBacklog} > ${this.thresholds.pubsubBacklog}`);
    }
    
    // Database alerts
    const dbUtilization = this.metrics.dbActiveConnections / this.metrics.dbTotalConnections;
    if (dbUtilization > this.thresholds.dbConnectionUtilization) {
      this.alerts.push(`Database connection utilization too high: ${(dbUtilization * 100).toFixed(2)}% > ${(this.thresholds.dbConnectionUtilization * 100)}%`);
    }
    
    // Cache alerts
    if (this.metrics.cacheHitRate < this.thresholds.cacheHitRate) {
      this.alerts.push(`Cache hit rate too low: ${(this.metrics.cacheHitRate * 100).toFixed(2)}% < ${(this.thresholds.cacheHitRate * 100)}%`);
    }
    
    // Response time alerts
    if (this.metrics.responseTime > this.thresholds.responseTime) {
      this.alerts.push(`Response time too high: ${this.metrics.responseTime}ms > ${this.thresholds.responseTime}ms`);
    }
    
    // Error rate alerts
    if (this.metrics.errorRate > this.thresholds.errorRate) {
      this.alerts.push(`Error rate too high: ${(this.metrics.errorRate * 100).toFixed(2)}% > ${(this.thresholds.errorRate * 100)}%`);
    }
    
    return this.alerts;
  }

  // Get current metrics
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // Get alerts
  getAlerts(): string[] {
    return [...this.alerts];
  }

  // Get performance summary
  getPerformanceSummary(): string {
    const alerts = this.checkAlerts();
    const summary = `
=== Emergency Scaling Performance Summary ===
📊 Pub/Sub Performance:
   Events Processed: ${this.metrics.pubsubEventsProcessed}
   Events/Second: ${this.metrics.pubsubEventsPerSecond.toFixed(2)}
   Backlog: ${this.metrics.pubsubBacklog}
   Errors: ${this.metrics.pubsubErrors}

🗄️ Database Performance:
   Active Connections: ${this.metrics.dbActiveConnections}/${this.metrics.dbTotalConnections}
   Query Count: ${this.metrics.dbQueryCount}
   Avg Query Time: ${this.metrics.dbAvgQueryTime.toFixed(2)}ms
   Slow Queries: ${this.metrics.dbSlowQueries}
   Connection Errors: ${this.metrics.dbConnectionErrors}

💾 Cache Performance:
   Hit Rate: ${(this.metrics.cacheHitRate * 100).toFixed(2)}%
   Miss Rate: ${(this.metrics.cacheMissRate * 100).toFixed(2)}%
   Cache Size: ${this.metrics.cacheSize}/${this.metrics.cacheMaxSize}
   Invalidations: ${this.metrics.cacheInvalidations}

🔧 Auto-Correction Performance:
   Queued: ${this.metrics.correctionsQueued}
   Processed: ${this.metrics.correctionsProcessed}
   Batch Size: ${this.metrics.correctionsBatchSize}
   Avg Latency: ${this.metrics.correctionsAvgLatency.toFixed(2)}ms

⚡ Application Performance:
   Response Time: ${this.metrics.responseTime}ms
   Throughput: ${this.metrics.throughput}
   Error Rate: ${(this.metrics.errorRate * 100).toFixed(2)}%
   Memory Usage: ${this.metrics.memoryUsage}MB
   CPU Usage: ${this.metrics.cpuUsage}%

🚨 Alerts: ${alerts.length > 0 ? alerts.join(', ') : 'None'}
    `;
    
    return summary;
  }

  // Reset metrics (useful for testing)
  reset() {
    this.metrics = {
      pubsubEventsProcessed: 0,
      pubsubEventsPerSecond: 0,
      pubsubBacklog: 0,
      pubsubErrors: 0,
      dbActiveConnections: 0,
      dbTotalConnections: 0,
      dbQueryCount: 0,
      dbAvgQueryTime: 0,
      dbSlowQueries: 0,
      dbConnectionErrors: 0,
      cacheHitRate: 0,
      cacheMissRate: 0,
      cacheInvalidations: 0,
      cacheSize: 0,
      cacheMaxSize: 10000,
      correctionsQueued: 0,
      correctionsProcessed: 0,
      correctionsBatchSize: 0,
      correctionsAvgLatency: 0,
      responseTime: 0,
      errorRate: 0,
      throughput: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };
    this.alerts = [];
    this.startTime = Date.now();
  }
}

// Global monitor instance
export const emergencyScalingMonitor = new EmergencyScalingMonitor();

// Auto-alert checking every 30 seconds
setInterval(() => {
  const alerts = emergencyScalingMonitor.checkAlerts();
  if (alerts.length > 0) {
    console.warn('[EmergencyScalingMonitor] Performance alerts:', alerts);
  }
}, 30000);
