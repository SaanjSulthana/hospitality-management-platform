# Networking & Realtime (Pub/Sub) – Production Playbook for 1M‑Org Scale

This document summarizes the end‑to‑end networking and realtime (Pub/Sub) improvements we implemented across the Finance service (backend + frontend), and the patterns we will reuse for other pages/services as we scale to 1M organizations (5 properties × 5 users).

> Use this as a reference when building new features or extending realtime to other domains (Tasks, Staff, Properties, Analytics, etc.).

---

## 1) Realtime Architecture (Encore + In‑Memory Buffer)

- Introduced a robust long‑poll based Pub/Sub pipeline:
  - Backend endpoint: `GET /finance/realtime/subscribe` (Encore API).
  - In‑memory per‑org buffer (`backend/finance/realtime_buffer.ts`) with:
    - Bounded queue (`MAX_BUFFER_SIZE`, default 200 events).
    - Time‑to‑live per event (`EVENT_TTL_MS`, default 25s).
    - Long‑poll timeout (`LONG_POLL_TIMEOUT_MS`, default 25s).
    - Waiter cap per org (`MAX_WAITERS_PER_ORG`, default 5000) with safe fallback.
    - Idle eviction window (`ORG_IDLE_EVICT_MS`, default 2 min).
  - `finance_realtime_subscriber.ts` pushes published events into the buffer, and the subscribe endpoint drains or waits.

- Server‑side observability:
  - `getRealtimeBufferMetrics()` exposes buffer sizes, published/delivered counts, and drop totals.
  - Endpoint `GET /finance/realtime/metrics` (auth) returns the above metrics for dashboards/alerts.
  - `subscribe_realtime.ts` now logs context‑only completion/failure events (`[RealtimeSubscribe][completed|failure]`) with orgId, userId, propertyId, origin, ua (truncated), and durationMs for incident triage.

- Correctness improvements:
  - Events are delivered “at least once”; client includes de‑dup on `eventId`.
  - Property filtering is enforced when reading from the buffer.
  - Idle eviction and TTL prevent unbounded growth.

**Why this matters:** At 1M orgs, holding one 25‑second long‑poll per session is predictable and cheap, while ensuring near‑instant updates when events exist. Bounded buffers and strict timeouts prevent memory blow‑ups and slow leaks.

---

## 2) Frontend Realtime Client – Leader/Follower + Stability

- Hook: `frontend/hooks/useFinanceRealtimeV2.ts` (used by `FinancePage.tsx`)
  - Leader/Follower pattern via `BroadcastChannel` and a localStorage/WebLocks lease:
    - Exactly one “leader” tab per login session maintains the long‑poll.
    - Followers do not call the backend; they listen to the leader’s `finance-events` channel.
  - RTT‑aware backoff:
    - If a subscribe returns empty in `< 1.5s` (fast‑empty), the next subscribe is delayed by 2–5s to avoid tight loops.
  - Hidden/follower pacing:
    - When the tab is hidden or acting as a follower, resubscribe cadence slows to 3–5s for low background noise.
  - Effect stability:
    - Removed `isLeader` from the effect dependency to avoid unnecessary teardown/restart and cancel storms.
  - 2% client telemetry (to `/telemetry/client`) for:
    - `fast_empty` events (with `elapsedMs`, `backoffMs`, `isLeader`).
    - `leader_acquired` / `leader_takeover` events.

**Why this matters:** In large fleets with many browser tabs per org/user, the Leader/Follower approach prevents N× duplication of long‑polls. The RTT‑aware backoff and hidden/follower pacing keep request rates stable under quiet conditions while preserving instant updates on events.

---

## 3) Centralized Token Refresh – Mutex + Cross‑Tab Sharing

- Auth hardening in `frontend/contexts/AuthContext.tsx`:
  - **Refresh mutex:** Use Web Locks API if available (`navigator.locks`), otherwise a localStorage lease with a short TTL; ensures only one tab performs token refresh when multiple 401s occur simultaneously.
  - **Cross‑tab coordination:** `BroadcastChannel('auth-refresh')` announces `refresh-started`, `refresh-success {token}`, `refresh-failed`, so other tabs pause and resume with the new token without duplicate refresh requests.
  - **Exponential backoff + UX banner:** On repeated 401/403 after refresh attempts, back off (2s→4s→8s→… up to 60s) and show a centralized banner prompting re‑login. Avoids sudden redirects and preserves page state.
  - **Global banner:** Global auth banner in `Layout.tsx` provides a consistent, visible prompt (“Session expired. Log in / Reload”) instead of scattered toasts.
  - NEW – **Logout broadcast:** `BroadcastChannel('auth-control')` + localStorage fallback announce `logout` so other tabs stop immediately (no tail 401s).
  - NEW – **Authorization guard:** Clients omit `Authorization` when no token is present; prevents “jwt malformed” noise and preflight churn at teardown.

**Why this matters:** At scale and across multiple tabs/devices, auth expiry often causes brief bursts of 401s and redundant refresh attempts. The mutex and cross‑tab sharing eliminate herd effects and reduce unnecessary traffic, while the banner provides a clear user recovery path.

