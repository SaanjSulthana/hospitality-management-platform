# Networking Phase 1 – Request Minimization and Load Reduction

## Goals
- Reduce per-action requests for Finance add/approve flows to ~2–3.
- Eliminate duplicate/unsampled telemetry in production.
- Avoid unnecessary invalidations when routes are not active.
- Preserve instant UI via patch-first updates.

## Changes Implemented

1) Telemetry gating (prod-off)
- All telemetry POSTs to `/telemetry/client` are now gated behind `envUtils.isProduction()`.
- Files updated (representative):
  - `frontend/pages/FinancePage.tsx` – sendTelemetry now no-ops in prod.
  - `frontend/providers/RealtimeProviderV2_Fixed.tsx` – sendTelemetry now no-ops in prod.
  - `frontend/providers/RealtimeProvider.tsx` – sendClientTelemetry now no-ops in prod.
  - `frontend/services/backend.ts` – sampled telemetry now no-ops in prod.
  - Removed duplicate telemetry from `DashboardPage` derived debounce.

2) Approval Manager invalidations trimmed
- `frontend/components/ui/daily-approval-manager.tsx`:
  - Removed `expenses`, `revenues`, `profit-loss` invalidations.
  - Kept only `today-pending-transactions` and `daily-approval-check`.
  - Rationale: patch-first updates + WS patches already keep lists consistent.

3) Dashboard invalidations guarded by visibility
- `frontend/pages/DashboardPage.tsx`:
  - Before invalidating `PROFIT_LOSS` and `DAILY_APPROVAL_CHECK`, we now check `routeActive`. If dashboard isn’t visible, skip.
  - Rationale: avoids staling keys when route is not active (no refetches later).

## Expected Impact
- Add transaction (manager):
  - 1x POST (add)
  - 1x profit-loss (debounced ~1s by FinancePage)
  - 1x daily-approval-check (debounced ~1s)
  - Optional: `today-pending-transactions` only when the panel is open
- Approve/reject (admin):
  - 1x POST (approve)
  - Same aggregate behavior as above
- No telemetry POSTs in production; no duplicate telemetry in dev.

## Flags and Runtime Behavior
- REALTIME_PATCH_MODE=true remains default.
- Realtime health badge remains disabled in prod by default.
- Finance realtime health card remains visibility-gated (60s) for dev/admin.

## Verification Checklist
- DevTools → Network:
  - On add/approve: ≤3 requests (mutation + 1–2 aggregates).
  - No `/telemetry/client` in production.
  - No dashboard invalidations when not on dashboard route.
- Finance lists do not refetch; rows update instantly via patch-first.

## Follow-Up (Phase 2 – Optional)
- Route the Finance helper invalidations through the same derived debounce (no immediate fan-out).
- Keep telemetry in one place (Provider) and dev-only, remove from remaining pages if desired.

## Notes
- All changes are conservative, backward compatible, and avoid architectural churn.


