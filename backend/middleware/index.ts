/**
 * Middleware Module Index
 * 
 * Exports all networking optimization utilities for use across services.
 * 
 * @see docs/NETWORKING_AND_REALTIME_IMPROVEMENTS.md
 */

// Metrics and instrumentation
export {
  recordMetric,
  getMetricsSummary,
  getEndpointFamily,
  resetMetrics,
  getSampleCount,
  type EndpointFamily,
  type AggregatedMetrics,
  type MetricsSummary,
} from './metrics_aggregator';

export {
  createRequestTimer,
  withMetrics,
  trackMetrics,
  recordRequestMetric,
  getOrCreateRequestId,
  RequestTimer,
  type ResponseMetadata,
} from './response_metrics';

// Compression
export {
  compressResponse,
  compressWithMetrics,
  parseAcceptEncoding,
  getCompressionHeaders,
  isCompressibleContentType,
  getCompressionStats,
  recordCompressionStats,
  resetCompressionStats,
  type CompressionResult,
  type CompressionOptions,
  type CompressionStats,
} from './compression';

// ETag and conditional GET
export {
  generateETag,
  generateWeakETag,
  validateETag,
  checkConditionalGet,
  checkConditionalGetFromData,
  getETagHeaders,
  parseIfNoneMatch,
  etagMatches,
  getETagStats,
  recordETagCheck,
  resetETagStats,
  generateCollectionETag,
  generatePaginatedETag,
  type ETagValidationResult,
  type ConditionalResponse,
  type ETagStats,
} from './etag';

// Last-Modified
export {
  updateLastModified,
  getLastModified,
  validateIfModifiedSince,
  parseIfModifiedSince,
  isModifiedSince,
  getLastModifiedHeader,
  getLastModifiedHeaders,
  bulkUpdateLastModified,
  clearOrgLastModified,
  clearAllLastModified,
  getLastModifiedStats,
  type EntityType,
  type LastModifiedValidation,
} from './last_modified';

// Cache headers
export {
  getCachePolicy,
  getCachePolicyForEndpoint,
  buildCacheControlHeader,
  generateSurrogateKeys,
  buildSurrogateKeyHeader,
  generateCacheHeaders,
  generateImmutableHeaders,
  generateNoCacheHeaders,
  type CachePolicy,
  type SurrogateKeyContext,
  type CacheHeaders,
} from './cache_headers';

// Baseline metrics endpoints
export {
  getBaselineMetrics,
  getFamilyMetrics,
  getSLOStatus,
} from './baseline_metrics';

// Combined middleware wrapper
export {
  withNetworkingOptimizations,
  withMetricsOnly,
  type NetworkingOptions,
  type OptimizedResponse,
} from './wrapper';

// Tenant isolation (X-Org-Key)
export {
  generateTenantKey,
  generateTenantKeyBase32,
  generateTenantHeaders,
  generateTenantAwareCacheHeaders,
  addTenantHeaders,
  stripInternalHeaders,
  checkForLeakedHeaders,
  composeCacheKey,
  parseCacheKey,
  configureTenantIsolation,
  getTenantIsolationConfig,
  INTERNAL_HEADERS_TO_STRIP,
  type TenantIsolationConfig,
} from './tenant_isolation';

// Rate limiting (token bucket)
export {
  checkRateLimit,
  checkRateLimits,
  checkWriteRateLimit,
  checkReadRateLimit,
  checkRealtimeRateLimit,
  checkSignedUrlRateLimit,
  enforceRateLimit,
  getRateLimitHeaders,
  createRateLimitError,
  getRateLimitStats,
  resetAllRateLimits,
  resetRateLimit,
  setRateLimitTokens,
  RATE_LIMITS,
  type RateLimitType,
  type RateLimitConfig,
  type RateLimitResult,
} from './rate_limiter';

// Idempotency-Key enforcement
export {
  checkIdempotencyKey,
  storeIdempotencyRecord,
  deleteIdempotencyRecord,
  handleIdempotency,
  validateIdempotencyKey,
  extractIdempotencyKey,
  createConflictResponse,
  getIdempotencyHeaders,
  requiresIdempotencyKey,
  getIdempotencyStats,
  clearAllIdempotencyRecords,
  IDEMPOTENT_ENDPOINTS,
  type IdempotencyCheckResult,
} from './idempotency';

// CDN purge management
export {
  initPurgeManager,
  getPurgeManager,
  queuePurge,
  queueCoarsePurge,
  getPurgeStats,
  triggerPurgeOnMutation,
  PurgeManager,
  type CDNProvider,
  type CDNConfig,
  type PurgeResult,
  type PurgeStats,
} from './purge_manager';

// Field selector (sparse field selection)
export {
  parseFieldsParam,
  resolveFields,
  filterFields,
  filterArrayFields,
  applyFieldSelection,
  createFieldSelector,
  getFieldSelectorForPath,
  getAvailableFields,
  getDefaultFields,
  supportsFieldSelection,
  normalizeEndpointPath,
  calculatePayloadSavings,
  recordFieldSelectionStats,
  getFieldSelectionStats,
  resetFieldSelectionStats,
  FIELD_SPECS,
  type FieldSpec,
} from './field_selector';

