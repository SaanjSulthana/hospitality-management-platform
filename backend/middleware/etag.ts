/**
 * ETag Support
 * 
 * Generates strong ETags from response body hash and handles
 * If-None-Match validation for 304 Not Modified responses.
 * 
 * Uses xxhash-style hashing for speed (implemented with crypto for compatibility).
 */

import { createHash } from 'crypto';

/**
 * ETag validation result
 */
export interface ETagValidationResult {
  isMatch: boolean;
  etag: string;
  clientEtag?: string;
}

/**
 * Generate a strong ETag from data
 * Uses SHA-256 truncated to 16 chars for a good balance of uniqueness and size
 */
export function generateETag(data: string | Buffer | object): string {
  let content: string;
  
  if (Buffer.isBuffer(data)) {
    content = data.toString('utf-8');
  } else if (typeof data === 'string') {
    content = data;
  } else {
    // Stable JSON stringification for objects
    content = stableStringify(data);
  }
  
  const hash = createHash('sha256')
    .update(content)
    .digest('hex')
    .slice(0, 16);
  
  // Strong ETag format: "hash"
  return `"${hash}"`;
}

/**
 * Generate a weak ETag (for semantically equivalent but not byte-identical responses)
 */
export function generateWeakETag(data: string | Buffer | object): string {
  const strongEtag = generateETag(data);
  // Weak ETag format: W/"hash"
  return `W/${strongEtag}`;
}

/**
 * Stable JSON stringification that produces consistent output
 * regardless of object key ordering
 */
function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return String(obj);
  }
  
  if (typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  
  if (Array.isArray(obj)) {
    return '[' + obj.map(stableStringify).join(',') + ']';
  }
  
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map(key => {
    const value = (obj as Record<string, unknown>)[key];
    return `${JSON.stringify(key)}:${stableStringify(value)}`;
  });
  
  return '{' + pairs.join(',') + '}';
}

/**
 * Parse If-None-Match header value
 * Returns array of ETags (handles multiple ETags and wildcards)
 */
export function parseIfNoneMatch(headerValue?: string): string[] {
  if (!headerValue) return [];
  
  // Handle wildcard
  if (headerValue.trim() === '*') {
    return ['*'];
  }
  
  // Parse comma-separated ETags
  return headerValue
    .split(',')
    .map(etag => etag.trim())
    .filter(etag => etag.length > 0);
}

/**
 * Check if ETag matches any of the client's If-None-Match values
 */
export function etagMatches(serverEtag: string, clientEtags: string[]): boolean {
  if (clientEtags.length === 0) return false;
  
  // Wildcard matches everything
  if (clientEtags.includes('*')) return true;
  
  // Normalize server ETag (remove W/ prefix for weak comparison)
  const normalizedServer = serverEtag.replace(/^W\//, '');
  
  return clientEtags.some(clientEtag => {
    const normalizedClient = clientEtag.replace(/^W\//, '');
    return normalizedServer === normalizedClient;
  });
}

/**
 * Validate ETag and return result
 */
export function validateETag(
  data: string | Buffer | object,
  ifNoneMatch?: string
): ETagValidationResult {
  const etag = generateETag(data);
  const clientEtags = parseIfNoneMatch(ifNoneMatch);
  
  return {
    isMatch: etagMatches(etag, clientEtags),
    etag,
    clientEtag: clientEtags[0], // First client ETag for logging
  };
}

/**
 * Create ETag headers for response
 */
export function getETagHeaders(etag: string): Record<string, string> {
  return {
    'ETag': etag,
  };
}

/**
 * Conditional response helper
 * Returns headers and whether to send 304
 */
export interface ConditionalResponse {
  should304: boolean;
  isMatch: boolean;  // Alias for should304 for backward compatibility
  etag: string;
  headers: Record<string, string>;
}

/**
 * Simple ETag comparison - returns boolean
 * Use this when you've already generated an ETag
 */
export function checkConditionalGet(
  serverEtag: string,
  ifNoneMatch?: string
): boolean {
  if (!ifNoneMatch) return false;
  
  const clientEtags = parseIfNoneMatch(ifNoneMatch);
  return etagMatches(serverEtag, clientEtags);
}

/**
 * Full conditional GET check with data hashing
 * Returns detailed response with headers
 */
export function checkConditionalGetFromData(
  data: string | Buffer | object,
  ifNoneMatch?: string,
  ifModifiedSince?: string,
  lastModified?: Date
): ConditionalResponse {
  const validation = validateETag(data, ifNoneMatch);
  
  // ETag takes precedence over Last-Modified
  if (validation.isMatch) {
    return {
      should304: true,
      isMatch: true,
      etag: validation.etag,
      headers: {
        'ETag': validation.etag,
        ...(lastModified && { 'Last-Modified': lastModified.toUTCString() }),
      },
    };
  }
  
  // Check Last-Modified if no ETag match and If-Modified-Since is present
  if (ifModifiedSince && lastModified) {
    const clientDate = new Date(ifModifiedSince);
    if (!isNaN(clientDate.getTime()) && lastModified <= clientDate) {
      return {
        should304: true,
        isMatch: true,
        etag: validation.etag,
        headers: {
          'ETag': validation.etag,
          'Last-Modified': lastModified.toUTCString(),
        },
      };
    }
  }
  
  return {
    should304: false,
    isMatch: false,
    etag: validation.etag,
    headers: {
      'ETag': validation.etag,
      ...(lastModified && { 'Last-Modified': lastModified.toUTCString() }),
    },
  };
}

/**
 * ETag statistics for monitoring
 */
export interface ETagStats {
  totalChecks: number;
  matches: number;
  misses: number;
  hitRate: number;
}

// In-memory stats
const stats = {
  totalChecks: 0,
  matches: 0,
};

/**
 * Record ETag check result
 */
export function recordETagCheck(isMatch: boolean): void {
  stats.totalChecks++;
  if (isMatch) {
    stats.matches++;
  }
}

/**
 * Get ETag statistics
 */
export function getETagStats(): ETagStats {
  return {
    totalChecks: stats.totalChecks,
    matches: stats.matches,
    misses: stats.totalChecks - stats.matches,
    hitRate: stats.totalChecks > 0 ? stats.matches / stats.totalChecks : 0,
  };
}

/**
 * Reset ETag stats (for testing)
 */
export function resetETagStats(): void {
  stats.totalChecks = 0;
  stats.matches = 0;
}

/**
 * Generate ETag for a collection based on actual content
 * Deterministic - same data always produces same ETag
 */
export function generateCollectionETag(
  items: unknown[],
  count?: number
): string {
  // Hash the actual content for deterministic ETags
  // Use stableStringify to ensure consistent ordering
  return generateETag(items);
}

/**
 * Generate ETag for paginated results
 * Deterministic - same data always produces same ETag
 */
export function generatePaginatedETag(
  items: unknown[],
  page: number,
  pageSize: number,
  totalCount: number
): string {
  // Include pagination context in hash for uniqueness per page
  const paginatedData = {
    page,
    pageSize,
    totalCount,
    items,
  };
  
  return generateETag(paginatedData);
}
