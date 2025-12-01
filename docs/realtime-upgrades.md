### Realtime Upgrades: Architecture, Changes, and How to Use

This document summarizes the realtime hardening work completed across frontend and backend, plus how to observe, configure, and extend it.


## Goals

- Instant, reliable UI updates across all services and roles
- Lower server and client load at scale
- Operational safety (kill switches, quarantine) and observability


## What Changed (High‑Level)

- Transport is always on in production with an emergency kill switch
- Dynamic, in‑place subscription updates (no reconnects on navigation or filter changes)
- Service‑scoped deduplication (no cross‑service eventId collisions) with seq fallback
- Adaptive batching per org‑service (30–150 ms)
- Slow‑consumer quarantine (sheds non‑critical services, recovers automatically)
- Property‑scoped subscriptions; standardized helper
- Shared page hook for listener attach/detach
- Auth pre‑refresh + single‑flight connect
- Per‑service client health/latency and improved telemetry


## Backend Changes

### 1) Adaptive batching
- File: `backend/realtime/unified_stream.ts`
- Per `(orgId, service)` batch window tunes between 30–150 ms:
  - Widens when batch size approaches max → fewer messages under spikes
  - Narrows when quiet → lower latency when idle
- Metric: `currentBatchWindowMsByService` attached to existing metrics.

### 2) Slow‑consumer quarantine
- File: `backend/realtime/connection_pool.ts`
- If a connection repeatedly exceeds queue capacity, it enters 30s quarantine:
  - Drops low‑tier services (analytics, dashboard) for that connection only
  - Automatically clears early when healthy

### 3) Dynamic subscription update
- File: `backend/realtime/unified_stream.ts`
- Endpoint: `POST /v2/realtime/update-services` (auth required)
- Updates the caller’s active WS connections to a new service set and optional `propertyId` without tearing down sockets.
- Connection pool method: `updateUserConnections(orgId, userId, services, propertyFilter)`


## Frontend Changes

### 1) Provider hardening
- File: `frontend/providers/RealtimeProviderV2_Fixed.tsx`
- Force‑on in production with `REALTIME_EMERGENCY_DISABLE` kill switch
- Visibility resume; race‑free connect; dedup: `service:entityType:eventId` or `service:seq:<n>`
- Property filter support and exposure via custom event
- Pre‑expiry auth refresh (best‑effort) and single‑flight connect guard
- Dynamic subscription updates on:
  - Route change → compute services → `POST /v2/realtime/update-services`
  - Property filter change → include `propertyId` in the same call
- Per‑service health exported via `window.__realtimeState()`:
  - `byServiceP95LatencyMs`, `byServiceLastEventAt`, `byServiceDelivered`, `byServiceSuppressed`, `byServiceReconnects`

### 2) Shared listener hook
- File: `frontend/hooks/useRealtimeService.ts`
- Standardizes attach/detach for `${service}-stream-events`
- Prevents duplicate listeners and memory leaks

### 3) Property filter helper
- File: `frontend/lib/realtime-helpers.ts`
- Usage: `setRealtimePropertyFilter(propertyId|null)`
- Ensures consistent dispatch; the provider updates the backend subscription in place

### 4) Page migrations (so far)
- Tasks: migrated to `useRealtimeService`; sets property filter to `null` on mount
- Users: migrated to `useRealtimeService`; sets property filter to `null`
- Staff: migrated to `useRealtimeService` (debounced invalidations preserved); sets property filter to `null`
- Properties: migrated to `useRealtimeService`; sets property filter to `null`
- Dashboard: migrated to `useRealtimeService`; sets property filter to `null`
- Finance & Dashboard: use `setRealtimePropertyFilter(...)` for property‑scoped subscriptions

Pending (optional): migrate `ReportsPage` and `GuestCheckInPage` to `useRealtimeService` using the same pattern.


## How to Observe

### Client
- Open DevTools console:
  - `window.__realtimeState()` → returns connection state and per‑service metrics:
    - `byServiceP95LatencyMs`, `byServiceLastEventAt`, `byServiceDelivered`, `byServiceSuppressed`, `byServiceReconnects`
  - Expect no reconnects on route changes or property filter changes (only a `POST /v2/realtime/update-services`).

### Server
- Unified stream logs show batch sizes and deliveries
- Connection pool logs show backpressure and any quarantine entries/exists


## Feature Flags and Safety

- `REALTIME_EMERGENCY_DISABLE` (client): kill switch to disable transport
- (Optional future) `REALTIME_DISABLE_{SERVICE}`: per‑service kill switches


## Endpoints

- Stream: `GET /v2/realtime/stream` (unchanged protocol v1)
- Update subscriptions (new): `POST /v2/realtime/update-services`
- Telemetry ingest (existing): `POST /telemetry/client`


## Expected Impact

- Faster, more consistent “instant UI”:
  - Streams stay hot on navigation/filter changes (no reconnect churn)
  - Less event noise via property scoping
  - Client work per event reduced → handlers run sooner
- Better resilience under load:
  - Adaptive batching absorbs spikes
  - Quarantine isolates slow consumers without impacting the org


## Migration Guide (for any remaining pages)

1) Replace manual listeners with the shared hook:
```tsx
import { useRealtimeService } from '../hooks/useRealtimeService';

useRealtimeService('serviceName', (events) => {
  // Patch caches or invalidate queries
}, true);
```

2) Ensure property filter is set on mount where applicable:
```tsx
import { setRealtimePropertyFilter } from '../lib/realtime-helpers';

useEffect(() => {
  setRealtimePropertyFilter(propertyIdOrNull);
}, [propertyIdOrNull]);
```

3) Keep existing cache patching/invalidation logic; only the wire‑up changes.


## Next (Optional Enhancements)

- Prioritized broadcast: finance/reports > users/tasks > properties > analytics/dashboard; prune duplicates for low tiers when under pressure
- Replay buffer right‑sizing and priority eviction by org load
- Expanded server metrics: quarantine counts, per‑tier drops
- E2E (Playwright): cross‑browser sync SLA, visibility reconnect, replay on forced disconnect
- Chaos harness: 10–50k simulated clients, packet loss, CPU throttle


## Troubleshooting

- No events on a page
  - Check `window.__realtimeState()` for connection status and services set
  - Verify the page calls `setRealtimePropertyFilter(...)` (if property scoped)
  - Ensure the page registers via `useRealtimeService('service', ...)`

- Frequent reconnects
  - Route changes should not reconnect; look for failed `POST /v2/realtime/update-services`
  - Inspect network tab for 401/403 on the update call (check token freshness)

- Stale metrics
  - `byServiceLastEventAt` indicates when each service last delivered events client‑side


