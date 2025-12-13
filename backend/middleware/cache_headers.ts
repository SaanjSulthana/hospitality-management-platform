// Cache Headers Middleware for CDN Integration
// Implements org-scoped cache keys and surrogate-key tagging
// Part of Phase 1: CDN Setup (Tasks 2.7 & 2.8)

export interface CacheConfig {
  /**
   * Cache-Control max-age in seconds
   * Default: 60 seconds
   */
  maxAge?: number;

  /**
   * Stale-while-revalidate window in seconds
   * Default: 300 seconds (5 minutes)
   */
  staleWhileRevalidate?: number;

  /**
   * Cache visibility: 'private' or 'public'
   * Default: 'private' for authenticated endpoints
   */
  visibility?: 'private' | 'public';

  /**
   * Surrogate keys for tag-based invalidation
   * Example: ['org:123', 'property:456', 'user:789']
   */
  surrogateKeys?: string[];

  /**
   * Vary header values
   * Default: ['Authorization'] for authenticated endpoints
   */
  vary?: string[];

  /**
   * Enable ETag generation
   * Default: true
   */
  enableETag?: boolean;
}

export interface CacheHeaders {
  'Cache-Control': string;
  'Surrogate-Key'?: string;
  'Vary'?: string;
  'ETag'?: string;
}

/**
 * Generate cache headers for CDN integration
 */
