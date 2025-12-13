# Networking Phase 2 Lite – Helper Refactor Only

## Scope
- Replace immediate, multi-key invalidations in Finance helpers with the existing debounced scheduler.
- Keep patch-first behavior; preserve non-patch-mode list invalidations only for `expenses`/`revenues`.
- Do NOT introduce global window flags, broadcasts, or cross-route coupling.

## Changes (implemented)

1) Finance helpers now use the scheduler
- `frontend/pages/FinancePage.tsx`
  - `invalidateAllExpenseQueries()`:
    - Keep: invalidate `['expenses']` when `REALTIME_PATCH_MODE` is false
    - Replace fan-out invalidations with:
      ```ts
      scheduleDerivedInvalidations({ profitLoss: true, approvals: true, todayPending: true });
      ```
  - `invalidateAllRevenueQueries()`:
    - Keep: invalidate `['revenues']` and `['expenses']` when `REALTIME_PATCH_MODE` is false (legacy fallback)
    - Replace fan-out invalidations with:
      ```ts
      scheduleDerivedInvalidations({ profitLoss: true, approvals: true, todayPending: true });
      ```

2) Removed from helpers
- `analytics`, `dashboard`, `daily-report` invalidations are no longer triggered from helpers.
  - Rationale: realtime + page-local logic already manage these; removing avoids redundant refetches.

## What remains unchanged
- The scheduler (debounced coalescer) in `FinancePage.tsx` continues to:
  - Collect flags in `derivedPendingRef`
  - Debounce by `FIN_DERIVED_DEBOUNCE_MS` (default 1000ms)
  - Invalidate derived keys:
    - `['profit-loss']`
    - `['daily-approval-check']`
    - `['today-pending-transactions']`

## Test Checklist

1) Add revenue/expense (Manager)
- Expect requests:
  - 1x POST (add)
  - ≤2 derived refetches after ~1s (profit-loss, daily-approval-check)
  - today-pending may refetch depending on current UI panels
- No list refetch storms; rows update instantly via patch-first.

2) Approve revenue/expense (Admin)
- Expect requests:
  - 1x POST (approve)
  - ≤2 derived refetches after ~1s (profit-loss, daily-approval-check)

3) Cross-route sanity checks
- Navigate between Dashboard/Finance/Reports
- Verify no analytics/dashboard/daily-report invalidations originate from Finance helpers
- Dashboard invalidations remain guarded by `routeActive` and do not fire when not visible

4) Telemetry (prod)
- Ensure no `/telemetry/client` requests in production (gated by `envUtils.isProduction()`).

## Rollback Plan

If any regression appears in aggregates/approvals:
1) Temporarily re-enable direct invalidations for the affected key inside the corresponding helper (one key at a time).
2) Re-test to confirm the functional gap.
3) Prefer addressing the root cause in the scheduler route (e.g., ensure correct flags are scheduled) rather than re-introducing broad invalidations.

## Notes
- Minimal change, low risk, easy to reason about.
- Keeps the benefits of debounced coalescing without adding new patterns or global coordination.



