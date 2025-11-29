# API Versioning Migration Guide (Production-Ready) — Path Scheme: `/v1/...`

This guide describes how to introduce API versioning without breaking existing clients, using a path-only version prefix (`/v1`) on the `api.<domain>` subdomain.

## 1. Decisions (Locked)
- **Base URLs**
  - Dev: `https://api.dev.<domain>`
  - Staging: `https://api.stg.<domain>`
  - Prod: `https://api.<domain>`
- **Version Prefix**: `/v1/...` (no `/api` segment, since we already use `api.<domain>`).
- **Health Endpoints**
  - Keep bare `GET /health` for liveness.
  - Move detailed health to `GET /v1/system/health` (and related system endpoints under `/v1/system/*`).
- **Dual Routing (Compatibility)**
  - Phase A (2–4 weeks): legacy paths transparently proxy to `/v1` handlers, emit `Deprecation`/`Sunset` headers. Gate via `ENABLE_LEGACY_ROUTES=true`.
  - Phase B (2–4 weeks): change legacy paths to HTTP 308 redirects to `/v1/...`.
  - Phase C: remove legacy paths (60–90 days total window depending on external usage).
- **Realtime**
  - Standardize on SSE/polling endpoints under `/v1/.../realtime/subscribe`.
  - Include `schemaVersion: 1` in event payloads. If WebSocket is required later, add parallel `/v1/.../ws` endpoints and document both.
- **Docs & Artifacts**
  - Maintain: `docs/api/inventory.md`, `docs/api/changelog.md`, this guide.
  - Generate OpenAPI per version (store under `docs/api/v1/openapi.yaml`).
  - Update Postman/k6 collections to target `/v1`.
- **Monitoring & CI**
  - Log legacy-path hits; add a small dashboard tile “Legacy requests per day”.
  - CI guardrail: fail if any new Encore `api({ path })` doesn’t start with `"/v"`.

## 2. Scope Overview (What changes vs. what doesn’t)
- **Changes**
  - HTTP paths gain a `/v1` prefix (REST, SSE, utility, most public endpoints).
  - Legacy paths remain accessible temporarily via proxy/redirect.
  - Realtime payloads gain a `schemaVersion` field.
  - System/monitoring endpoints migrate under `/v1/system/*` (except bare `/health`).
- **No Changes**
  - Business logic, auth, request validation, database operations, and permissions stay the same.
  - Error codes and status semantics remain stable in v1 (if changes are needed, they occur in v2).

## 3. Implementation Plan (Low-Risk Rollout)

### 3.1 Shared Constant and Guardrails
- Add a shared constant file (e.g., `backend/shared/http.ts`) with:
  - `export const API_V1_PREFIX = "/v1";`
  - Helper(s) to build Encore `path` values from this constant.
- Add CI/lint rule to ensure `path:` starts with `"/v"`.

### 3.2 Express Gateway (`backend/server.cjs`)
- Create a versioned router:
  - `const v1 = express.Router();`
  - Move existing route handlers under `/v1` by mounting: `app.use('/v1', v1);`
- Legacy compatibility:
  - If `ENABLE_LEGACY_ROUTES=true`, keep old paths active by:
    - Proxying: directly calling the v1 handler
    - Emitting headers:
      - `Deprecation: true`
      - `Sunset: <RFC1123 date ~ 60–90 days ahead>`
      - `Link: </docs/api/changelog#deprecated>; rel="deprecation"`
  - After 2–4 weeks, switch legacy paths to `res.redirect(308, '/v1/...')`.
  - After 60–90 days, remove legacy routes.

Concrete example (before/after + legacy proxy):

Before:

```
app.post('/auth/signup', async (req, res) => { /* handler */ });
```

After (v1 router + legacy passthrough):

```
const v1 = express.Router();
v1.post('/auth/signup', async (req, res) => { /* handler */ });
app.use('/v1', v1);

if (process.env.ENABLE_LEGACY_ROUTES === 'true') {
  app.post('/auth/signup', (req, res, next) => {
    res.set('Deprecation', 'true');
    res.set('Sunset', 'Wed, 01 Feb 2026 00:00:00 GMT');
    res.set('Link', '</docs/api/changelog#deprecated>; rel="deprecation"');
    // Re-route to the versioned handler
    req.url = '/v1/auth/signup';
    // Delegate to express internals
    // @ts-ignore
    v1.handle(req, res, next);
  });
}
```

Note on health routes:
- The public liveness endpoint remains `GET /health` and is served by Encore (`backend/monitoring/monitoring_dashboard.ts`).
- The Express gateway does not expose `/health` to avoid collisions; detailed health is available at `GET /v1/system/health`.