---

## 4) Networking Hygiene – CORS & Dev Proxy

- **CORS max‑age:** `backend/encore.app` now sets `"max_age_seconds": 7200` under `global_cors` to cache preflight (OPTIONS) responses for 2 hours in browsers. This substantially reduces preflight chatter for Authorization‑bearing requests.
- **Dev proxy:** `frontend/vite.config.ts` proxies only `/finance/realtime/*` to `http://localhost:4000` to preserve SPA routing while removing cross‑origin preflights during development. (We intentionally avoid a blanket `/api` proxy to prevent `/finance` page navigations from being proxied to the backend.)

**Why this matters:** Preflight storms amplify backend load and obscure true request timings. Caching CORS decisions in prod and using a dev proxy for realtime reduce noise and latency.

---

## 5) Finance Page (Frontend) – Instant UI with Debounced Aggregates

- `frontend/pages/FinancePage.tsx` changes:
  - **Row‑level patching:** Event‑driven updates merge actual events into local React Query cache; optimistic entries are replaced or de‑duplicated by `eventId`.
  - **Debounced derived invalidations:** Profit‑loss, today‑pending, and daily‑approval are invalidated at most once per second during bursts.
  - **Dynamic freshness:** `profit-loss` uses `staleTime = 25s` when realtime is live, `10s` when offline; `refetchOnWindowFocus: true` for resiliency.
  - **Degraded mode:** When realtime is offline beyond `HARD_TIMEOUT_MS`, trigger safe refetch of lists + aggregates.
  - **Removed legacy polling:** `useFinanceEvents` (1s polling) retired from `daily-approval-manager`. Realtime updates flow via `useFinanceRealtimeV2` only.

**Why this matters:** Lists update instantly from events; heavier aggregates (profit/loss) update on a reasonable cadence, cutting load while maintaining a responsive UI.

---

## 6) Session Lifecycle – Cross‑Tab Logout, Offline/Expired UX, and Realtime Stop

- NEW – **Cross‑tab logout broadcast**
  - Sender posts `{ t: 'logout', id: uuid, ts }` via `auth-control` channel; also sets `localStorage['auth-logout']` as a fallback for older browsers.
  - Receivers idempotently clear tokens, cancel timers/long‑polls, clear query cache, and navigate to `/login` or hold the banner.
- NEW – **Stop realtime on logout**
  - `useFinanceRealtimeV2` listens to `auth-control` and immediately aborts the in‑flight subscribe and suppresses resubscribe until sign‑in.
- NEW – **Rich global banner**
  - Expired mode: red banner with [Log in] and [Reload]; writes paused; cached reads stay visible to preserve unsaved work.
  - Offline mode: yellow banner with [Try again]; resumes automatically on `navigator.onLine`.
- NEW – **Auth header guard**
  - Realtime and fetchers read the token at send time; if missing, do not attach `Authorization` and avoid unnecessary errors.

**Impact:** Tabs stop polling within <200 ms after logout; zero “jwt malformed” tails; lower error noise and cleaner UX during session transitions.

---

## 7) Legacy Cleanup & Compatibility

- Deprecated `/finance/events/subscribe` (100ms “fake” polling) in `backend/finance/subscribe_events.ts`. It returns `410 Gone` outside of dev (or when `ENABLE_WIFI_LEGACY_FINANCE_EVENTS` is not set), preventing accidental usage.
- `use-realtime.ts` (5s interval refresher) no longer touches finance keys; retained only for Dashboard/Tasks where realtime integration is pending.

**Why this matters:** Removing conflicting polling implementations eliminates tight loops, prevents wasteful load, and ensures we rely exclusively on the hardened long‑poll + events approach.

---

## 8) Patterns to Reuse for Other Pages

1. **Introduce long‑poll + buffer** for each domain if you need near‑real‑time, or reuse the existing finance buffer if events are relevant across pages.
2. **Adopt Leader/Follower** with `BroadcastChannel` + lease (Web Locks/localStorage). Single long‑poll per session, followers subscribe to an in‑memory local bus.
3. **Coalesce derived invalidations** – maintain instant row state, update aggregates with a small debounce (e.g., 500–1500ms) or longer staleTime when realtime is healthy.
4. **Centralize auth refresh** – reuse the mutex, `auth-refresh` sharing, logout broadcast, and banner patterns from `AuthContext`/`Layout`.
5. **Telemetry‑first** – sample edge conditions (`fast_empty`, 401/403/0) and publish to `/telemetry/client` for ongoing visibility.
6. **CORS & dev proxy** – ensure relevant routes leverage `max_age_seconds` in `encore.app` and precise dev proxies to cut preflights.
7. **Authorization guard** – never send empty Bearer headers; abort or skip protected calls when tokens are missing.
8. **Session lifecycle** – include the logout broadcast + realtime stop + offline/expired banner across pages.

---

## 9) Operational Checklists

