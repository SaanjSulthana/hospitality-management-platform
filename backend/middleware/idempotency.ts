/**
 * Idempotency-Key Enforcement
 * 
 * Implements idempotent request handling for critical write operations:
 * - Expense creation
 * - Revenue recording
 * - Guest check-in
 * - Staff check-in/out
 * - Document upload start
 * 
 * Behavior:
 * - If same key reused with SAME payload → replay original response
 * - If same key reused with DIFFERENT payload → 409 Conflict
 * - Keys stored with 24h TTL
 * 
 * @see docs/NETWORKING_AND_REALTIME_IMPROVEMENTS.md Idempotency-Key section
 */

import { createHash } from 'crypto';

/**
 * Stored idempotency record
 */
interface IdempotencyRecord {
  /** Original request payload hash */
  payloadHash: string;
  
  /** Original response status */
  status: number;
  
  /** Original response body (serialized) */
  responseBody: string;
  
  /** Entity ID created (if applicable) */
  entityId?: string | number;
  
  /** Timestamp of original request */
  createdAt: number;
  
  /** TTL expiry timestamp */
  expiresAt: number;
  
  /** Request path for logging */
  path: string;
  
  /** User who made the request */
  userId: number;
  
  /** Organization ID */
  orgId: number;
}

/**
 * Result of idempotency check
 */
export interface IdempotencyCheckResult {
  /** Whether this is a new request (not seen before) */
  isNew: boolean;
  
  /** Whether this is a valid replay (same payload) */
  isReplay: boolean;
  
  /** Whether this is a conflict (same key, different payload) */
  isConflict: boolean;
  
  /** Original response (if replay) */
  originalResponse?: {
    status: number;
    body: unknown;
    entityId?: string | number;
  };
  
  /** Error details (if conflict) */
  conflictError?: {
    code: string;
    message: string;
    originalPath: string;
    originalCreatedAt: Date;
  };
}

/**
 * In-memory storage for idempotency records
 * 
 * In production, this should be Redis with TTL:
 * ```
 * SET idempotency:{orgId}:{key} {record} EX 86400
 * ```
 */
const idempotencyStore = new Map<string, IdempotencyRecord>();

/**
 * Default TTL: 24 hours
 */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Cleanup interval: 1 hour
 */
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Ensure cleanup timer is running
 */
