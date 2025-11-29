Title: Finance Realtime Provider and Pub/Sub Pattern (Instant UI, Low Server Load)
Owner: Frontend Platform + Finance
Status: Adopted in Finance (Provider-only), ready to replicate to all services
Last Updated: 2025-11-27

1) Scope
- Document the production pattern we implemented for realtime updates with instant UI and minimal server load.
- This memo covers the client transport (RealtimeProvider), event contracts, backend subscribe endpoint, cache patching, rollout, monitoring, and how to replicate across services (Tasks, Staff, Properties, Users, Reports, Guest Check‑in).

2) Problem
- Prior approach had per-page long-polls (e.g., Finance hook) which duplicated connections and reconnected on every navigation. This increased RPS and caused gaps during route changes.
- The UI needed instant updates with optimistic feedback, but without excessive refetches or hot loops.

3) Solution Overview
- Single app-level RealtimeProvider (transport-only) mounted in the global layout. One long‑poll per browser/org, shared across all tabs via leader election.
- Provider fetches events via long‑poll, deduplicates and orders them, and broadcasts standardized window events.
- Feature flags power safe rollout: master enable, shadow mode, percentage rollout, per‑org kill switch.
- Pages listen to broadcasted events and patch their caches optimally (row-level updates + narrowly scoped invalidations), not their own transports.

4) Client Architecture (Finance, adopted)
- File: frontend/providers/RealtimeProvider.tsx
- Core features:
  - Single long‑poll transport per browser/org with cross‑tab leader election (localStorage + BroadcastChannel). Passive takeover ~3s.
  - Event deduplication (LRU per org, 1000 ids, 5 min TTL; keep last 3 orgs).
  - Deterministic ordering: sequenceNumber → timestamp → eventId.
  - Circuit breaker: 3 consecutive failures → open 30s; half-open retry.
  - Periodic reconciliation for aggregates only (~60s, debounced).
  - Auth handling: pause on 401/403, resume after refresh.
  - Offline/hidden recovery: >60s disconnect or >5m hidden → full refresh (hardRecover).
  - Health broadcast: window event 'finance-stream-health' with isLive/lastSuccess.
  - Event broadcast: window event 'finance-stream-events' with { events }.
  - Shadow mode: transport runs, but dispatches 'finance-shadow-events' only (no UI updates).
- Finance UI integration:
  - FinancePage adds a single listener for 'finance-stream-events' and performs row-level cache patching, then debounced derived invalidations (profit-loss, approvals, today-pending).
  - Page-level degraded polling disabled; relies on provider.
  - Legacy page transport (useFinanceRealtimeV2) was removed.

5) Backend Architecture (Finance)
- Endpoint: GET /v1/finance/realtime/subscribe?lastEventId=...
  - Long‑poll timeout ~25s. Returns { events: [], lastEventId } when no new events.
  - Includes sequenceNumber and timestamp for each event.
  - In-memory buffer per org with TTL + waiter notification.
- Pub/Sub fanout (services):
  - Finance writes domain events (e.g., revenue_added, expense_deleted).
  - Subscribers: finance-realtime-subscriber (buffer), cache invalidation, reports projection, balance projection, etc.

6) Event Contract (Finance)
- Required fields: eventId (uuid), sequenceNumber (int, per org), timestamp (ISO), orgId, propertyId?, userId?, entityType ('revenue' | 'expense' | …), eventType ('revenue_deleted' | 'expense_approved' | …), metadata (shape depends on type; must include core fields needed for row patching).
- Ordering: client sorts by sequenceNumber, then timestamp, then eventId to ensure deterministic application.
- lastEventId: server may return lastEventId to allow client resume; client will also advance using the last event if provided.

7) Browser Events (Finance)
- finance-stream-events: { events: Event[] }
- finance-stream-health: { isLive: boolean, lastSuccessAt?: Date, failures: number }
- finance-shadow-events: { events: Event[] } (diagnostics only)
- realtime-auth-error, realtime-circuit-open, realtime-hard-reset: operational signals (optional listeners).

8) Feature Flags & Local Overrides
- REALTIME_PROVIDER_V2: boolean (Master). Default: true (FINANCE).
- REALTIME_SHADOW_MODE: boolean. Default: false (FINANCE).
- REALTIME_ROLLOUT_PERCENT: 0|5|25|100. Default: 100 (FINANCE).
- REALTIME_DISABLED_ORGS: CSV of orgIds to kill.
- FIN_LEADER_ENABLED: boolean (default true).
- Notes: Devs/testers can override via localStorage; defaults ensure provider-only single poll.

9) Performance & Load Characteristics
- One long‑poll per browser/org across all tabs → lowest steady RPS.
- After mutations, a small set of targeted refetches for aggregates (e.g., profit-loss, today-pending) is expected; lists are patched in place from events.
- Budgets: <3ms per event application on client; 200-event batch chunking if needed; provider memory <5MB; LRU stores last 3 orgs.

10) Rollout Strategy (Executed for Finance)
- Week 3: Shadow Mode monitoring (Master=false, Shadow=true, 0%). Transport runs, UI unaffected; verify stability.
- Week 4: Dogfood (Master=true, Shadow=false for our org). Validate instant UI and leader stability; then staged rollout 5% → 25% → 100%.
- Rollback:
  - Immediate: set REALTIME_PROVIDER_V2=false → reload.
  - Per‑org kill: set REALTIME_DISABLED_ORGS to comma list → reload.
  - Shadow fallback: REALTIME_SHADOW_MODE=true → reload (transport on, UI unaffected).