### Post‑Deploy
- Confirm `GET /finance/realtime/metrics` returns sensible buffers and published/delivered counts.
- In logs, verify `[RealtimeSubscribe][completed]` durations ~25s at idle, shorter on events.
- Ensure only one subscribe per session (open two tabs and filter by `subscribe` in DevTools Network).
- Confirm OPTIONS volume drops (with `max_age_seconds` set) in prod.

### Auth Expiry QA
- Force token expiry in 2–4 tabs:
  - Only one refresh request occurs; other tabs pause and resume with `auth-refresh` broadcast.
  - On repeated failures, the global banner appears; retries backoff to ≤1/min.
  - Telemetry shows reduced 401 bursts and proper backoff.

### Logout Broadcast QA
- Duplicate a logged‑in tab and click logout in one tab:
  - All tabs stop polling within <200 ms; zero “jwt malformed” tail logs.
  - No resubscribe attempts until sign‑in.
  - If offline, the offline banner appears; if expired, the session banner appears.

### Performance Targets
- Idle long‑poll duration ~25s; leader count ~= number of active sessions (not tabs).
- Derived queries fire ≤1/sec during bursts; fewer preflights (thanks to CORS max‑age + proxy).
- Buffer sizes remain below `MAX_BUFFER_SIZE`; no sustained `waiter_cap` logs.

---

## 10) File Index

- Backend
  - `backend/finance/realtime_buffer.ts` – bounded per‑org buffer + TTL + waiter cap + eviction + metrics.
  - `backend/finance/subscribe_realtime.ts` – long‑poll + failure/completion tags.
  - `backend/finance/finance_realtime_subscriber.ts` – pushes published events to buffer.
  - `backend/finance/subscribe_events.ts` – legacy polling endpoint (now 410 in prod).
  - `backend/finance/realtime_metrics.ts` – `GET /finance/realtime/metrics`.
  - `backend/encore.app` – global CORS `max_body_size`, `max_age_seconds`, allow/expose headers.
  - `backend/telemetry/ingest.ts` – `POST /telemetry/client` (sampled client telemetry).

- Frontend
  - `frontend/hooks/useFinanceRealtimeV2.ts` – leader/follower long‑poll, RTT‑aware backoff, hidden/follower pacing, telemetry.
  - `frontend/pages/FinancePage.tsx` – event‑driven row patching + debounced derived invalidations + dynamic staleTime.
  - `frontend/components/ui/daily-approval-manager.tsx` – removed legacy `useFinanceEvents` polling.
  - `frontend/services/backend.ts` – generic 401/403/0 telemetry + centralized refresh trigger.
  - `frontend/contexts/AuthContext.tsx` – refresh mutex (Web Locks/localStorage), `auth-refresh` token sharing, `auth-control` logout broadcast, banner/backoff.
  - `frontend/components/GlobalAuthBanner.tsx` – global offline/expired banner UI.
  - `frontend/components/Layout.tsx` – renders the global banner and temporarily disables interaction while visible.
  - `frontend/vite.config.ts` – dev proxy for `/finance/realtime/*` only.

---

## 11) Quick Start for a New Feature/Page

1. If you need realtime:
   - Add a `subscribe_*.ts` endpoint + buffer (or reuse finance buffer).
   - Define event types + subscriber pushing to the buffer.
2. Add a `use...RealtimeV2` hook:
   - Implement leader/follower + broadcast + RTT/backoff logic mirroring `useFinanceRealtimeV2.ts`.
3. Connect page state:
   - Patch row‑level caches from events; debounce expensive aggregates.
4. Respect auth and telemetry patterns:
   - Use the global refresh mechanism.
   - Emit sampled telemetry for edge cases.
5. Validate with the operational checklist above.

---

## 12) Advanced Monitoring & Rollout Controls

- **Dynamic sampling:** Adjust client telemetry sample rates per environment or org cohort.
- **Correlation IDs:** Include `requestId`, `eventId`, and `tabId` in sampled events to stitch client↔server traces.
- **Feature flags:** All key behaviors accept localStorage‑based flags and can be wired to remote config with TTL (e.g., leader election, banner enablement, derived invalidation windows).
- **Privacy:** Never send tokens in telemetry; truncate or hash identifiers and user‑agent strings.

---

With these foundations, the platform is prepared for sustained growth to 1M+ orgs, minimizing backend overhead while delivering near‑instant UI updates and actionable diagnostics. These patterns are generic and ready for reuse across services and new features.

---

## 13) Security: Tenant Cache Partitioning

Multi-tenant cache isolation is **critical** to prevent cross-tenant data exposure.

### 13.1 X-Org-Key Implementation

```typescript
// backend/middleware/tenant_isolation.ts

// Generate deterministic tenant key from validated orgId
const tenantKey = sha256(`org:${orgId}:tenant-isolation-key`).slice(0, 16);

// Headers added to every cacheable response
headers['X-Org-Key'] = tenantKey;
```

### 13.2 CDN Configuration

**Cloudflare:**
- Cache Key Rules include `X-Org-Key` in cache key computation
- Response Transform Rules strip `X-Org-Key` before delivery to client