### 3.3 Encore Services (All Domains)
 - Update every `api({ method, path, ... })` to:
  - `path: `${API_V1_PREFIX}/<domain>/<resource>``
 - Scope: ~346 path definitions across ~238 TypeScript files; after excluding internal/debug, ~150 public-facing endpoints expected to migrate.
 - Domains and common mappings (representative, not exhaustive):
  - Finance:
    - `/finance/revenues` → `/v1/finance/revenues`
    - `/finance/expenses` → `/v1/finance/expenses`
    - `/finance/realtime/subscribe` → `/v1/finance/realtime/subscribe`
    - `/finance/realtime/metrics` → `/v1/finance/realtime/metrics`
    - `/finance/revenue|expense|approve` → `/v1/finance/revenue|expense|approve`
  - Guest Check-in:
    - `/guest-checkin/create|list|:id` → `/v1/guest-checkin/create|list|:id`
    - `/guest-checkin/audit-logs*` → `/v1/guest-checkin/audit-logs*`
    - `/guest-checkin/realtime/subscribe` → `/v1/guest-checkin/realtime/subscribe`
    - Keep any `.../subscribe/v2` variants nested under `/v1/...` for consistency; document payload differences.
  - Properties/Tasks/Users/Staff:
    - `/properties*` → `/v1/properties*`
    - `/tasks*` → `/v1/tasks*`
    - `/users*` → `/v1/users*`
    - `/staff*` → `/v1/staff*`
  - Reports:
    - `/reports/daily|monthly|reconcile` → `/v1/reports/daily|monthly|reconcile`
    - Normalize export endpoints: `/reports/v2/export-*` → `/v1/reports/export/*` (legacy kept temporarily).
  - Staff Exports (Normalization Decision):
    - Current: `/staff/v2/leave/export`, `/staff/v2/attendance/export`, `/staff/v2/salary/export`
    - Target: `/v1/staff/export/leave`, `/v1/staff/export/attendance`, `/v1/staff/export/salary` (avoid nested versions)
    - Keep legacy `/staff/v2/*` proxied during deprecation window.
  - System/Monitoring/Cache/Telemetry:
    - `/monitoring/*` → `/v1/system/monitoring/*`
    - `/config/*` → `/v1/system/config/*`
    - `/cache/*` → `/v1/system/cache/*`
    - `/telemetry/client` → `/v1/system/telemetry/client`
    - Reserve bare `/health` for infra liveness; add `/v1/system/health` for detailed health.

### 3.4 Realtime
- Ensure all subscribe endpoints are placed at `/v1/.../realtime/subscribe`.
- Event payloads include:
  ```json
  { "schemaVersion": 1, "...": "..." }
  ```
- If/when WebSockets are introduced, add `/v1/.../ws` endpoints and document payload parity.

Realtime payload examples:

```
interface FinanceRealtimeEvent {
  schemaVersion: 1;
  eventType: 'expense_added' | 'revenue_added' | 'approval_changed';
  orgId: number;
  propertyId?: number;
  entityId: number;
  timestamp: string; // ISO8601
  metadata?: Record<string, any>;
}

interface GuestCheckinRealtimeEvent {
  schemaVersion: 1;
  eventType: 'guest_created' | 'checkout' | 'document_uploaded';
  orgId: number;
  propertyId: number;
  checkInId: number;
  timestamp: string; // ISO8601
  metadata?: Record<string, any>;
}
```

### 3.5 Consumers (Frontend, Mobile, Partners)
- Update client base path to `/v1` (ideally via one central HTTP client or endpoint map).
- Keep legacy paths working during Phase A/B so clients don’t break if not yet updated.
- Update Postman and k6 collections to `/v1`.

### 3.6 Testing & QA
- Update integration/unit tests to hit `/v1`.
- Keep a small smoke suite for legacy paths during Phase A/B.
- Add assertions that legacy responses include deprecation headers.
- Validate realtime payload `schemaVersion`.

### 3.7 OpenAPI & CI Guardrails
- Generate OpenAPI for v1:
  ```
  encore gen openapi > docs/api/v1/openapi.yaml
  ```
- CI check to enforce versioned Encore paths:
  - Script: `scripts/check-versioned-paths.sh`
  - Add to pipeline before build/test; fails if any `api({ path })` is not `/v...`.

## 4. Rollout Timeline (Suggested)
- Week 0:
  - Ship `/v1` with dual routing (proxy) and deprecation headers enabled in staging → prod.
  - Publish `docs/api/changelog.md` and `docs/api/inventory.md`.
  - Notify partners/internals with migration mapping.
- Week 2:
  - Switch legacy to 308 redirects.
  - Monitor legacy usage; chase remaining clients.
- Week 6–12:
  - Remove legacy routes.
  - Close out deprecation in `changelog.md`.

## 5. Monitoring & Compliance
- **Legacy Usage Logging**: emit a structured log on each legacy hit: `{ path, target: "/v1/...", userAgent, orgId?, date }`.
- **Dashboard**: panel “Legacy requests per day” and a simple alert if no decline is observed by Week 2–3.
- **CI/Lint**: automated check rejecting unversioned Encore `path` strings.

## 6. Partner Communication Template
```
Subject: API Versioning Migration to /v1 – Action Required

We are introducing versioned endpoints under /v1 to ensure future compatibility.

Key dates:
- Today: /v1 available; old paths still work with Deprecation/Sunset headers
- +2 weeks: old paths respond with 308 redirects to /v1
- +60–90 days: old paths removed

Resources:
- Migration guide: docs/api/migration-to-v1.md
- Inventory: docs/api/inventory.md
- Changelog: docs/api/changelog.md

If you need help migrating, please reply to this thread.
```

## 7. Appendix: Error & Rate-Limit Stability
- v1 will keep existing error codes and rate-limit semantics unchanged.
- Any change to HTTP error contract or rate-limit headers should be deferred to v2 and documented in the changelog well in advance.


