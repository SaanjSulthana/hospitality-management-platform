Title: Reports Realtime Test Plan
Owners: Frontend Platform + QA
Last Updated: 2025-11-27

Goal
- Verify Reports updates in ~1–2s after finance changes without 30s polling, with minimal server load.

Prereqs
- Provider-only realtime enabled (default).
- REPORTS_REALTIME_V1 = true (default; override with localStorage if needed).

Smoke Tests (Manual)
1) Daily Report Manager
- Open Reports → Daily Report Manager for property P, date D.
- In Finance, add revenue for P on D.
- Expect: Daily report refreshes within 2s (no 30s polls).

2) Monthly Spreadsheet
- Open Monthly Spreadsheet for P, year Y, month M.
- In Finance, delete an expense on any day in M for P.
- Expect: Monthly totals update within 2s.

3) Quarterly and Yearly
- Open Quarterly & Yearly tab (quarter Q, year Y) for P/all.
- Approve a pending revenue in Finance (date within Q/Y).
- Expect: Quarterly and Yearly cards refresh within 2s.

Load/Batching
- Perform 10 quick transactions (mix add/delete/approve) across 3 days.
- Expect: Only 1–3 debounced refetches per scope; no hot loops.

Navigation
- Switch between Reports tabs during updates.
- Expect: No errors; latest data visible; no 30s background polls.

Network Verification
- DevTools → Network:
  - One long-poll subscribe from RealtimeProvider.tsx (no per-page transport).
  - No periodic "refetch every 30s" requests.
  - When events happen, only targeted GETs for daily/monthly/quarterly/yearly.

Telemetry (Optional)
- Check backend /telemetry/client logs for:
  - reports_realtime_invalidation (counts by scope)
  - reports_refetch_ms (duration per scope)

Regression Checks
- Toggle REPORTS_REALTIME_V1=false → expect 30s polling to be absent (design choice), but manual refresh still works.
- Toggle back to true → event-driven updates resume.

Pass Criteria
- 95% updates under 2s from mutation commit to rendered data.
- No periodic 30s polling present.
- No console errors; no memory growth after 30 minutes of activity.