**Fastly:**
- VCL: `set req.http.X-Org-Key = ...` includes in cache key
- VCL: `unset beresp.http.X-Org-Key` removes from response

### 13.3 Policy (MANDATORY)

> **X-Org-Key MUST NOT appear in client-visible response headers.**
> 
> Enforce strip at edge by default. Failure to strip is a **security incident**.

Headers that must be stripped from client responses:
- `X-Org-Key`
- `Surrogate-Key`
- `Surrogate-Control`
- `X-Cache-Tags`
- `X-Tenant-Partition`

### 13.4 Validation

```bash
# Verify X-Org-Key is NOT in response
curl -I https://api.example.com/v1/properties -H "Authorization: Bearer $TOKEN" \
  | grep -i "x-org-key"
# Should return nothing
```

---

## 14) Rollback Strategy

### 14.1 Trigger Conditions

| Condition | Action | Priority |
|-----------|--------|----------|
| **Cross-tenant data exposure** | Immediate CDN bypass for affected endpoints | P0 |
| **Staleness tickets >5% of weekly** | Reduce s-maxage to 30s for affected families | P1 |
| **Purge lag >30s on critical paths** | Disable caching for those endpoints | P1 |
| **CDN 5xx rate >1% for 5 minutes** | Activate circuit breaker, bypass CDN | P1 |

### 14.2 Rollback Procedure

1. **Immediate Response** (within 5 minutes)
   ```bash
   # Push edge rule to disable caching
   curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone}/rulesets/{ruleset}/rules" \
     -H "Authorization: Bearer $CF_TOKEN" \
     -d '{"expression": "http.request.uri.path matches \"^/v1/finance/\"", "action": "set_cache_settings", "action_parameters": {"cache": false}}'
   ```

2. **Purge All Relevant Keys**
   ```bash
   # Coarse purge for org and property
   curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone}/purge_cache" \
     -H "Authorization: Bearer $CF_TOKEN" \
     -d '{"tags": ["org:123", "property:456", "finance:summary:property:456"]}'
   ```

3. **Incident Review** (within 24 hours)
   - Verify cache key correctness
   - Audit tenant partitioning (X-Org-Key in cache key)
   - Check purge latencies in metrics
   - Review affected user reports

4. **Re-enablement** (with approval)
   - Start with s-maxage=30s
   - Monitor for 2 hours
   - Increase to s-maxage=120s
   - Monitor for 4 hours
   - Return to baseline TTL

### 14.3 Circuit Breaker Configuration

```typescript
// Automatic CDN bypass on failure
const circuitBreaker = {
  failureThreshold: 5,        // 5 failures
  failureWindow: 60_000,      // within 1 minute
  resetTimeout: 300_000,      // 5 minutes cooldown
  state: 'closed',            // closed | open | half-open
};
```

---

## 15) Purge Storm Mitigation

### 15.1 Debouncing Strategy

```typescript
// backend/middleware/purge_manager.ts

const DEBOUNCE_MS = 1500; // 1.5 second debounce per key family

// Keys are grouped by family before purging
// Multiple mutations to same property within 1.5s = single purge
```

### 15.2 Queue-and-Batch

| Config | Value | Rationale |
|--------|-------|-----------|
| Max purges/second | 50 | CDN allows ~1000/min |
| Max keys/batch | 30 | Cloudflare limit |
| Debounce window | 1500ms | Balance freshness vs load |
| Rate limit retry | 5s | Backoff on 429 |

### 15.3 Coarse Keys for Bulk Operations

During bulk ingest/import, use property-level keys instead of item-level:
```typescript
// Instead of purging each expense:
// ❌ finance:expense:123, finance:expense:124, ...

// Purge the property summary:
// ✅ finance:expenses:property:456
// ✅ finance:summary:property:456
```

### 15.4 Monitoring

- **Queue depth**: Alert if >100 pending purges
- **429 rate**: Alert on any CDN rate limit responses
- **Purge latency**: p95 should be <5s

---

## 16) Rate Limiting

### 16.1 Token Bucket Configuration

| Endpoint Type | Per User | Per Org | Rationale |
|--------------|----------|---------|-----------|
| Write (POST/PUT/PATCH) | 100 req/min | 500 req/min | Protect database |
| Read (after CDN miss) | 300 req/min | - | Prevent origin abuse |
| Realtime subscriptions | 10 streams | 1000 streams | Memory limits |
| Signed URL generation | 50 req/min | 500 req/min | S3 rate limits |

### 16.2 Response Format

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 17
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1702234567

{
  "code": "rate_limit_exceeded",
  "message": "Rate limit exceeded. Please retry after 17 seconds.",
  "details": {
    "retryAfter": 17,
    "limitType": "WRITE_USER",
    "remaining": 0
  }
}
```

### 16.3 Implementation

```typescript
// backend/middleware/rate_limiter.ts
const result = enforceRateLimit('write', userId, orgId);

