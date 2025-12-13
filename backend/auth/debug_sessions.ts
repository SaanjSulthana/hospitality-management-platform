/**
 * Debug Endpoint for Session Inspection
 * 
 * TEMPORARY: This file provides debugging tools to diagnose refresh token issues.
 * Remove or disable in production after debugging is complete.
 * 
 * Covers:
 * - Todo 1: Manual refresh token validation
 * - Todo 2: Session table inspection
 * - Todo 3: Hash comparison helper
 */

import { api, APIError } from "encore.dev/api";
import { authDB } from "./db";
import { verifyRefreshToken, verifyRefreshTokenHash } from "./utils";
import log from "encore.dev/log";

// ============================================================================
// Debug Request/Response Types
// ============================================================================

export interface DebugSessionsRequest {
  userId: number;
}

export interface SessionInfo {
  id: number;
  userId: number;
  expiresAt: string;
  createdAt: string;
  isExpired: boolean;
}

export interface DebugSessionsResponse {
  userId: number;
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  sessions: SessionInfo[];
  serverTime: string;
}

export interface DebugRefreshHashRequest {
  userId: number;
  refreshToken: string;
}

export interface HashComparisonResult {
  sessionId: number;
  expiresAt: string;
  isExpired: boolean;
  hashMatches: boolean;
}

export interface DebugRefreshHashResponse {
  userId: number;
  tokenValid: boolean;
  tokenPayload: {
    sub: string;
    type: string;
    exp: number;
    iat: number;
  } | null;
  tokenError: string | null;
  sessionsChecked: number;
  matchingSessionId: number | null;
  hashComparisons: HashComparisonResult[];
  serverTime: string;
  diagnosis: string;
}

// ============================================================================
// Debug Endpoints
// ============================================================================

/**
 * List all sessions for a user
 * GET /v1/auth/debug/sessions?userId=<id>
 */
export const debugListSessions = api<DebugSessionsRequest, DebugSessionsResponse>(
  { expose: true, method: "GET", path: "/v1/auth/debug/sessions" },
  async (req) => {
    const { userId } = req;
    
    log.info("[DEBUG] Listing sessions for user", { userId });

    const now = new Date();
    
    // Get all sessions for this user (including expired ones for debugging)
    const sessions = await authDB.queryAll<{
      id: number;
      user_id: number;
      refresh_token_hash: string;
      expires_at: Date;
      created_at: Date;
    }>`
      SELECT id, user_id, refresh_token_hash, expires_at, created_at
      FROM sessions
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 20
    `;

    const sessionInfos: SessionInfo[] = sessions.map(s => ({
      id: Number(s.id),
      userId: Number(s.user_id),
      expiresAt: s.expires_at.toISOString(),
      createdAt: s.created_at.toISOString(),
      isExpired: s.expires_at <= now,
    }));

    const activeSessions = sessionInfos.filter(s => !s.isExpired).length;
    const expiredSessions = sessionInfos.filter(s => s.isExpired).length;

    log.info("[DEBUG] Sessions found", { 
      userId, 
      totalSessions: sessions.length,
      activeSessions,
      expiredSessions 
    });

    return {
      userId,
      totalSessions: sessions.length,
      activeSessions,
      expiredSessions,
      sessions: sessionInfos,
      serverTime: now.toISOString(),
    };
  }
);

/**
 * Test refresh token hash comparison against stored sessions
 * POST /v1/auth/debug/verify-hash
 */
