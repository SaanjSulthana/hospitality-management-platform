// Runtime Configuration - Centralized settings for environment-specific behavior
// Target: Consistent configuration across all services for scalability

// Environment detection
const isProduction = process.env.NODE_ENV === 'production';
const isStaging = process.env.NODE_ENV === 'staging';
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined;

// Pub/Sub Configuration
export const PubSubConfig = {
  // Maximum concurrent message processing
  maxConcurrency: parseInt(process.env.PUBSUB_MAX_CONCURRENCY || (isProduction ? '5000' : isStaging ? '1000' : '100')),
  
  // Acknowledgement deadline (how long subscriber has to process message)
  ackDeadline: process.env.PUBSUB_ACK_DEADLINE || (isProduction ? '60s' : isStaging ? '45s' : '30s'),
  
  // Retry configuration
  retryPolicy: {
    maxAttempts: parseInt(process.env.PUBSUB_MAX_RETRY_ATTEMPTS || (isProduction ? '5' : '3')),
    minBackoff: process.env.PUBSUB_MIN_BACKOFF || '1s',
    maxBackoff: process.env.PUBSUB_MAX_BACKOFF || (isProduction ? '60s' : '30s'),
  },
  
  // Dead letter configuration
  deadLetterPolicy: {
    enabled: process.env.PUBSUB_DEAD_LETTER_ENABLED === 'true' || isProduction,
    maxDeliveryAttempts: parseInt(process.env.PUBSUB_MAX_DELIVERY_ATTEMPTS || '5'),
  },
};

// Database Configuration
export const DatabaseConfig = {
  // Connection pool settings
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || (isProduction ? '100' : isStaging ? '50' : '20')),
  minConnections: parseInt(process.env.DB_MIN_CONNECTIONS || (isProduction ? '10' : isStaging ? '5' : '2')),
  maxIdleTime: process.env.DB_MAX_IDLE_TIME || (isProduction ? '10m' : '15m'),
  maxLifetime: process.env.DB_MAX_LIFETIME || (isProduction ? '1h' : '2h'),
  connectionTimeout: process.env.DB_CONNECTION_TIMEOUT || '30s',
  queryTimeout: process.env.DB_QUERY_TIMEOUT || (isProduction ? '60s' : '120s'),
  
  // Partitioning settings
  // Enable partitioned tables by default in staging/prod, opt-in for dev
  usePartitionedTables: process.env.USE_PARTITIONED_TABLES === 'true' || (isStaging || isProduction),
  enablePartitionRouting: process.env.ENABLE_PARTITION_ROUTING === 'true' || (isStaging || isProduction),
  enablePartitionMaintenance: process.env.ENABLE_PARTITION_MAINTENANCE === 'true' || true,
  partitionRetentionMonths: parseInt(process.env.PARTITION_RETENTION_MONTHS || '24'),
  
  // Read replica settings
  useReadReplicas: process.env.USE_READ_REPLICAS === 'true' || isProduction,
  replicaMaxConnections: parseInt(process.env.REPLICA_MAX_CONNECTIONS || (isProduction ? '50' : '25')),
  replicaMinConnections: parseInt(process.env.REPLICA_MIN_CONNECTIONS || (isProduction ? '5' : '2')),
};

// Cache Configuration
export const CacheConfig = {
  // Cache size settings
  maxEntries: parseInt(process.env.CACHE_MAX_ENTRIES || (isProduction ? '10000' : isStaging ? '5000' : '1000')),
  
  // TTL settings
  defaultTtlMs: parseInt(process.env.CACHE_DEFAULT_TTL_MS || (isProduction ? '120000' : '180000')), // 2-3 minutes
  activeDateTtlMs: parseInt(process.env.CACHE_ACTIVE_DATE_TTL_MS || '15000'), // 15 seconds
  historicalDateTtlMs: parseInt(process.env.CACHE_HISTORICAL_DATE_TTL_MS || (isProduction ? '120000' : '180000')), // 2-3 minutes
  
  // Invalidation settings
  batchSize: parseInt(process.env.CACHE_BATCH_SIZE || '100'),
  batchInterval: parseInt(process.env.CACHE_BATCH_INTERVAL || '5000'), // 5 seconds
  maxBatchWaitTime: parseInt(process.env.CACHE_MAX_BATCH_WAIT_TIME || '10000'), // 10 seconds
  
  // Redis configuration (external cache store)
  redis: {
    enabled: process.env.REDIS_HOST !== undefined,
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    useTLS: process.env.REDIS_USE_TLS === 'true',
    maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '5000'), // 5 seconds
  },
};

// Batch Processing Configuration
export const BatchConfig = {
  // Correction batcher settings
  correctionBatchSize: parseInt(process.env.CORRECTION_BATCH_SIZE || '100'),
  correctionBatchInterval: parseInt(process.env.CORRECTION_BATCH_INTERVAL || '300000'), // 5 minutes
  
  // General batch processing
  defaultBatchSize: parseInt(process.env.DEFAULT_BATCH_SIZE || (isProduction ? '1000' : '500')),
  defaultBatchInterval: parseInt(process.env.DEFAULT_BATCH_INTERVAL || '60000'), // 1 minute
};