if (!result.allowed) {
  throw new APIError({
    code: ErrCode.ResourceExhausted,
    message: result.error.message,
  });
}
```

---

## 17) Idempotency-Key Enforcement

### 17.1 Required Endpoints (P1)

- `POST /finance/expenses` - Expense creation
- `POST /finance/revenues` - Revenue recording
- `POST /guest-checkin/create` - Guest check-in
- `POST /staff/check-in` - Staff check-in
- `POST /staff/check-out` - Staff check-out
- `POST /uploads/file` - Document upload start

### 17.2 Behavior

| Scenario | Response |
|----------|----------|
| New key + payload | Process request, store result |
| Same key + same payload | Return cached result (replay) |
| Same key + different payload | `409 Conflict` |

### 17.3 Storage

- **Backend**: Redis with 24h TTL
- **Key format**: `idempotency:{orgId}:{key}`
- **Stored data**: payload hash, status, response body, entity ID

### 17.4 Client Usage

```bash
curl -X POST "https://api.example.com/v1/finance/expenses" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: expense-$(uuidgen)" \
  -d '{"propertyId": 1, "amountCents": 50000, ...}'
```

---

## 18) Materialized View Refresh Strategy

### 18.1 Option A: Concurrent Refresh (Recommended Initially)

```sql
-- Create MV with unique index for concurrent refresh
CREATE MATERIALIZED VIEW finance_daily_summary AS
SELECT 
  property_id,
  DATE(occurred_at AT TIME ZONE 'Asia/Kolkata') as date,
  SUM(CASE WHEN type = 'revenue' THEN amount_cents ELSE 0 END) as revenue_cents,
  SUM(CASE WHEN type = 'expense' THEN amount_cents ELSE 0 END) as expense_cents
FROM transactions
WHERE status = 'approved'
GROUP BY property_id, DATE(occurred_at AT TIME ZONE 'Asia/Kolkata');

CREATE UNIQUE INDEX ON finance_daily_summary (property_id, date);

-- Refresh without blocking reads
REFRESH MATERIALIZED VIEW CONCURRENTLY finance_daily_summary;
```

### 18.2 Refresh Cadence

| MV Type | Refresh Interval | Cache Invalidation |
|---------|------------------|-------------------|
| Daily summaries | 5 minutes | After refresh completes |
| Monthly summaries | 5 minutes | After refresh completes |
| Reports (daily) | 15 minutes | On transaction mutation |
| Reports (monthly) | 1 hour | On report regeneration |

### 18.3 Fallback Strategy

```typescript
async function getSummary(propertyId: number) {
  // Try MV first
  const mvResult = await queryMV(propertyId);
  
  if (mvResult.isStale || mvResult.refreshDelayed) {
    // Fallback to direct query with Redis cache (60s TTL)
    const directResult = await queryWithCache(propertyId, 60);
    
    // Log stale-serve event for monitoring
    logStaleSummaryServe(propertyId);
    
    return directResult;
  }
  
  return mvResult;
}
```

### 18.4 Option B: Incremental Aggregation (Future)

For high-volume scenarios, consider:
- Triggers on transaction inserts
- Append-only event streams
- Periodic compaction

---

## 19) PgBouncer Configuration

### 19.1 Recommended Settings

```ini
[pgbouncer]
; Pool mode - transaction is best for web workloads
pool_mode = transaction

; Pool sizing (2× logical CPU cores per replica)
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 3

; Connection limits
max_client_conn = 1000
max_db_connections = 100

; Timeouts
server_connect_timeout = 3
server_idle_timeout = 60
query_timeout = 30
query_wait_timeout = 60

; Prepared statements (disable for transaction mode)
; server_reset_query = DISCARD ALL
ignore_startup_parameters = extra_float_digits
```

### 19.2 Pool Sizing Formula

```
pool_size = CPU_cores × 2 × num_replicas
reserve_pool = 5 per database (emergency/admin)
```

### 19.3 Monitoring

| Metric | Alert Threshold | Action |
|--------|-----------------|--------|
| Connection saturation | >80% | Scale pool or add replica |
| Server-side wait events | >100ms avg | Check slow queries |
| Avg transaction time | >50ms | Optimize queries |
| Client queue time | >100ms | Increase pool size |

### 19.4 Prepared Statements

With `pool_mode = transaction`, avoid:
- Named prepared statements
- `PREPARE` / `EXECUTE` patterns
- ORM features that use prepared statements

Use parameterized queries instead:
```typescript
// ✅ Good - parameterized
await db.query('SELECT * FROM expenses WHERE property_id = $1', [propertyId]);

// ❌ Bad - prepared statement
await db.prepare('get_expenses').query(propertyId);
```

---

## 20) Load Testing Gates

### 20.1 Pre-Production Test Requirements

| Test | Criteria | Duration |
|------|----------|----------|
| Traffic | 500 RPS sustained, 2000 RPS burst | 60+ minutes |
| Purge throughput | 1000 purge ops/min, no throttling | 10 minutes |
| Chaos | CDN 5xx → circuit breaker <1 min | 5 minutes |
| Realtime | 50k concurrent, p95 <500ms, errors <0.1% | 30 minutes |

### 20.2 Pass Criteria

- All SLOs met for 60+ minutes at 80th percentile of target loads
- No cross-tenant data leakage
- No rollback triggers activated
- p95 latency within budget

### 20.3 Run Load Tests

```bash
# Run full test suite
cd backend && npx ts-node tests/load_testing.ts

