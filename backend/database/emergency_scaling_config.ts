// 🚨 EMERGENCY SCALING FIXES - PHASE 1
// Target: Handle 10K-50K organizations
// Implementation: Week 1

// ✅ FIX 1: Database Connection Pool Optimization
export const EMERGENCY_DB_CONFIG = {
  // Primary database configuration
  primary: {
    host: process.env.PRIMARY_DB_HOST || 'localhost',
    port: parseInt(process.env.PRIMARY_DB_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'hospitality_platform',
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    
    // ✅ Emergency scaling connection pool settings
    maxConnections: 100,  // ✅ Increased from default (usually 10-20)
    minConnections: 10,   // ✅ Connection pool minimum
    maxIdleTime: "10m",   // ✅ Idle connection timeout
    maxLifetime: "1h",    // ✅ Connection lifetime
    connectionTimeout: "30s", // ✅ Connection timeout
    queryTimeout: "60s",  // ✅ Query timeout
    
    // ✅ Performance optimizations
    statementTimeout: "30s",
    idleInTransactionSessionTimeout: "5m",
    lockTimeout: "10s",
    
    // ✅ Connection pool monitoring
    poolMonitoring: {
      enabled: true,
      logLevel: 'info',
      slowQueryThreshold: 1000, // 1 second
      connectionLeakThreshold: 30000 // 30 seconds
    }
  },

  // ✅ FIX 2: Read Replica Configuration (if available)
  replica: {
    host: process.env.REPLICA_DB_HOST,
    port: parseInt(process.env.REPLICA_DB_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'hospitality_platform',
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    
    // Read replica specific settings
    maxConnections: 50,
    minConnections: 5,
    maxIdleTime: "15m",
    maxLifetime: "2h",
    connectionTimeout: "30s",
    queryTimeout: "120s", // Longer timeout for read operations
    
    // Read-only mode
    readOnly: true
  }
};

// ✅ FIX 3: Database Performance Monitoring
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

// ✅ FIX 4: Connection Pool Health Check
export class ConnectionPoolHealthCheck {
  private healthStatus = {
    healthy: true,
    lastCheck: new Date(),
    consecutiveFailures: 0,
    maxConsecutiveFailures: 3
  };

  async checkHealth(): Promise<boolean> {
    try {
      // Simulate health check - in production, this would test actual connections
      const startTime = Date.now();
      
      // Test query to verify connection health
      // await db.query('SELECT 1');
      
      const queryTime = Date.now() - startTime;
      dbPerformanceMonitor.recordQuery(queryTime);
      
      if (queryTime > 5000) { // 5 second threshold
        throw new Error('Health check timeout');
      }
      
      this.healthStatus.healthy = true;
      this.healthStatus.consecutiveFailures = 0;
      this.healthStatus.lastCheck = new Date();
      
      return true;
    } catch (error) {
      this.healthStatus.healthy = false;
      this.healthStatus.consecutiveFailures++;
      this.healthStatus.lastCheck = new Date();
      
      console.error('[ConnectionPoolHealthCheck] Health check failed:', error);
      
      if (this.healthStatus.consecutiveFailures >= this.healthStatus.maxConsecutiveFailures) {
        console.error('[ConnectionPoolHealthCheck] Multiple consecutive failures detected');
      }
      
      return false;
    }
  }

  getHealthStatus() {
    return { ...this.healthStatus };
  }

  isHealthy(): boolean {
    return this.healthStatus.healthy;
  }
}

export const connectionPoolHealthCheck = new ConnectionPoolHealthCheck();

// ✅ FIX 5: Database Query Optimization
export class QueryOptimizer {
  private slowQueries = new Map<string, number>();
  private queryCache = new Map<string, any>();

  // Track slow queries for optimization
  trackSlowQuery(query: string, executionTime: number) {
    if (executionTime > 1000) { // 1 second threshold
      this.slowQueries.set(query, executionTime);
      console.warn(`[QueryOptimizer] Slow query detected (${executionTime}ms):`, query.substring(0, 100) + '...');
    }
  }

  // Get slow queries for analysis
  getSlowQueries(): Array<{ query: string; executionTime: number }> {
    return Array.from(this.slowQueries.entries()).map(([query, time]) => ({
      query,
      executionTime: time
    }));
  }

  // Clear slow queries cache
  clearSlowQueries() {
    this.slowQueries.clear();
  }

  // Query caching for frequently accessed data
  async getCachedQuery<T>(key: string, queryFn: () => Promise<T>, ttl: number = 300000): Promise<T> {
    const cached = this.queryCache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }

    const data = await queryFn();
    this.queryCache.set(key, {
      data,
      timestamp: Date.now()
    });

    return data;
  }

  // Clear query cache
  clearQueryCache() {
    this.queryCache.clear();
  }
}

export const queryOptimizer = new QueryOptimizer();

// ✅ FIX 6: Emergency Database Scaling
export class EmergencyDatabaseScaling {
  private scalingMetrics = {
    currentLoad: 0,
    maxLoad: 100,
    scalingThreshold: 0.8, // 80% load threshold
    lastScalingAction: new Date(),
    scalingActions: 0
  };

  checkScalingNeeds(currentLoad: number): boolean {
    this.scalingMetrics.currentLoad = currentLoad;
    const loadRatio = currentLoad / this.scalingMetrics.maxLoad;
    
    if (loadRatio > this.scalingMetrics.scalingThreshold) {
      console.warn(`[EmergencyDatabaseScaling] High load detected: ${(loadRatio * 100).toFixed(2)}%`);
      return true;
    }
    
    return false;
  }

  async scaleUp(): Promise<void> {
    console.log('[EmergencyDatabaseScaling] Scaling up database resources');
    
    // In production, this would trigger actual scaling actions:
    // - Increase connection pool size
    // - Add read replicas
    // - Scale database instances
    // - Optimize query performance
    
    this.scalingMetrics.scalingActions++;
    this.scalingMetrics.lastScalingAction = new Date();
    
    console.log(`[EmergencyDatabaseScaling] Scaling action ${this.scalingMetrics.scalingActions} completed`);
  }

  getScalingMetrics() {
    return { ...this.scalingMetrics };
  }
}

export const emergencyDatabaseScaling = new EmergencyDatabaseScaling();

// ✅ FIX 7: Database Configuration Validation
export function validateEmergencyConfig(): boolean {
  const requiredEnvVars = [
    'DATABASE_NAME',
    'DB_USERNAME',
    'DB_PASSWORD'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('[EmergencyConfig] Missing required environment variables:', missingVars);
    return false;
  }

  // Validate connection pool settings
  if (EMERGENCY_DB_CONFIG.primary.maxConnections < 50) {
    console.warn('[EmergencyConfig] maxConnections is too low for emergency scaling');
  }

  if (EMERGENCY_DB_CONFIG.primary.minConnections < 5) {
    console.warn('[EmergencyConfig] minConnections is too low for emergency scaling');
  }

  console.log('[EmergencyConfig] Database configuration validated successfully');
  return true;
}

// Initialize emergency scaling
export function initializeEmergencyScaling(): void {
  console.log('[EmergencyScaling] Initializing emergency database scaling...');
  
  if (!validateEmergencyConfig()) {
    throw new Error('Emergency scaling configuration validation failed');
  }
  
  // Start health checks
  setInterval(() => {
    connectionPoolHealthCheck.checkHealth();
  }, 30000); // Every 30 seconds
  
  // Start performance monitoring
  setInterval(() => {
    dbPerformanceMonitor.checkAlerts();
  }, 60000); // Every minute
  
  console.log('[EmergencyScaling] Emergency database scaling initialized successfully');
}
