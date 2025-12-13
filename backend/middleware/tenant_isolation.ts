/**
 * Tenant Cache Isolation
 * 
 * Implements secure multi-tenant cache partitioning via X-Org-Key header.
 * 
 * SECURITY POLICY:
 * - X-Org-Key is computed server-side from validated orgId
 * - X-Org-Key MUST NOT appear in client-visible response headers
 * - CDN must strip X-Org-Key in edge response transform
 * 
 * @see docs/NETWORKING_AND_REALTIME_IMPROVEMENTS.md Decision Log
 */

import { createHash } from 'crypto';

/**
 * Generate a deterministic, non-reversible tenant key from orgId
 * 
 * Uses SHA-256 hash truncated to 16 chars for:
 * - Security: orgId cannot be derived from the key
 * - Efficiency: Short key for cache key composition
 * - Determinism: Same orgId always produces same key
 */
export function generateTenantKey(orgId: number): string {
  const hash = createHash('sha256')
    .update(`org:${orgId}:tenant-isolation-key`)
    .digest('hex')
    .slice(0, 16);
  return hash;
}

/**
 * Generate Base32-encoded tenant key (alternative format for CDN compatibility)
 */
export function generateTenantKeyBase32(orgId: number): string {
  const hash = createHash('sha256')
    .update(`org:${orgId}:tenant-isolation-key`)
    .digest();
  
  // Simple Base32 encoding (RFC 4648)
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  let bits = 0;
  let value = 0;
  
  for (let i = 0; i < 10; i++) { // 10 bytes = 16 base32 chars
    value = (value << 8) | hash[i];
    bits += 8;
    
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  
  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 0x1f];
  }
  
  return result.slice(0, 16);
}

/**
 * Headers that MUST be stripped from client responses
 * 
 * These are internal headers for CDN cache keying and should never
 * be visible to end clients for security reasons.
 */
export const INTERNAL_HEADERS_TO_STRIP = [
  'X-Org-Key',
  'Surrogate-Key',
  'Surrogate-Control',
  'X-Cache-Tags',
  'X-Tenant-Partition',
] as const;

/**
 * Generate tenant isolation headers for CDN cache keying
 * 
 * @param orgId - Validated organization ID from auth context
 * @returns Headers object with X-Org-Key (to be stripped by CDN)
 */
export function generateTenantHeaders(orgId: number): Record<string, string> {
  const tenantKey = generateTenantKey(orgId);
  
  return {
    // Primary tenant isolation key (CDN includes in cache key, then strips)
    'X-Org-Key': tenantKey,
    
    // Backup for CDNs that use different header names
    'X-Tenant-Partition': tenantKey,
  };
}

/**
 * Validate that response headers don't leak internal information
 * 
 * @param headers - Response headers to check
 * @returns Array of leaked header names (empty if clean)
 */
export function checkForLeakedHeaders(headers: Record<string, string>): string[] {
  const leaked: string[] = [];
  
  for (const forbidden of INTERNAL_HEADERS_TO_STRIP) {
    if (headers[forbidden] || headers[forbidden.toLowerCase()]) {
      leaked.push(forbidden);
    }
  }
  
  return leaked;
}

/**
 * Strip internal headers from response (for edge functions)
 * 
 * @param headers - Response headers to sanitize
 * @returns New headers object without internal headers
 */
export function stripInternalHeaders(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(headers)) {
    const keyLower = key.toLowerCase();
    const shouldStrip = INTERNAL_HEADERS_TO_STRIP.some(
      h => h.toLowerCase() === keyLower
    );
    
    if (!shouldStrip) {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Cache key composition helper
 * 
 * Generates a full cache key including tenant partition for manual caching
 * (e.g., Redis, in-memory caches)
 */
export function composeCacheKey(
  orgId: number,
  ...keyParts: (string | number | undefined | null)[]
): string {
  const tenantKey = generateTenantKey(orgId);
  const parts = keyParts.filter(p => p !== undefined && p !== null);
  
  return `tk:${tenantKey}:${parts.join(':')}`;
}

/**
 * Parse cache key to extract components
 */
export function parseCacheKey(cacheKey: string): {
  tenantKey: string;
  keyParts: string[];
} | null {
  const match = cacheKey.match(/^tk:([^:]+):(.*)$/);
  
  if (!match) {
    return null;
  }
  
  return {
    tenantKey: match[1],
    keyParts: match[2].split(':'),
  };
}

/**
 * Tenant isolation configuration
 */
export interface TenantIsolationConfig {
  /** Whether tenant isolation is enabled */
  enabled: boolean;
  
  /** Header name for tenant key (default: X-Org-Key) */
  headerName: string;
  
  /** Whether to use Base32 encoding (default: false, uses hex) */
  useBase32: boolean;
  
  /** Whether to log leaked headers (default: true in development) */
  logLeakedHeaders: boolean;
}

const DEFAULT_CONFIG: TenantIsolationConfig = {
  enabled: true,
  headerName: 'X-Org-Key',
  useBase32: false,
  logLeakedHeaders: process.env.NODE_ENV !== 'production',
};

let config = { ...DEFAULT_CONFIG };

/**
 * Configure tenant isolation behavior
 */
export function configureTenantIsolation(options: Partial<TenantIsolationConfig>): void {
  config = { ...config, ...options };
}

/**
 * Get current configuration
 */
export function getTenantIsolationConfig(): Readonly<TenantIsolationConfig> {
  return { ...config };
}

/**
 * Generate all tenant-aware cache headers
 * 
 * This is the main entry point for adding tenant isolation to responses.
 * Called by the networking middleware wrapper.
 */
export function generateTenantAwareCacheHeaders(
  orgId: number,
  additionalHeaders: Record<string, string> = {}
): Record<string, string> {
  if (!config.enabled) {
    return additionalHeaders;
  }
  
  const tenantKey = config.useBase32
    ? generateTenantKeyBase32(orgId)
    : generateTenantKey(orgId);
  
  return {
    ...additionalHeaders,
    [config.headerName]: tenantKey,
  };
}

/**
 * Middleware to add tenant headers to response
 * 
 * Usage with Encore:
 * ```typescript
 * export const myEndpoint = api(
 *   { auth: true },
 *   async (req) => {
 *     const tenantHeaders = addTenantHeaders(auth.orgId, {});
 *     // Include tenantHeaders in response
 *   }
 * );
 * ```
 */
export function addTenantHeaders(
  orgId: number,
  existingHeaders: Record<string, string> = {}
): Record<string, string> {
  return generateTenantAwareCacheHeaders(orgId, existingHeaders);
}

// Export all functions and types
export type { TenantIsolationConfig };

