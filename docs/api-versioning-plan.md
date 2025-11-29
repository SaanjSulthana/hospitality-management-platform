# API Versioning & Compatibility Plan

## 1. Purpose
- Establish predictable `/v{n}` path prefixes across every backend surface so we can evolve schemas (e.g., realtime finance streams) without breaking existing integrations.
- Provide a changelog and fallback layer so partner integrations that currently hit un-versioned routes continue to operate while they migrate.

## 2. Current API Topology (Unversioned)

### 2.1 Legacy Express Gateway (`backend/server.cjs`)
The legacy server exposes mock-friendly endpoints with no namespace segregation. Examples:

```49:140:backend/server.cjs
app.post('/auth/signup', async (req, res) => { ... });
app.post('/auth/login', async (req, res) => { ... });
app.get('/analytics/overview', authenticateToken, (req, res) => { ... });
```

```188:269:backend/server.cjs
app.get('/tasks/list', authenticateToken, ... );
app.get('/properties/list', authenticateToken, ... );
app.get('/finance/revenues', authenticateToken, ... );
app.get('/staff/list', authenticateToken, ... );
```


- No `/api` prefix; routes are mounted at the root.
- Multiple domains (auth, analytics, tasks, properties, finance, staff) coupled in one file, so versioning must happen at the router level.

### 2.2 Encore Services (`encore.dev/api`)
Encore-backed modules place HTTP metadata inline via the `api()` decorator, also lacking versioned prefixes. Representative samples:

| Domain | File(s) | Current Paths | Notes |
| --- | --- | --- | --- |
| Finance | `backend/finance/*.ts` | `/finance/revenues`, `/finance/expenses`, `/finance/realtime/metrics` | Mix of CRUD, realtime subscribe endpoints (`subscribe_realtime.ts`, `subscribe_events.ts`). |
| Finance Service Wrapper | `backend/services/finance-service/finance_service.ts` | `/finance/revenue`, `/finance/expense`, `/finance/approve` | Duplicates noun forms (`/finance/revenue` vs `/finance/revenues`). |
| Guest Check-in | `backend/guest-checkin/*.ts` | `/guest-checkin/create`, `/guest-checkin/audit-logs`, `/guest-checkin/realtime/subscribe` | Contains both v1 and v2 streaming paths (`subscribe-audit-events-v2.ts`). |
| Properties | `backend/properties/*.ts` | `/properties`, `/properties/:id` | Used by UI properties page. |
| Cache & Telemetry | `backend/cache/*.ts`, `backend/telemetry/ingest.ts` | `/cache/*`, `/telemetry/client` | Exposed to front-end instrumentation. |
| Monitoring / Config | `backend/monitoring/*.ts`, `backend/config/health.ts` | `/health`, `/monitoring/unified/metrics`, `/config/health` | Health endpoints collide with legacy Express `/health` (currently commented out). |
| Reports | `backend/reports/*.ts`, `backend/services/reports-service/*` | `/reports/daily`, `/reports/v2/export-*` | Already mixing `/reports` and `/reports/v2` paths without formal version story. |

Example finance definition:

```33:212:backend/finance/list_revenues.ts
export const listRevenues = api(... { method: "GET", path: "/finance/revenues" }, async (req) => { ... });
```

Example guest check-in realtime definition:

```41:104:backend/guest-checkin/subscribe-audit-events.ts
export const subscribeAuditEvents = api(... path: "/guest-checkin/audit-events/subscribe", ...);
```

Because Encore deploys each function as an endpoint, updating the `path` string is the primary way to introduce versioning.

## 3. Pain Points & Break Risks
1. **Global namespace collisions** – `/health` exists in Encore (`backend/monitoring/monitoring_dashboard.ts`) and is referenced in `server.cjs` logs. Without versioned prefixes, future additions risk overriding each other.
2. **Plural vs singular duplication** – Example: `/finance/revenues` (CRUD) vs `/finance/revenue` (service wrapper). Integrations must memorize subtle differences.
3. **Realtime channels** – `/finance/realtime/*` and `/guest-checkin/realtime/*` will introduce different payload contracts as we add “new realtime modes”, but there is no way to signal schema versions today.
4. **SDK assumptions** – Frontend currently imports endpoints without version awareness; hard-coded paths will break if we change schemas silently.

## 4. Proposed Versioning Model
1. **Prefix every public HTTP path with `/v1`** (REST, SSE, WebSocket, cron hooks). Examples:
   - `/finance/revenues` → `/v1/finance/revenues`
   - `/guest-checkin/audit-events/subscribe` → `/v1/guest-checkin/audit-events/subscribe`
   - `/health` (public health) → `/v1/system/health` (reserving bare `/health` for k8s/liveness only).
2. **Introduce `X-API-Version` header** that defaults to the path version but can be used for early previews (`X-API-Version: 1.1`). Header support lets us soft-launch `/v2` while still routing `/v1`.
3. **Canonical router helpers**
   - Express: wrap existing route registrations with `const v1 = express.Router(); ... app.use('/v1', v1);` and ensure legacy paths proxy to versioned routes behind feature flag.
   - Encore: define `const API_V1_PREFIX = "/v1";` in `backend/shared/http.ts` and build paths like ``path: `${API_V1_PREFIX}/finance/revenues` `` to guarantee consistency.