export const debugVerifyRefreshHash = api<DebugRefreshHashRequest, DebugRefreshHashResponse>(
  { expose: true, method: "POST", path: "/v1/auth/debug/verify-hash" },
  async (req) => {
    const { userId, refreshToken } = req;
    const now = new Date();

    log.info("[DEBUG] Verifying refresh token hash", { userId, tokenLength: refreshToken.length });

    // Step 1: Verify the JWT itself
    let tokenPayload: any = null;
    let tokenError: string | null = null;
    let tokenValid = false;

    try {
      tokenPayload = verifyRefreshToken(refreshToken);
      tokenValid = true;
      log.info("[DEBUG] JWT verification successful", { 
        sub: tokenPayload.sub, 
        exp: tokenPayload.exp,
        expDate: new Date(tokenPayload.exp * 1000).toISOString()
      });
    } catch (error) {
      tokenError = error instanceof Error ? error.message : String(error);
      log.warn("[DEBUG] JWT verification failed", { error: tokenError });
    }

    // Step 2: Get all sessions for this user
    const sessions = await authDB.queryAll<{
      id: number;
      refresh_token_hash: string;
      expires_at: Date;
      created_at: Date;
    }>`
      SELECT id, refresh_token_hash, expires_at, created_at
      FROM sessions
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 20
    `;

    log.info("[DEBUG] Found sessions to check", { count: sessions.length });

    // Step 3: Compare hash against each session
    const hashComparisons: HashComparisonResult[] = [];
    let matchingSessionId: number | null = null;

    for (const session of sessions) {
      const isExpired = session.expires_at <= now;
      let hashMatches = false;

      try {
        hashMatches = await verifyRefreshTokenHash(refreshToken, session.refresh_token_hash);
        if (hashMatches) {
          matchingSessionId = Number(session.id);
          log.info("[DEBUG] Found matching session!", { 
            sessionId: session.id, 
            isExpired,
            expiresAt: session.expires_at.toISOString()
          });
        }
      } catch (error) {
        log.warn("[DEBUG] Hash comparison error", { 
          sessionId: session.id, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }

      hashComparisons.push({
        sessionId: Number(session.id),
        expiresAt: session.expires_at.toISOString(),
        isExpired,
        hashMatches,
      });
    }

    // Step 4: Generate diagnosis
    let diagnosis: string;
    if (!tokenValid) {
      diagnosis = "FAIL: Refresh token JWT is invalid or expired. Check token format and expiry.";
    } else if (sessions.length === 0) {
      diagnosis = "FAIL: No sessions found for this user. Session was not created on login or was deleted.";
    } else if (matchingSessionId === null) {
      diagnosis = "FAIL: Token JWT is valid but no session hash matches. Possible causes: token corruption, multiple logins invalidating session, or hash algorithm mismatch.";
    } else {
      const matchedSession = hashComparisons.find(h => h.sessionId === matchingSessionId);
      if (matchedSession?.isExpired) {
        diagnosis = `WARN: Found matching session (ID: ${matchingSessionId}) but it is EXPIRED. Session cleanup may be needed.`;
      } else {
        diagnosis = `OK: Found valid matching session (ID: ${matchingSessionId}). Refresh should work. If still failing, check for race conditions or DB connection issues.`;
      }
    }

    log.info("[DEBUG] Diagnosis complete", { diagnosis, matchingSessionId });

    return {
      userId,
      tokenValid,
      tokenPayload: tokenPayload ? {
        sub: tokenPayload.sub,
        type: tokenPayload.type,
        exp: tokenPayload.exp,
        iat: tokenPayload.iat,
      } : null,
      tokenError,
      sessionsChecked: sessions.length,
      matchingSessionId,
      hashComparisons,
      serverTime: now.toISOString(),
      diagnosis,
    };
  }
);

/**
 * Quick health check for auth debug endpoints
 * GET /v1/auth/debug/health
 */
export const debugHealth = api<{}, { status: string; serverTime: string; dbConnected: boolean }>(
  { expose: true, method: "GET", path: "/v1/auth/debug/health" },
  async () => {
    let dbConnected = false;
    try {
      await authDB.queryRow`SELECT 1 as check`;
      dbConnected = true;
    } catch (error) {
      log.error("[DEBUG] DB connection check failed", { error });
    }

    return {
      status: "debug endpoints active",
      serverTime: new Date().toISOString(),
      dbConnected,
    };
  }
);

/**
 * Comprehensive consistency check for auth system
 * GET /v1/auth/debug/consistency
 * 
 * This endpoint verifies:
 * - Database connection and configuration
 * - Bcrypt hash generation and verification
 * - Server time consistency
 * - Session table structure
 */
export const debugConsistencyCheck = api<{}, {
  status: string;
  serverTime: string;
  checks: {
    dbConnection: { ok: boolean; error?: string };
    bcryptHashVerify: { ok: boolean; testHash?: string; verifyResult?: boolean; error?: string };
    sessionTableExists: { ok: boolean; rowCount?: number; error?: string };
    timeConsistency: { ok: boolean; serverTime: string; dbTime?: string; diffMs?: number; error?: string };
  };
  config: {
    accessTokenExpiryMinutes: number;
    refreshTokenExpiryDays: number;
    bcryptSaltRoundsRefreshToken: number;
  };
  recommendations: string[];
}>(
  { expose: true, method: "GET", path: "/v1/auth/debug/consistency" },
  async () => {
    const now = new Date();
    const recommendations: string[] = [];
    
    // Check 1: DB Connection
    let dbConnectionOk = false;
    let dbConnectionError: string | undefined;
    try {
      await authDB.queryRow`SELECT 1 as check`;
      dbConnectionOk = true;
    } catch (error) {
      dbConnectionError = error instanceof Error ? error.message : String(error);
      recommendations.push("CRITICAL: Database connection failed. Check authDB configuration.");
    }

    // Check 2: Bcrypt hash/verify consistency
    let bcryptOk = false;
    let testHash: string | undefined;
    let verifyResult: boolean | undefined;
    let bcryptError: string | undefined;
    try {
      const testToken = "test-refresh-token-" + Date.now();
      const { hashRefreshToken, verifyRefreshTokenHash } = await import("./utils");
      testHash = await hashRefreshToken(testToken);
      verifyResult = await verifyRefreshTokenHash(testToken, testHash);
      bcryptOk = verifyResult === true;
      
      if (!bcryptOk) {
        recommendations.push("CRITICAL: Bcrypt hash/verify mismatch. Check bcrypt library version.");
      }
    } catch (error) {
      bcryptError = error instanceof Error ? error.message : String(error);
      recommendations.push("CRITICAL: Bcrypt test failed. Check utils.ts imports and bcrypt installation.");
    }

    // Check 3: Sessions table exists and has data
    let sessionTableOk = false;
    let sessionRowCount: number | undefined;
    let sessionTableError: string | undefined;
    try {
      const result = await authDB.queryRow<{ count: number }>`SELECT COUNT(*)::int as count FROM sessions`;
      sessionRowCount = result?.count ?? 0;
      sessionTableOk = true;
      
      if (sessionRowCount === 0) {
        recommendations.push("INFO: No sessions in database. Normal if no users have logged in yet.");
      }
    } catch (error) {
      sessionTableError = error instanceof Error ? error.message : String(error);
      recommendations.push("CRITICAL: Sessions table query failed. Check migrations have run.");
    }

    // Check 4: Time consistency between server and DB
    let timeOk = false;
    let dbTime: string | undefined;
    let timeDiffMs: number | undefined;
    let timeError: string | undefined;
    try {
      const dbResult = await authDB.queryRow<{ now: Date }>`SELECT NOW() as now`;
      if (dbResult?.now) {
        dbTime = dbResult.now.toISOString();
        timeDiffMs = Math.abs(now.getTime() - dbResult.now.getTime());
        timeOk = timeDiffMs < 5000; // Less than 5 seconds diff
        
        if (!timeOk) {
          recommendations.push(`WARNING: Server/DB time difference is ${timeDiffMs}ms. This can cause session expiry issues.`);
        }
      }
    } catch (error) {
      timeError = error instanceof Error ? error.message : String(error);
      recommendations.push("WARNING: Could not check DB time consistency.");
    }

    // Summary
    const allOk = dbConnectionOk && bcryptOk && sessionTableOk && timeOk;
    
    if (allOk && recommendations.length === 0) {
      recommendations.push("All consistency checks passed. If refresh still fails, check:");
      recommendations.push("1. Browser localStorage for token corruption");
      recommendations.push("2. Multiple login sessions overwriting each other");
      recommendations.push("3. Race conditions between login and first refresh");
    }

    log.info("[DEBUG] Consistency check completed", { 
      allOk, 
      dbConnectionOk, 
      bcryptOk, 
      sessionTableOk, 
      timeOk 
    });

    return {
      status: allOk ? "all_checks_passed" : "some_checks_failed",
      serverTime: now.toISOString(),
      checks: {
        dbConnection: { ok: dbConnectionOk, error: dbConnectionError },
        bcryptHashVerify: { ok: bcryptOk, testHash, verifyResult, error: bcryptError },
        sessionTableExists: { ok: sessionTableOk, rowCount: sessionRowCount, error: sessionTableError },
        timeConsistency: { ok: timeOk, serverTime: now.toISOString(), dbTime, diffMs: timeDiffMs, error: timeError },
      },
      config: {
        accessTokenExpiryMinutes: 15,
        refreshTokenExpiryDays: 7,
        bcryptSaltRoundsRefreshToken: 10,
      },
      recommendations,
    };
  }
);