// Resilience Configuration
export const ResilienceConfig = {
  // Circuit breaker settings
  circuitBreaker: {
    failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5'),
    resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '60000'), // 1 minute
    halfOpenMaxCalls: parseInt(process.env.CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS || '3'),
    timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || (isProduction ? '30000' : '60000')), // 30-60 seconds
  },
  
  // Retry settings
  retry: {
    maxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS || (isProduction ? '5' : '3')),
    initialDelay: parseInt(process.env.RETRY_INITIAL_DELAY || '1000'), // 1 second
    maxDelay: parseInt(process.env.RETRY_MAX_DELAY || (isProduction ? '60000' : '30000')), // 30-60 seconds
    multiplier: parseFloat(process.env.RETRY_MULTIPLIER || '2.0'),
    timeout: parseInt(process.env.RETRY_TIMEOUT || (isProduction ? '30000' : '60000')), // 30-60 seconds
  },
  
  // Rate limiter settings
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || (isProduction ? '2000' : '500')),
    priority: {
      high: parseInt(process.env.RATE_LIMIT_HIGH_PRIORITY || (isProduction ? '2000' : '500')),
      medium: parseInt(process.env.RATE_LIMIT_MEDIUM_PRIORITY || (isProduction ? '1000' : '250')),
      low: parseInt(process.env.RATE_LIMIT_LOW_PRIORITY || (isProduction ? '500' : '100')),
    },
  },
  
  // Bulkhead settings
  bulkhead: {
    maxConcurrent: parseInt(process.env.BULKHEAD_MAX_CONCURRENT || (isProduction ? '100' : '50')),
    maxQueue: parseInt(process.env.BULKHEAD_MAX_QUEUE || (isProduction ? '1000' : '500')),
    timeout: parseInt(process.env.BULKHEAD_TIMEOUT || (isProduction ? '30000' : '60000')), // 30-60 seconds
  },
};

// Event Sourcing Configuration
export const EventSourcingConfig = {
  // Event store settings
  maxEventsPerSnapshot: parseInt(process.env.EVENT_STORE_MAX_EVENTS_PER_SNAPSHOT || '100'),
  snapshotInterval: parseInt(process.env.EVENT_STORE_SNAPSHOT_INTERVAL || '1000'), // 1 second
  retentionDays: parseInt(process.env.EVENT_STORE_RETENTION_DAYS || '365'),
  compressionEnabled: process.env.EVENT_STORE_COMPRESSION_ENABLED === 'true' || true,
  
  // Read model settings
  projectionInterval: parseInt(process.env.READ_MODEL_PROJECTION_INTERVAL || '60000'), // 1 minute
  projectionBatchSize: parseInt(process.env.READ_MODEL_PROJECTION_BATCH_SIZE || '1000'),
  readModelRetentionDays: parseInt(process.env.READ_MODEL_RETENTION_DAYS || '365'),
};

// Monitoring Configuration
export const MonitoringConfig = {
  // Metrics collection settings
  metricsEnabled: process.env.METRICS_ENABLED === 'true' || true,
  metricsInterval: parseInt(process.env.METRICS_INTERVAL || '60000'), // 1 minute
  
  // Health check settings
  healthCheckEnabled: process.env.HEALTH_CHECK_ENABLED === 'true' || true,
  healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'), // 30 seconds
  
  // Alert thresholds
  alerts: {
    errorRateThreshold: parseFloat(process.env.ALERT_ERROR_RATE_THRESHOLD || (isProduction ? '0.01' : '0.05')), // 1-5%
    latencyThresholdMs: parseInt(process.env.ALERT_LATENCY_THRESHOLD_MS || (isProduction ? '500' : '1000')), // 500ms-1s
    cpuThreshold: parseFloat(process.env.ALERT_CPU_THRESHOLD || '0.8'), // 80%
    memoryThreshold: parseFloat(process.env.ALERT_MEMORY_THRESHOLD || '0.85'), // 85%
  },
};

// Feature Flags
export const FeatureFlags = {
  // Scalability features
  usePartitionedTables: DatabaseConfig.usePartitionedTables,
  useReadReplicas: DatabaseConfig.useReadReplicas,
  useEventSourcing: process.env.USE_EVENT_SOURCING === 'true' || isProduction,
  useMicroservices: process.env.USE_MICROSERVICES === 'true' || isProduction,
  
  // Performance features
  useCacheWarming: process.env.USE_CACHE_WARMING === 'true' || true,
  useBatchProcessing: process.env.USE_BATCH_PROCESSING === 'true' || true,
  useAsyncInvalidation: process.env.USE_ASYNC_INVALIDATION === 'true' || true,
  
  // Monitoring features
  useAdvancedMonitoring: process.env.USE_ADVANCED_MONITORING === 'true' || isProduction,
  useRealTimeUpdates: process.env.USE_REALTIME_UPDATES === 'true' || true,
};

// Environment Info
export const EnvironmentInfo = {
  isProduction,
  isStaging,
  isDevelopment,
  nodeEnv: process.env.NODE_ENV || 'development',
  version: process.env.APP_VERSION || '1.0.0',
};

// Export all configurations
export default {
  PubSubConfig,
  DatabaseConfig,
  CacheConfig,
  BatchConfig,
  ResilienceConfig,
  EventSourcingConfig,
  MonitoringConfig,
  FeatureFlags,
  EnvironmentInfo,
};