export function generateCacheHeaders(config: CacheConfig): CacheHeaders {
  const {
    maxAge = 60,
    staleWhileRevalidate = 300,
    visibility = 'private',
    surrogateKeys = [],
    vary = ['Authorization'],
  } = config;

  const headers: CacheHeaders = {
    'Cache-Control': `${visibility}, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
  };

  // Add surrogate keys for tag-based purging
  if (surrogateKeys.length > 0) {
    headers['Surrogate-Key'] = surrogateKeys.join(' ');
  }

  // Add Vary header
  if (vary.length > 0) {
    headers['Vary'] = vary.join(', ');
  }

  return headers;
}

/**
 * Generate org-scoped cache keys
 */
export function generateOrgCacheKeys(orgId: number, additionalKeys?: string[]): string[] {
  const keys = [`org:${orgId}`];

  if (additionalKeys) {
    keys.push(...additionalKeys);
  }

  return keys;
}

/**
 * Generate property-scoped cache keys
 */
export function generatePropertyCacheKeys(
  orgId: number,
  propertyId: number,
  additionalKeys?: string[]
): string[] {
  const keys = [
    `org:${orgId}`,
    `property:${propertyId}`,
    `org:${orgId}:property:${propertyId}`,
  ];

  if (additionalKeys) {
    keys.push(...additionalKeys);
  }

  return keys;
}

/**
 * Generate user-scoped cache keys
 */
export function generateUserCacheKeys(
  orgId: number,
  userId: number,
  additionalKeys?: string[]
): string[] {
  const keys = [
    `org:${orgId}`,
    `user:${userId}`,
    `org:${orgId}:user:${userId}`,
  ];

  if (additionalKeys) {
    keys.push(...additionalKeys);
  }

  return keys;
}

/**
 * Generate ETag from content
 */
export function generateETag(content: string | object): string {
  const str = typeof content === 'string' ? content : JSON.stringify(content);

  // Simple hash function for ETag
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return `"${Math.abs(hash).toString(36)}"`;
}

/**
 * Check if request has matching ETag (for 304 Not Modified)
 */
export function checkETag(requestETag: string | undefined, contentETag: string): boolean {
  if (!requestETag) return false;

  // Handle weak ETags
  const normalizedRequest = requestETag.replace(/^W\//, '');
  const normalizedContent = contentETag.replace(/^W\//, '');

  return normalizedRequest === normalizedContent;
}

/**
 * Generate cache metadata for API response
 * Returns metadata object to include in response _meta field
 *
 * Usage in endpoints:
 *
 * ```typescript
 * export const getProperty = api(
 *     { expose: true, method: "GET", path: "/v1/properties/:id" },
 *     async ({ id }): Promise<PropertyResponse> => {
 *         const property = await getPropertyById(id);
 *
 *         // Generate cache metadata
 *         const cacheMeta = generateCacheMetadata({
 *             maxAge: 300, // 5 minutes
 *             surrogateKeys: generatePropertyCacheKeys(property.orgId, property.id),
 *         });
 *
 *         return {
 *             ...property,
 *             _meta: cacheMeta
 *         };
 *     }
 * );
 * ```
 */
export function generateCacheMetadata(config: CacheConfig): {
  cacheControl?: string;
  surrogateKey?: string;
  vary?: string;
  etag?: string;
} {
  const headers = generateCacheHeaders(config);

  return {
    cacheControl: headers['Cache-Control'],
    surrogateKey: headers['Surrogate-Key'],
    vary: headers['Vary'],
    etag: headers['ETag'],
  };
}

/**
 * Generate cache metadata with ETag support
 * Checks If-None-Match header and returns appropriate metadata
 */
export function generateCacheMetadataWithETag(
  content: any,
  config: CacheConfig,
  ifNoneMatch?: string
): {
  shouldReturn304: boolean;
  metadata: {
    cacheControl?: string;
    surrogateKey?: string;
    vary?: string;
    etag: string;
    cached?: boolean;
  };
} {
  const etag = generateETag(content);
  const shouldReturn304 = checkETag(ifNoneMatch, etag);

  const headers = generateCacheHeaders(config);

  return {
    shouldReturn304,
    metadata: {
      cacheControl: headers['Cache-Control'],
      surrogateKey: headers['Surrogate-Key'],
      vary: headers['Vary'],
      etag,
      cached: shouldReturn304,
    },
  };
}

/**
 * Cache configuration presets for common scenarios
 */
export const CachePresets = {
  /**
   * Short-lived cache for frequently changing data
   * 1 minute cache, 5 minute stale-while-revalidate
   */
  SHORT: {
    maxAge: 60,
    staleWhileRevalidate: 300,
    visibility: 'private' as const,
  },

  /**
   * Medium-lived cache for moderately stable data
   * 5 minutes cache, 15 minute stale-while-revalidate
   */
  MEDIUM: {
    maxAge: 300,
    staleWhileRevalidate: 900,
    visibility: 'private' as const,
  },

  /**
   * Long-lived cache for stable data
   * 1 hour cache, 6 hour stale-while-revalidate
   */
  LONG: {
    maxAge: 3600,
    staleWhileRevalidate: 21600,
    visibility: 'private' as const,
  },

  /**
   * Public cache for static/public data
   * 1 day cache, 7 day stale-while-revalidate
   */
  PUBLIC: {
    maxAge: 86400,
    staleWhileRevalidate: 604800,
    visibility: 'public' as const,
  },

  /**
   * No cache for sensitive/real-time data
   */
  NO_CACHE: {
    maxAge: 0,
    staleWhileRevalidate: 0,
    visibility: 'private' as const,
  },
};

/**
 * Example usage patterns
 */
export const CacheExamples = {
  /**
   * Property list endpoint
   */
  propertyList: (orgId: number): CacheConfig => ({
    ...CachePresets.MEDIUM,
    surrogateKeys: generateOrgCacheKeys(orgId, ['properties']),
  }),

  /**
   * Single property endpoint
   */
  propertyDetail: (orgId: number, propertyId: number): CacheConfig => ({
    ...CachePresets.LONG,
    surrogateKeys: generatePropertyCacheKeys(orgId, propertyId),
  }),

  /**
   * Finance data (frequently updated)
   */
  financeData: (orgId: number, propertyId: number): CacheConfig => ({
    ...CachePresets.SHORT,
    surrogateKeys: generatePropertyCacheKeys(orgId, propertyId, ['finance']),
  }),

  /**
   * User profile
   */
  userProfile: (orgId: number, userId: number): CacheConfig => ({
    ...CachePresets.MEDIUM,
    surrogateKeys: generateUserCacheKeys(orgId, userId),
  }),

  /**
   * Reports (can be cached longer)
   */
  reports: (orgId: number, propertyId: number, reportType: string): CacheConfig => ({
    ...CachePresets.LONG,
    surrogateKeys: generatePropertyCacheKeys(orgId, propertyId, [`report:${reportType}`]),
  }),
};