4. **Realtime versioning** – Use explicit suffixes (`/realtime/subscribe` ↦ `/realtime/v1/subscribe`) or include `version` query param. Recommendation: embed version in path for clarity (`/v1/finance/realtime/subscribe`).
5. **Request/response schema tagging** – Add `version` fields inside payloads where breaking changes are likely (e.g., `FinanceRealtimePayload.schemaVersion`).

## 5. Backward Compatibility Strategy
1. **Phase 0 – Inventory & Feature Flags**
   - Generate an inventory matrix (partially captured above) and store it at `docs/api/inventory.md`.
   - Introduce an environment flag `ENABLE_LEGACY_ROUTES=true` to keep old paths active temporarily.
2. **Phase 1 – Dual Routing**
   - Express: mount new `/v1` routers but keep old handlers calling `res.redirect(308, /v1/...)` or `return v1Handler(req, res)`.
   - Encore: create wrapper functions per domain that simply call the new versioned implementation while emitting `Deprecation` headers for legacy paths.
3. **Phase 2 – Deprecation Timeline**
   - Publish timeline in `docs/api/changelog.md`.
   - Send proactive notifications to integration partners (if any) with migration guide referencing `@.agent-os/specs` if required.
4. **Phase 3 – Removal**
   - After a defined window (e.g., 60 days), remove legacy paths and update monitoring dashboards to alert on stray hits.

## 6. Implementation Plan (Work Breakdown)

| Step | Scope | Files / Modules | Notes |
| --- | --- | --- | --- |
| 1 | Shared constants & helpers | `backend/shared/http.ts` (new), `backend/server.cjs` | Define `API_VERSION_PREFIX`, helper to wrap Encore `path`. |
| 2 | Legacy Express router | `backend/server.cjs` | Create `const v1 = express.Router();` and move existing handlers under `/v1`. Implement legacy-to-v1 proxy + deprecation headers. |
| 3 | Finance domain | `backend/finance/*.ts`, `backend/services/finance-service/finance_service.ts` | Update `path` metadata, ensure subscription endpoints become `/v1/finance/...`. Add payload `schemaVersion`. |
| 4 | Properties & Tasks | `backend/properties/*.ts`, `backend/tasks/*.ts`, `frontend` API clients | Update both server and client fetch paths. Tests located under `backend/__tests__`. |
| 5 | Guest check-in | `backend/guest-checkin/*` | Align dozens of document/audit endpoints; add query parameter compatibility for `/v2` SSE streams. |
| 6 | Monitoring / Config / Cache | `backend/monitoring/*`, `backend/cache/*`, `backend/config/*` | Re-home `/health`, `/metrics`, `/cache/*` to `/v1/system/*` style to avoid clashes with infra-level probes. |
| 7 | Documentation & Tooling | `docs/api/changelog.md`, `README.md`, Postman collections | Document migration, add lint rule to prevent non-versioned `path:` strings. |

### Testing Matrix
- Update integration tests under `backend/__tests__` to hit `/v1`.
- Ensure Postman/Newman or k6 scripts are updated; keep one suite targeting legacy paths until removal.
- Add runtime check (middleware) that rejects requests without `/v1` once flag is disabled.

## 7. Changelog & Developer Experience
1. **Changelog file** – Create `docs/api/changelog.md` with sections per version (`## v1.0`, `## v1.1 (preview)`).
2. **OpenAPI / Postman** – Generate OpenAPI spec via Encore metadata and host per version (e.g., `docs/api/v1/openapi.yaml`).
3. **Deprecation headers** – Standardize on:
   - `Deprecation: true`
   - `Sunset: Wed, 24 Feb 2026 00:00:00 GMT`
   - `Link: </docs/api/changelog#deprecated>; rel="deprecation"`
4. **Developer Portal updates** – Surface version badges on UI (tie-in with existing UI/UX guide).

## 8. Risks & Mitigations
| Risk | Impact | Mitigation |
| --- | --- | --- |
| Missed endpoint during migration | Integration break | Use `rg 'path:' backend` inventory script in CI to ensure every exported path contains `/v`. |
| Frontend still calling legacy paths | Runtime failures | Ship compatibility proxy plus analytics event when legacy path is used to identify remaining clients. |
| Realtime clients stuck on old SSE channel | Data mismatch | Keep `/v1/.../subscribe` payload in sync and add `version` field to SSE events so clients can branch. |
| Monitoring noise due to health endpoint move | Alert gaps | Update infrastructure manifests to hit the new `/live`/`/ready` once, keeping Encore `/health` accessible internally. |

## 9. Next Actions
1. Approve this plan.
2. Spin up spec workstream (see `@.agent-os/specs` guidelines) specifically for “API versioning rollout”.
3. Execute Step 1–7 with tracked tickets, ensuring changelog + partner communication accompanies each release.

