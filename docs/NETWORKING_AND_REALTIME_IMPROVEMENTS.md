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