function ensureCleanupTimer(): void {
  if (cleanupTimer) return;
  
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    
    for (const [key, record] of idempotencyStore.entries()) {
      if (record.expiresAt < now) {
        idempotencyStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
}

/**
 * Generate a hash of the request payload
 */
function hashPayload(payload: unknown): string {
  const serialized = typeof payload === 'string' 
    ? payload 
    : JSON.stringify(payload, Object.keys(payload as object).sort());
  
  return createHash('sha256').update(serialized).digest('hex').slice(0, 32);
}

/**
 * Build storage key
 */
function buildKey(orgId: number, idempotencyKey: string): string {
  return `idempotency:${orgId}:${idempotencyKey}`;
}

/**
 * Check if an idempotency key exists and validate payload
 */
export function checkIdempotencyKey(
  orgId: number,
  idempotencyKey: string,
  payload: unknown
): IdempotencyCheckResult {
  const key = buildKey(orgId, idempotencyKey);
  const record = idempotencyStore.get(key);
  const payloadHash = hashPayload(payload);
  
  // New request
  if (!record) {
    return {
      isNew: true,
      isReplay: false,
      isConflict: false,
    };
  }
  
  // Check if expired
  if (record.expiresAt < Date.now()) {
    idempotencyStore.delete(key);
    return {
      isNew: true,
      isReplay: false,
      isConflict: false,
    };
  }
  
  // Same payload - valid replay
  if (record.payloadHash === payloadHash) {
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(record.responseBody);
    } catch {
      parsedBody = record.responseBody;
    }
    
    return {
      isNew: false,
      isReplay: true,
      isConflict: false,
      originalResponse: {
        status: record.status,
        body: parsedBody,
        entityId: record.entityId,
      },
    };
  }
  
  // Different payload - conflict
  return {
    isNew: false,
    isReplay: false,
    isConflict: true,
    conflictError: {
      code: 'idempotency_conflict',
      message: `Idempotency key '${idempotencyKey}' was already used with a different payload. ` +
        `Keys can only be reused with identical request bodies within 24 hours.`,
      originalPath: record.path,
      originalCreatedAt: new Date(record.createdAt),
    },
  };
}

/**
 * Store an idempotency record after successful request
 */
export function storeIdempotencyRecord(
  orgId: number,
  idempotencyKey: string,
  payload: unknown,
  response: {
    status: number;
    body: unknown;
    entityId?: string | number;
  },
  path: string,
  userId: number,
  ttlMs: number = DEFAULT_TTL_MS
): void {
  const key = buildKey(orgId, idempotencyKey);
  const now = Date.now();
  
  const record: IdempotencyRecord = {
    payloadHash: hashPayload(payload),
    status: response.status,
    responseBody: JSON.stringify(response.body),
    entityId: response.entityId,
    createdAt: now,
    expiresAt: now + ttlMs,
    path,
    userId,
    orgId,
  };
  
  idempotencyStore.set(key, record);
  ensureCleanupTimer();
}

/**
 * Delete an idempotency record (for admin/testing)
 */
export function deleteIdempotencyRecord(
  orgId: number,
  idempotencyKey: string
): boolean {
  const key = buildKey(orgId, idempotencyKey);
  return idempotencyStore.delete(key);
}

/**
 * Create a 409 Conflict response for idempotency conflicts
 */
export function createConflictResponse(result: IdempotencyCheckResult): {
  status: 409;
  body: {
    code: string;
    message: string;
    details: {
      originalPath: string;
      originalCreatedAt: string;
    };
  };
} {
  return {
    status: 409,
    body: {
      code: result.conflictError?.code ?? 'idempotency_conflict',
      message: result.conflictError?.message ?? 'Idempotency key conflict',
      details: {
        originalPath: result.conflictError?.originalPath ?? 'unknown',
        originalCreatedAt: result.conflictError?.originalCreatedAt?.toISOString() ?? 
          new Date().toISOString(),
      },
    },
  };
}

/**
 * Generate response headers for idempotent requests
 */
export function getIdempotencyHeaders(
  idempotencyKey: string,
  isReplay: boolean
): Record<string, string> {
  const headers: Record<string, string> = {
    'Idempotency-Key': idempotencyKey,
  };
  
  if (isReplay) {
    headers['Idempotent-Replayed'] = 'true';
  }
  
  return headers;
}

/**
 * Validate idempotency key format
 */
export function validateIdempotencyKey(key: string): {
  valid: boolean;
  error?: string;
} {
  if (!key || typeof key !== 'string') {
    return {
      valid: false,
      error: 'Idempotency-Key header is required for this endpoint',
    };
  }
  
  if (key.length < 8) {
    return {
      valid: false,
      error: 'Idempotency-Key must be at least 8 characters',
    };
  }
  
  if (key.length > 256) {
    return {
      valid: false,
      error: 'Idempotency-Key must not exceed 256 characters',
    };
  }
  
  // Allow UUIDs, client-generated keys, etc.
  if (!/^[a-zA-Z0-9_\-.:]+$/.test(key)) {
    return {
      valid: false,
      error: 'Idempotency-Key contains invalid characters. Use alphanumeric, underscore, hyphen, period, or colon.',
    };
  }
  
  return { valid: true };
}

/**
 * Extract idempotency key from request headers
 */
export function extractIdempotencyKey(
  headers: Record<string, string | string[] | undefined>
): string | null {
  const key = headers['idempotency-key'] || headers['Idempotency-Key'];
  
  if (Array.isArray(key)) {
    return key[0] || null;
  }
  
  return key || null;
}

/**
 * Endpoints that require idempotency keys
 */
export const IDEMPOTENT_ENDPOINTS = [
  // Finance
  '/finance/expenses',
  '/finance/revenues',
  '/v1/finance/expenses',
  '/v1/finance/revenues',
  
  // Guest check-in
  '/guest-checkin/create',
  '/guest-checkin/create-with-documents',
  '/v1/guest-checkin/create',
  '/v1/guest-checkin/create-with-documents',
  
  // Staff
  '/staff/check-in',
  '/staff/check-out',
  '/v1/staff/check-in',
  '/v1/staff/check-out',
  
  // Document uploads
  '/guest-checkin/documents/upload',
  '/v1/guest-checkin/documents/upload',
  '/uploads/file',
  '/v1/uploads/file',
] as const;

/**
 * Check if an endpoint requires idempotency key
 */
export function requiresIdempotencyKey(
  path: string,
  method: string
): boolean {
  // Only POST, PUT, PATCH require idempotency
  if (!['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    return false;
  }
  
  const normalizedPath = path.toLowerCase().replace(/\/$/, '');
  
  return IDEMPOTENT_ENDPOINTS.some(endpoint => 
    normalizedPath === endpoint.toLowerCase() ||
    normalizedPath.endsWith(endpoint.toLowerCase())
  );
}

/**
 * Middleware helper for idempotent request handling
 * 
 * Usage:
 * ```typescript
 * const idempotency = handleIdempotency(
 *   req.headers['idempotency-key'],
 *   auth.orgId,
 *   req.body,
 *   '/finance/expenses',
 *   auth.userId
 * );
 * 
 * if (idempotency.shouldReturn) {
 *   return idempotency.response;
 * }
 * 
 * // Process request...
 * 
 * // After success:
 * idempotency.recordSuccess(response);
 * ```
 */
export function handleIdempotency(
  idempotencyKey: string | null | undefined,
  orgId: number,
  payload: unknown,
  path: string,
  userId: number
): {
  shouldReturn: boolean;
  response?: {
    status: number;
    body: unknown;
    headers: Record<string, string>;
  };
  recordSuccess: (response: { status: number; body: unknown; entityId?: string | number }) => void;
} {
  // No idempotency key provided
  if (!idempotencyKey) {
    return {
      shouldReturn: false,
      recordSuccess: () => {}, // No-op
    };
  }
  
  // Validate key format
  const validation = validateIdempotencyKey(idempotencyKey);
  if (!validation.valid) {
    return {
      shouldReturn: true,
      response: {
        status: 400,
        body: {
          code: 'invalid_idempotency_key',
          message: validation.error,
        },
        headers: {},
      },
      recordSuccess: () => {},
    };
  }
  
  // Check existing record
  const result = checkIdempotencyKey(orgId, idempotencyKey, payload);
  
  // Conflict - different payload with same key
  if (result.isConflict) {
    const conflictResponse = createConflictResponse(result);
    return {
      shouldReturn: true,
      response: {
        status: conflictResponse.status,
        body: conflictResponse.body,
        headers: getIdempotencyHeaders(idempotencyKey, false),
      },
      recordSuccess: () => {},
    };
  }
  
  // Replay - same payload, return original response
  if (result.isReplay && result.originalResponse) {
    return {
      shouldReturn: true,
      response: {
        status: result.originalResponse.status,
        body: result.originalResponse.body,
        headers: getIdempotencyHeaders(idempotencyKey, true),
      },
      recordSuccess: () => {},
    };
  }
  
  // New request - proceed and record on success
  return {
    shouldReturn: false,
    recordSuccess: (response) => {
      storeIdempotencyRecord(
        orgId,
        idempotencyKey,
        payload,
        response,
        path,
        userId
      );
    },
  };
}

/**
 * Get idempotency statistics (for monitoring)
 */
export function getIdempotencyStats(): {
  totalRecords: number;
  recordsByOrg: Record<number, number>;
  avgAgeMs: number;
  oldestRecordMs: number;
} {
  const now = Date.now();
  const orgCounts: Record<number, number> = {};
  let totalAge = 0;
  let oldestAge = 0;
  
  for (const record of idempotencyStore.values()) {
    orgCounts[record.orgId] = (orgCounts[record.orgId] || 0) + 1;
    
    const age = now - record.createdAt;
    totalAge += age;
    if (age > oldestAge) {
      oldestAge = age;
    }
  }
  
  return {
    totalRecords: idempotencyStore.size,
    recordsByOrg: orgCounts,
    avgAgeMs: idempotencyStore.size > 0 ? Math.round(totalAge / idempotencyStore.size) : 0,
    oldestRecordMs: oldestAge,
  };
}

/**
 * Clear all idempotency records (for testing)
 */
export function clearAllIdempotencyRecords(): void {
  idempotencyStore.clear();
}

// Export types
export type { IdempotencyRecord };

