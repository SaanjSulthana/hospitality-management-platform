/**
 * Redis-Backed Idempotency-Key Enforcement
 * 
 * Production-ready idempotent request handling using Redis for distributed storage.
 * Supports 10M+ organizations with 24h TTL and automatic expiration.
 * 
 * Redis Connection: Free tier Redis Cloud
 * - Host: redis-11780.c57.us-east-1-4.ec2.cloud.redislabs.com
 * - Port: 11780
 * - Password: Stored in environment variable REDIS_PASSWORD
 * 
 * @see docs/NETWORKING_AND_REALTIME_IMPROVEMENTS.md Idempotency-Key section
 */

import { createHash } from 'crypto';
import { createClient, RedisClientType } from 'redis';
import { secret } from 'encore.dev/config';

// Redis password from Encore secrets
const RedisPassword = secret("RedisPassword");

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
 * Default TTL: 24 hours (in seconds for Redis)
 */
const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

/**
 * Redis client singleton
 */
let redisClient: RedisClientType | null = null;
let isConnecting = false;
let connectionError: Error | null = null;

/**
 * Initialize Redis client
 */
async function getRedisClient(): Promise<RedisClientType> {
    if (redisClient && redisClient.isOpen) {
        return redisClient;
    }

    if (isConnecting) {
        // Wait for connection to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        return getRedisClient();
    }

    if (connectionError) {
        throw connectionError;
    }

    isConnecting = true;

    try {
        // Prefer local environment variables when provided for development
        // Supported envs:
        // - REDIS_URL (e.g., redis://localhost:6379 or rediss://user:pass@host:port)
        // - REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_USE_TLS
        const envUrl = process.env.REDIS_URL;
        const envHost = process.env.REDIS_HOST;
        const envPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined;
        const envPassword = process.env.REDIS_PASSWORD;
        const envUseTLS = process.env.REDIS_USE_TLS === 'true';

        if (envUrl) {
            // URL takes precedence when supplied
            redisClient = createClient({ url: envUrl });
        } else if (envHost) {
            redisClient = createClient({
                socket: {
                    host: envHost,
                    port: envPort ?? 6379,
                    tls: envUseTLS ? {} as any : undefined,
                },
                password: envPassword,
            });
        } else {
            // Cloud default (Redis Cloud). Requires Encore secret RedisPassword.
            const password = RedisPassword();
            redisClient = createClient({
                socket: {
                    host: 'redis-11780.c57.us-east-1-4.ec2.cloud.redislabs.com',
                    port: 11780,
                },
                password,
                username: 'default',
            });
        }

        redisClient.on('error', (err: Error) => {
            console.error('[IdempotencyRedis][connection-error]', err);
            connectionError = err;
        });

        redisClient.on('connect', () => {
            console.log('[IdempotencyRedis][connected]');
            connectionError = null;
        });

        await redisClient.connect();
        isConnecting = false;

        return redisClient;
    } catch (err) {
        isConnecting = false;
        connectionError = err as Error;
        console.error('[IdempotencyRedis][init-error]', err);
        throw err;
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
 * Build Redis key
 */
function buildKey(orgId: number, idempotencyKey: string): string {
    return `idempotency:${orgId}:${idempotencyKey}`;
}

/**
 * Check if an idempotency key exists and validate payload
 */
export async function checkIdempotencyKey(
    orgId: number,
    idempotencyKey: string,
    payload: unknown
): Promise<IdempotencyCheckResult> {
    try {
        const client = await getRedisClient();
        const key = buildKey(orgId, idempotencyKey);
        const recordJson = await client.get(key);
        const payloadHash = hashPayload(payload);

        // New request
        if (!recordJson) {
            return {
                isNew: true,
                isReplay: false,
                isConflict: false,
            };
        }

        const record: IdempotencyRecord = JSON.parse(recordJson);

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
    } catch (err) {
        console.error('[IdempotencyRedis][check-error]', err);
        // On Redis error, allow request to proceed (fail open)
        return {
            isNew: true,
            isReplay: false,
            isConflict: false,
        };
    }
}

/**
 * Store an idempotency record after successful request
 */
export async function storeIdempotencyRecord(
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
    ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> {
    try {
        const client = await getRedisClient();
        const key = buildKey(orgId, idempotencyKey);

        const record: IdempotencyRecord = {
            payloadHash: hashPayload(payload),
            status: response.status,
            responseBody: JSON.stringify(response.body),
            entityId: response.entityId,
            createdAt: Date.now(),
            path,
            userId,
            orgId,
        };

        // Store with TTL (Redis will auto-expire)
        await client.setEx(key, ttlSeconds, JSON.stringify(record));
    } catch (err) {
        console.error('[IdempotencyRedis][store-error]', err);
        // Don't throw - idempotency is best-effort
    }
}

/**
 * Delete an idempotency record (for admin/testing)
 */
export async function deleteIdempotencyRecord(
    orgId: number,
    idempotencyKey: string
): Promise<boolean> {
    try {
        const client = await getRedisClient();
        const key = buildKey(orgId, idempotencyKey);
        const result = await client.del(key);
        return result > 0;
    } catch (err) {
        console.error('[IdempotencyRedis][delete-error]', err);
        return false;
    }
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
 * const idempotency = await handleIdempotency(
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
 * await idempotency.recordSuccess(response);
 * ```
 */
export async function handleIdempotency(
    idempotencyKey: string | null | undefined,
    orgId: number,
    payload: unknown,
    path: string,
    userId: number
): Promise<{
    shouldReturn: boolean;
    response?: {
        status: number;
        body: unknown;
        headers: Record<string, string>;
    };
    recordSuccess: (response: { status: number; body: unknown; entityId?: string | number }) => Promise<void>;
}> {
    // No idempotency key provided
    if (!idempotencyKey) {
        return {
            shouldReturn: false,
            recordSuccess: async () => { }, // No-op
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
            recordSuccess: async () => { },
        };
    }

    // Check existing record
    const result = await checkIdempotencyKey(orgId, idempotencyKey, payload);

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
            recordSuccess: async () => { },
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
            recordSuccess: async () => { },
        };
    }

    // New request - proceed and record on success
    return {
        shouldReturn: false,
        recordSuccess: async (response) => {
            await storeIdempotencyRecord(
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
export async function getIdempotencyStats(): Promise<{
    redisConnected: boolean;
    error?: string;
}> {
    try {
        const client = await getRedisClient();
        const isConnected = client.isOpen;

        return {
            redisConnected: isConnected,
        };
    } catch (err) {
        return {
            redisConnected: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

/**
 * Clear all idempotency records for an org (for testing)
 */
export async function clearOrgIdempotencyRecords(orgId: number): Promise<number> {
    try {
        const client = await getRedisClient();
        const pattern = `idempotency:${orgId}:*`;

        // Scan for keys matching pattern
        const keys: string[] = [];
        for await (const entry of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
            // Some typings may surface batched keys; normalize to strings
            if (Array.isArray(entry)) {
                for (const k of entry) keys.push(String(k));
            } else {
                keys.push(String(entry));
            }
        }

        if (keys.length === 0) {
            return 0;
        }

        // Delete all matching keys (avoid TS vararg typing issues)
        await Promise.all(keys.map((k) => client.del(k)));
        return keys.length;
    } catch (err) {
        console.error('[IdempotencyRedis][clear-error]', err);
        return 0;
    }
}

/**
 * Graceful shutdown
 */
export async function closeRedisConnection(): Promise<void> {
    if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
        redisClient = null;
    }
}

// Export types
export type { IdempotencyRecord };