# Dry run (simulated)
npx ts-node tests/load_testing.ts --dry-run

# With custom config
BASE_URL=https://staging.example.com AUTH_TOKEN=$TOKEN npx ts-node tests/load_testing.ts
```

---

## 21) Time-Bound Rollout Timeline

### P0: Foundation (Week 0-2)

| Week | Deliverable | Owner |
|------|-------------|-------|
| 0 | Instrumentation: edge/origin p95/p99, payload sizes, CDN metrics | Backend |
| 0 | Dashboards live: Grafana/Datadog with SLO tracking | DevOps |
| 1 | Global middleware: compression + ETag/Last-Modified | Backend |
| 1 | Validate 304 paths in staging | QA |
| 2 | Tenant cache partitioning: X-Org-Key in cache key | Backend |
| 2 | Edge rule: strip X-Org-Key from responses | DevOps |

### P1: Core Features (Week 3-5)

| Week | Deliverable | Owner |
|------|-------------|-------|
| 3 | Realtime consolidation: 10% → 50% → 100% rollout | Backend |
| 3 | Tiered batching: 0-50/50-150/150-400ms | Backend |
| 4 | CDN caching for reports/metadata with purge-by-tag | Backend/DevOps |
| 4 | Request coalescing and shielding enabled | DevOps |
| 5 | Idempotency-Key enforcement for critical writes | Backend |
| 5 | Rate limiting middleware deployed | Backend |

### P2: Optimization (Week 6-8)

| Week | Deliverable | Owner |
|------|-------------|-------|
| 6 | Bootstrap split: /static (edge) + /user (origin with ETag) | Backend |
| 6 | Client on-disk caches for web/Android/iOS | Frontend/Mobile |
| 7 | Database: read replicas for reports/analytics | DBA |
| 7 | PgBouncer pool_mode=transaction | DBA |
| 8 | Redis result cache for hot summaries (30-60s TTL) | Backend |
| 8 | Materialized views with refresh cadence | DBA |

### P3: Advanced (Week 9+)

| Week | Deliverable | Owner |
|------|-------------|-------|
| 9 | HTTP/3 enablement (after H2 optimization) | DevOps |
| 9 | 0-RTT only for idempotent GET | Backend |
| 10+ | Offline mutation queue (based on telemetry ROI) | Frontend |
| 10+ | Binary encodings if justified by payload analysis | Backend |

---

## 22) fields= Sparse Field Selector

### 22.1 Supported Endpoints (Initial 10)

1. `/v1/finance/expenses` (list)
2. `/v1/finance/revenues` (list)
3. `/v1/reports/daily-report`
4. `/v1/reports/monthly-report`
5. `/v1/reports/date-transactions`
6. `/v1/guest-checkin/list`
7. `/v1/staff/attendance`
8. `/v1/staff/leave-requests`
9. `/v1/properties` (list)
10. `/v1/users/properties`

### 22.2 Usage

```bash
# Request only specific fields
curl "https://api.example.com/v1/finance/expenses?fields=id,amountCents,description,status"

# Expand nested objects
curl "https://api.example.com/v1/reports/daily-report?fields=date,totalReceivedCents&expand=transactions"

