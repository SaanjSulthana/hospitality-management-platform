/**
 * Last-Modified Support
 * 
 * Tracks data freshness watermarks per entity type and handles
 * If-Modified-Since validation for 304 Not Modified responses.
 */

/**
 * Entity types for tracking last modified times
 */
export type EntityType = 
  | 'properties'
  | 'users'
  | 'branding'
  | 'finance_summary'
  | 'finance_transactions'
  | 'reports_daily'
  | 'reports_monthly'
  | 'analytics'
  | 'staff'
  | 'tasks'
  | 'guest_checkins';

/**
 * In-memory storage for last modified timestamps per org/entity
 * Key format: `${orgId}:${entityType}` or `${orgId}:${entityType}:${entityId}`
 */
const lastModifiedStore = new Map<string, Date>();

/**
 * Build storage key for entity
 */
function buildKey(orgId: number, entityType: EntityType, entityId?: string | number): string {
  if (entityId !== undefined) {
    return `${orgId}:${entityType}:${entityId}`;
  }
  return `${orgId}:${entityType}`;
}

/**
 * Update last modified timestamp for an entity
 */
export function updateLastModified(
  orgId: number,
  entityType: EntityType,
  entityId?: string | number,
  timestamp?: Date
): void {
  const key = buildKey(orgId, entityType, entityId);
  lastModifiedStore.set(key, timestamp ?? new Date());
  
  // Also update the entity type level (without ID) for collection queries
  if (entityId !== undefined) {
    const typeKey = buildKey(orgId, entityType);
    const current = lastModifiedStore.get(typeKey);
    const newTimestamp = timestamp ?? new Date();
    
    if (!current || newTimestamp > current) {
      lastModifiedStore.set(typeKey, newTimestamp);
    }
  }
}

/**
 * Get last modified timestamp for an entity
 */
export function getLastModified(
  orgId: number,
  entityType: EntityType,
  entityId?: string | number
): Date | undefined {
  const key = buildKey(orgId, entityType, entityId);
  return lastModifiedStore.get(key);
}

/**
 * Parse If-Modified-Since header
 */
export function parseIfModifiedSince(headerValue?: string): Date | undefined {
  if (!headerValue) return undefined;
  
  try {
    const date = new Date(headerValue);
    if (isNaN(date.getTime())) return undefined;
    return date;
  } catch {
    return undefined;
  }
}

/**
 * Check if resource has been modified since the client's last request
 */
export function isModifiedSince(
  lastModified: Date | undefined,
  ifModifiedSince: Date | undefined
): boolean {
  if (!lastModified || !ifModifiedSince) return true;
  
  // Compare timestamps (truncate to seconds for HTTP date comparison)
  const lastModifiedSeconds = Math.floor(lastModified.getTime() / 1000);
  const ifModifiedSinceSeconds = Math.floor(ifModifiedSince.getTime() / 1000);
  
  return lastModifiedSeconds > ifModifiedSinceSeconds;
}

/**
 * Check conditional request and return 304 status
 */
export interface LastModifiedValidation {
  shouldReturn304: boolean;
  lastModified?: Date;
  lastModifiedHeader?: string;
}

export function validateIfModifiedSince(
  orgId: number,
  entityType: EntityType,
  ifModifiedSinceHeader?: string,
  entityId?: string | number
): LastModifiedValidation {
  const lastModified = getLastModified(orgId, entityType, entityId);
  const ifModifiedSince = parseIfModifiedSince(ifModifiedSinceHeader);
  
  if (!lastModified) {
    return {
      shouldReturn304: false,
      lastModified: undefined,
    };
  }
  
  const modified = isModifiedSince(lastModified, ifModifiedSince);
  
  return {
    shouldReturn304: !modified,
    lastModified,
    lastModifiedHeader: lastModified.toUTCString(),
  };
}

/**
 * Get Last-Modified header value
 */
export function getLastModifiedHeader(date: Date): string {
  return date.toUTCString();
}

/**
 * Create Last-Modified headers for response
 */
export function getLastModifiedHeaders(lastModified?: Date): Record<string, string> {
  if (!lastModified) return {};
  
  return {
    'Last-Modified': lastModified.toUTCString(),
  };
}

/**
 * Bulk update for batch operations
 */
export function bulkUpdateLastModified(
  orgId: number,
  entityType: EntityType,
  entityIds: (string | number)[],
  timestamp?: Date
): void {
  const ts = timestamp ?? new Date();
  
  for (const entityId of entityIds) {
    updateLastModified(orgId, entityType, entityId, ts);
  }
}

/**
 * Clear last modified entries for an org (on major changes)
 */
export function clearOrgLastModified(orgId: number): void {
  const prefix = `${orgId}:`;
  
  for (const key of lastModifiedStore.keys()) {
    if (key.startsWith(prefix)) {
      lastModifiedStore.delete(key);
    }
  }
}

/**
 * Clear all last modified entries (for testing)
 */
export function clearAllLastModified(): void {
  lastModifiedStore.clear();
}

/**
 * Get statistics about last modified tracking
 */
export function getLastModifiedStats(): {
  totalEntries: number;
  byEntityType: Record<EntityType, number>;
} {
  const byEntityType: Partial<Record<EntityType, number>> = {};
  
  for (const key of lastModifiedStore.keys()) {
    const parts = key.split(':');
    if (parts.length >= 2) {
      const entityType = parts[1] as EntityType;
      byEntityType[entityType] = (byEntityType[entityType] || 0) + 1;
    }
  }
  
  return {
    totalEntries: lastModifiedStore.size,
    byEntityType: byEntityType as Record<EntityType, number>,
  };
}

/**
 * Periodic cleanup for stale entries (entries older than 24 hours)
 */
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

function cleanupStaleEntries(): void {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);
  
  for (const [key, date] of lastModifiedStore.entries()) {
    if (date < cutoff) {
      lastModifiedStore.delete(key);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupStaleEntries, 60 * 60 * 1000);

