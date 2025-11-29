# Finance Realtime & Scaling Playbook

This document captures what we implemented to achieve instant UI with low server load for 1M organizations, and how to reuse these patterns across other pages/services.

## What we implemented

### Frontend

1) Stable realtime long‑poll with leader/follower
   - A single leader tab per login session (per access token) holds the long‑poll.
   - Followers receive events via BroadcastChannel and do not long‑poll.
   - Heartbeat every 10s; takeover after ~18s (± jitter).
   - Fallback: if BroadcastChannel is unavailable, we fall back to current behavior (each tab long‑polls).
   - Code: `frontend/hooks/useFinanceRealtimeV2.ts`

2) Debounced derived invalidations (≤1/sec)
   - Row-level updates remain instant; aggregate/approval queries (profit-loss, daily-approval, today-pending) are invalidated at most once per second during bursts.
   - Flag to tune debounce: `FIN_DERIVED_DEBOUNCE_MS` (default 1000).
   - Code: `frontend/pages/FinancePage.tsx` (debounce wrapper + scheduleDerivedInvalidations).

3) Dynamic query policy
   - `refetchOnWindowFocus: true` for resiliency.
   - Conditional `refetchInterval` (12–18s, jittered) only when realtime is offline.
   - `profit-loss` uses `staleTime=25s` when live (10s offline).

4) Optimistic update hardening (no duplicates)
   - On “_added” events, replace matching optimistic rows or skip if the real ID exists.
   - On mutation success, skip re‑insert if realtime already delivered the real row.

5) Feature flags
   - `FIN_LEADER_ENABLED` (default: true) – toggle leader/follower behavior.
   - `FIN_DERIVED_DEBOUNCE_MS` (default: 1000) – coalescing window (ms) for derived invalidations.
   - Helpers: `frontend/lib/feature-flags.ts`.

### Backend

6) Realtime buffer safeguards
   - Per‑org in‑memory buffers with TTL and bounded queue.
   - Idle eviction of org buffers after 2 minutes of inactivity.
   - Waiter cap per org (default: 5000) with safe resolution if exceeded.
   - Code: `backend/finance/realtime_buffer.ts`.

7) Reliable event fanout
   - Subscribers are loaded for side‑effects in `encore.service.ts`.
   - Property filter respected throughout long‑poll and buffer retrieval.

## Why this scales (1M orgs × 5 properties × 5 users)

- Leader/follower removes redundant long‑polls across tabs: 1 active stream per login session instead of N.
- Debounce limits aggregate refetches to ≤1/sec during spikes.
- Heavy queries refresh less often when live (staleTime=25s) but still feel fresh due to event‑driven row‑level updates.
- Backend buffer eviction and waiter caps protect memory/FDs under high churn.

## Instant UI mechanics (copy for other pages)

1) Process realtime events into row‑level cache patches (insert/update/remove).
2) Only invalidate derived aggregates (e.g., KPIs) – and do so in a debounced batch.
3) Keep lists/tables instant; let totals/cards catch up within ≤1s.

## Query policy template

Use this template when wiring any list/aggregate pair:

```ts
useQuery({
  queryKey: ['list', filters],
  queryFn: fetchList,
  refetchInterval: isLive ? false : jitter(12000, 18000),
  refetchOnWindowFocus: true,
  staleTime: 5000,
  gcTime: 300000,
});

useQuery({
  queryKey: ['aggregate', filters],
  queryFn: fetchAggregate,
  refetchInterval: false,
  refetchOnWindowFocus: true,
  staleTime: isLive ? 25000 : 10000,
  gcTime: 300000,
});
```

Where `isLive` comes from the realtime hook, and `jitter(a,b)` randomizes interval to avoid herd effects.

## Realtime pattern for other services

- Adopt the same hook pattern:
  - One leader long‑poll (all relevant scope) → broadcast via BroadcastChannel.
  - Followers listen and patch row‑level caches.
  - Debounce derived invalidations (≤1/sec).
- Keep a single “window event” shape so all pages can reuse the same event dispatcher.

## Feature flags & knobs (client‑side)

- `FIN_LEADER_ENABLED` (boolean) – enable/disable leader/follower.
- `FIN_DERIVED_DEBOUNCE_MS` (number) – debounce for derived invalidation (ms).
- Defaults chosen for scale and UX: `true` / `1000` respectively.

## Operational guidance (Encore Cloud)

1) Build & deploy
   - Ensure app builds cleanly (no rapid cancel loops in Network).
   - Deploy via Encore Cloud pipeline as usual.

2) Post‑deploy watch
   - Check that each user/session maintains ~1 long‑poll (25s cadence).
   - Aggregates should refetch ≤1/sec during activity; lists patch instantly.

3) Rollback/toggles
   - If needed, locally set `FIN_LEADER_ENABLED=false` (or ship a config default) to revert to per‑tab long‑poll behavior.

## What’s left / optional backlog

1) Fallback mailbox for older browsers
   - Use localStorage “event bus” when BroadcastChannel is unavailable.
   - Add size & rate guardrails (e.g., 64KB per message, 100 messages per minute cap).  

2) Client telemetry (sampled)
   - Emit counters for `leader_acquired`, `leader_lost`, `follower_suppressed_polls`, `derived_debounce_fired`.
   - Sample at ~2% to quantify saved QPS under real traffic.

3) One‑tab‑per‑org leadership (optional)
   - Current scope is per access token (safest). If you expose `orgId` to the frontend and want more consolidation, change the lease/channel keys to include `orgId` (requires careful auth handling).

4) Metadata‑aware report refresh
   - Only refresh open report ranges that intersect `affectedReportDates`. Complexity is higher; current approach (focus + debounce) is sufficient for most cases.

## QA checklist (repeatable)

- Multi‑tab (2–6): one leader only; followers suppressed; events apply everywhere.  
- Burst writes: tables instant; aggregates lag ≤1s; no duplicate rows.  
- Realtime outage: degraded polling kicks in (12–18s jitter); focus refetches.  
- BroadcastChannel disabled: safe fallback; still functional.  

## File index

- `frontend/hooks/useFinanceRealtimeV2.ts` – leader/follower long‑poll, BroadcastChannel fanout, stabilized loop.
- `frontend/pages/FinancePage.tsx` – debounced derived invalidations, instant row‑level patches, dynamic query policies.
- `frontend/lib/feature-flags.ts` – client feature flags.
- `backend/finance/realtime_buffer.ts` – per‑org buffers, idle eviction, waiter cap, metrics scaffolding.

---

Adopt these patterns in other pages/services to keep the UI instant while keeping server load predictable at 1M‑org scale. 