# Response includes metadata
# X-Fields-Returned: id,amountCents,description,status
# X-Fields-Available: id,propertyId,propertyName,amountCents,...
```

### 22.3 Payload Savings

| Endpoint | Full Response | With fields= | Savings |
|----------|--------------|--------------|---------|
| /finance/expenses (100 items) | ~85 KB | ~25 KB | 70% |
| /reports/monthly-report | ~45 KB | ~8 KB | 82% |
| /guest-checkin/list (50 items) | ~120 KB | ~30 KB | 75% |

---

## 23) CDN Failure Degradation

### 23.1 Gateway Fallback

```typescript
// On CDN 5xx/timeout, activate bypass mode
if (cdnError || cdnTimeout) {
  headers['X-CDN-Bypass'] = 'true';
  
  // Apply rate limiting to protect origin
  const rateLimit = enforceRateLimit('read', userId, orgId);
  if (!rateLimit.allowed) {
    return { status: 429, retryAfter: rateLimit.retryAfter };
  }
  
  // Add jittered retry
  headers['Retry-After'] = String(5 + Math.random() * 10);
}
```

### 23.2 Client Bypass Header

For last-resort retries, clients can request CDN bypass:

```http
GET /v1/finance/summary
X-Bypass-CDN: true
```

This triggers origin-direct fetch with:
- Exponential backoff
- Rate limiting applied
- No caching

### 23.3 Alert Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| CDN 5xx rate | >1% for 5 min | Trigger incident |
| CDN timeout rate | >0.5% for 5 min | Enable bypass mode |
| Origin latency | p95 >500ms | Scale origin |

---

## 24) Media and Documents Policy

### 24.1 Public Assets (task-images, logos)

| Setting | Value | Rationale |
|---------|-------|-----------|
| URL format | `/assets/{hash}/{filename}` | Immutable, content-hash |
| Cache-Control | `public, max-age=2592000, immutable` | 30 days |
| Edge resizing | Enabled | Responsive images |
| Surrogate-Key | `static:{hash}` | Purge on rotation |

### 24.2 Private Documents (guest-documents)

| Document Type | Signed URL TTL | Lifecycle |
|---------------|----------------|-----------|
| Guest ID documents | 1-2 hours | Delete after checkout + 90 days |
| Receipts | 4-6 hours | Retain for 7 years |
| Exports | 1 hour | Delete after 24 hours |

### 24.3 Access Controls

```typescript
// Generate signed URL with audit logging
const signedUrl = await generateSignedUrl({
  bucket: 'guest-documents',
  key: `org/${orgId}/guest/${guestId}/${documentId}`,
  expiresIn: 3600, // 1 hour
  audit: {
    userId: auth.userId,
    action: 'view_document',
    resourceId: documentId,
  },
});
```

### 24.4 Range and HEAD Support

- `Range` header supported for large documents
- `HEAD` requests return metadata without body
- `Content-Disposition: inline` for viewing, `attachment` for download

---

## 25) Decision Log

This section captures key architectural decisions, rationale, and responsible parties.

| Decision | Choice | Rationale | Date | Owner |
|----------|--------|-----------|------|-------|
| Tenant partitioning | X-Org-Key header, SHA-256 hash | Deterministic, non-reversible, CDN-compatible | 2024-01 | Backend |
| Cache TTLs | See Section 13.2 | Balance freshness vs origin load | 2024-01 | Backend |
| Rate limits | Token bucket, see Section 16.1 | Smooth rate limiting with burst allowance | 2024-01 | Backend |
| Idempotency storage | Redis with 24h TTL | Fast, ephemeral, clustered | 2024-01 | Backend |
| Purge debounce | 1.5s per key family | Reduce purge storms during bulk ops | 2024-01 | Backend |
| MV refresh | CONCURRENTLY, 5-15 min cadence | Non-blocking, eventual consistency acceptable | 2024-01 | DBA |
| PgBouncer mode | transaction | Best for web workloads, avoids prepared statement issues | 2024-01 | DBA |
| HTTP/3 | Deferred to P3 | Optimize H2 first, measure ROI | 2024-01 | DevOps |
| fields= scope | Top 10 endpoints only | 80/20 rule, minimize engineering cost | 2024-01 | Backend |

### Code Touchpoints

- **Tenant isolation**: `backend/middleware/tenant_isolation.ts`
- **Rate limiting**: `backend/middleware/rate_limiter.ts`
- **Idempotency**: `backend/middleware/idempotency.ts`
- **Purge management**: `backend/middleware/purge_manager.ts`
- **Field selection**: `backend/middleware/field_selector.ts`
- **Cache headers**: `backend/middleware/cache_headers.ts`
- **Load testing**: `backend/tests/load_testing.ts`
- **Realtime client**: `frontend/providers/RealtimeProviderV2_Fixed.tsx`
- **Connection pool**: `backend/realtime/connection_pool.ts`
- **API reference**: `docs/API_COMPLETE_REFERENCE.md`
- **CDN setup**: `docs/CDN_SETUP_GUIDE.md`

---

## 26) P0 Networking Optimizations (10M-User Scale)

This section documents the edge caching, compression, and conditional GET optimizations implemented as part of the P0 phase targeting 10M users.

### 26.1 Middleware Service Overview

A new `backend/middleware/` service provides global networking optimizations:

| File | Purpose |
|------|---------|
| `metrics_aggregator.ts` | In-memory metrics storage with p50/p95/p99 percentiles |
| `response_metrics.ts` | Server-Timing header and request timing tracking |
| `compression.ts` | Brotli/gzip compression for responses > 1KB |
| `etag.ts` | ETag generation and If-None-Match 304 handling |
| `last_modified.ts` | Last-Modified tracking and If-Modified-Since handling |
| `cache_headers.ts` | Cache-Control and Surrogate-Key header generation |
| `baseline_metrics.ts` | Metrics API endpoints for dashboards |
| `wrapper.ts` | Combined wrapper for easy endpoint integration |

### 26.2 TTL Policies by Endpoint Family

| Family | s-maxage | max-age | Rationale |
|--------|----------|---------|-----------|
| Properties | 30 min | 5 min | Low churn, purge on change |
| Branding | 30 min | 10 min | Low churn, purge on change |
| Analytics | 5 min | 1 min | Summary data, realtime invalidates |
| Finance | 5 min | 1 min | Summary data, realtime invalidates |
| Reports | 15 min | 5 min | Historical data, stable |
| Staff | 3 min | 1 min | Operational data |
| Tasks | 2 min | 30 sec | High churn |
| Guest Check-in | 1 min | 15 sec | Very high churn |

### 26.3 Surrogate-Key Taxonomy (for CDN Purge-by-Tag)

```
org:{orgId}
property:{propertyId}
user:{userId}
finance:summary:property:{propertyId}
finance:expenses:property:{propertyId}
finance:revenues:property:{propertyId}
reports:daily:property:{propertyId}:date:{YYYY-MM-DD}
reports:monthly:property:{propertyId}:year:{YYYY}:month:{MM}
branding:theme:org:{orgId}
analytics:overview:org:{orgId}
```

### 26.4 Conditional GET Flow

```
Client Request:
  GET /v1/reports/daily-report
  If-None-Match: "a1b2c3d4"
  Accept-Encoding: br, gzip