11) Observability and SLIs
- Client SLI telemetry (5 min sample): leader ratio, circuit open %, last success age.
- Backend logs: subscribe timeouts every ~25s, event fanout, cache invalidations; sequence counters.
- Success criteria (steady state): circuit_open_percent < 0.1%, leader churn < 5/day/tab, avg lastSuccess age < 30s.

12) UI Integration Rules (General)
- Do not implement per-page transport. Listen to '[service]-stream-events' and apply row-level cache updates using React Query’s setQueryData for relevant keys only.
- Invalidate only derived/aggregate queries with a small debounce (e.g., 500–1500 ms).
- Keep optimistic updates: insert/update optimistic rows; replace them when the echoed event arrives; timeout fallback invalidation at 5s if echo not seen.

13) How to Replicate to Other Services (Template)
- Backend:
  - Add /v1/{service}/realtime/subscribe (long‑poll, 25s), returns { events, lastEventId }.
  - Ensure event buffer per org with waiter notify; include sequenceNumber and timestamp.
  - Publish domain events for all mutating operations; carry minimal metadata required for cache patching.
  - Add projections/subscribers: cache invalidation, reporting, read models as needed.
- Frontend:
  - Extend/parameterize RealtimeProvider to fetch and broadcast per-service events (e.g., tasks-stream-events, staff-stream-events) OR keep a single finance-first channel but generalize eventName/endpoint mappings.
  - Pages consume events via window.addEventListener('[service]-stream-events', handler) and patch caches.
  - Disable page-level polling; keep only provider transport.
  - Reuse health event for badges: '[service]-stream-health' (or reuse finance health where unified transport is used).

14) Naming & Conventions
- Event types: {entity}_{action} (e.g., revenue_deleted, task_updated).
- Window events: '{service}-stream-events' and '{service}-stream-health'.
- BroadcastChannel names: '{service}-leader:{tokenHash}:{orgId}', '{service}-events:{tokenHash}:{orgId}' (if multi-service).
- Query keys: top-level key per entity list ('revenues', 'expenses', 'tasks', 'staff') + filters to allow targeted setQueryData.

15) Adoption Checklist (Per Service)
1. Backend: implement subscribe endpoint and event buffer; include sequenceNumber, server timestamp.
2. Emit domain events for all mutations with enough metadata for row patching.
3. Frontend: add page listener to '[service]-stream-events'; implement row patching + debounced aggregate invalidations.
4. Disable per-page polling; rely on provider transport.
5. Enable provider flags: Master=true, Shadow=false, Rollout% staged.
6. Monitor SLIs and logs for 48 hours before increasing rollout.
7. Add per‑org killswitch path.

16) Known Edge Cases and Handling
- Auth refresh loops: provider pauses on 401/403; resumes after success; circuit breaker prevents hot loops.
- Long offline/hidden tabs: on >60s since last success or >5m hidden, provider triggers a hardRecover (safe full invalidate).
- Split‑brain leaders: heartbeats with sequence; yield to higher sequence or stale detection after ~3s.
- Duplicate events: LRU eventId dedup; TTL 5 min.

17) Security & Privacy
- Authorization required on subscribe; org scoping enforced on the backend buffer and queries.
- Payloads contain only necessary metadata for UI patching; no PII beyond what’s already visible to authorized users.

18) Commands (for testing)
- Shadow mode ON (transport only):
  - localStorage.setItem('REALTIME_PROVIDER_V2', 'false');
  - localStorage.setItem('REALTIME_SHADOW_MODE', 'true');
  - localStorage.setItem('REALTIME_ROLLOUT_PERCENT', '0');
- Provider ON (production behavior):
  - localStorage.setItem('REALTIME_PROVIDER_V2', 'true');
  - localStorage.setItem('REALTIME_SHADOW_MODE', 'false');
  - localStorage.setItem('REALTIME_ROLLOUT_PERCENT', '100');
  - localStorage.removeItem('REALTIME_DISABLED_ORGS');

19) Current Finance Status
- Provider-only transport enabled by default (Master ON, Shadow OFF, 100% rollout).
- FinancePage legacy transport removed; listens to 'finance-stream-events' and applies row-level patches.
- Debug UI removed from layout; can be reintroduced behind a flag if needed.

20) Next Steps
- Extract service-agnostic pieces to a generic provider (Phase 2 hooks) and add service mappings.
- Replicate to Tasks, Staff, Properties, Users, Guest Check‑in and ensure Reports receives invalidations from each.

End of Memo.

Appendix A: Reports Integration (Adopted)

- Event source: reuse finance-stream-events from RealtimeProvider; no new transport.
- Debounced (1000ms) server refetch invalidations for:
  - Daily: ['daily-report', propertyId, YYYY-MM-DD]
  - Monthly: ['monthly-report', propertyId, YYYY, MM]
  - Quarterly: ['quarterly-report', YYYY, Qx, propertyId] (exact:false)
  - Yearly: ['yearly-report', YYYY, propertyId]
- Removed 30s polling in all Reports tabs; rely on event-driven invalidation.
- Flag: REPORTS_REALTIME_V1 (default true). Rollback by setting to false via localStorage for quick testing.
- Telemetry (2% sampling):
  - reports_realtime_invalidation: counts per batch (daily/monthly/quarterly/yearly)
  - reports_refetch_ms: duration between invalidation and query success per scope
- Expected outcome: ~1–2s updates after finance changes; one long-poll connection globally; fewer background requests.