Server Response (cache hit):
  304 Not Modified
  ETag: "a1b2c3d4"
  Cache-Control: public, s-maxage=900, stale-while-revalidate=86400

Server Response (cache miss):
  200 OK
  ETag: "e5f6g7h8"
  Content-Encoding: br
  Cache-Control: public, s-maxage=900, stale-while-revalidate=86400
  Surrogate-Key: org:123 property:456 reports:daily:property:456:date:2024-01-15
  Server-Timing: total;dur=45.23, db;dur=32.10
```

### 26.5 Baseline Metrics Endpoints

```
GET /v1/monitoring/baseline-metrics
  Returns: Overall TTFB percentiles, payload sizes, 304 ratio, compression stats

GET /v1/monitoring/baseline-metrics/:family
  Returns: Metrics for specific endpoint family (reports, finance, etc.)

GET /v1/monitoring/slo-status
  Returns: Current SLO compliance with recommendations
```

### 26.6 Frontend RUM Collection

`frontend/lib/rum-metrics.ts` captures:
- Navigation Timing API data (TTFB, DOMContentLoaded, Load)
- Fetch performance for API calls (timing, size, status)
- 5% sampling rate to minimize overhead
- Batched submission to `/telemetry/client`

### 26.7 Integration Pattern

To add optimizations to an existing endpoint:

```typescript
import { withNetworkingOptimizations } from '../middleware';

export const myEndpoint = api<MyRequest, MyResponse>(
  { auth: true, method: "GET", path: "/v1/my/endpoint" },
  async (req) => {
    const result = await withNetworkingOptimizations(
      {
        path: "/v1/my/endpoint",
        acceptEncoding: req.acceptEncoding,
        ifNoneMatch: req.ifNoneMatch,
        orgId: authData.orgId,
        propertyId: req.propertyId,
        entityType: 'my_entity_type',
      },
      async (timer) => {
        timer.checkpoint('db');
        const data = await fetchData();
        return data;
      }
    );

    return result.data;
  }
);
```

### 26.8 SLO Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Edge p95 TTFB | ≤100 ms | Cached reads |
| Dynamic p95 TTFB | ≤250 ms | Cache misses |
| Write p95 TTFB | ≤350 ms | POST/PUT/PATCH |
| CDN hit ratio (static) | ≥95% | Task images, logos |
| CDN hit ratio (GET) | ≥80% | Eligible API endpoints |
| 304 ratio | ≥50% | On revisits with ETag |
| Median payload | ≤40 KB | Compressed |

### 26.9 CDN Setup

See [CDN_SETUP_GUIDE.md](./CDN_SETUP_GUIDE.md) for detailed Cloudflare/CloudFront configuration including:
- Multi-tenant cache isolation via X-Org-Key
- Purge-by-tag integration
- Header stripping for security
- Rollout checklist

---

## 27) File Index (Updated)

### Backend (Networking Middleware)

- `backend/middleware/encore.service.ts` – Service declaration
- `backend/middleware/metrics_aggregator.ts` – In-memory metrics with sliding window
- `backend/middleware/response_metrics.ts` – Server-Timing + request timing
- `backend/middleware/compression.ts` – Brotli/gzip compression
- `backend/middleware/etag.ts` – ETag generation + 304 handling
- `backend/middleware/last_modified.ts` – Last-Modified tracking
- `backend/middleware/cache_headers.ts` – Cache-Control + Surrogate-Key
- `backend/middleware/baseline_metrics.ts` – Metrics API endpoints
- `backend/middleware/wrapper.ts` – Combined optimization wrapper
- `backend/middleware/integration_examples.ts` – Usage examples
- `backend/middleware/tenant_isolation.ts` – X-Org-Key tenant cache partitioning
- `backend/middleware/rate_limiter.ts` – Token bucket rate limiting
- `backend/middleware/idempotency.ts` – Idempotency-Key enforcement
- `backend/middleware/purge_manager.ts` – CDN purge debouncing and batching
- `backend/middleware/field_selector.ts` – Sparse field selection (fields= parameter)

### Backend (Testing)

- `backend/tests/load_testing.ts` – Load testing harness (traffic, purge, chaos, realtime)

### Frontend (RUM)

- `frontend/lib/rum-metrics.ts` – Real User Monitoring collection

### Documentation

- `docs/CDN_SETUP_GUIDE.md` – CDN configuration guide
- `docs/NETWORKING_AND_REALTIME_IMPROVEMENTS.md` – This document (A-grade networking plan)


