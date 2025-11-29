# Audit Logs Real-Time Reference

## Problem
- Audit trail UI required manual refresh to show new entries.
- Excessive polling strained the database.
- Filters triggered noisy loaders and reset the view.

## Backend Fix
- `subscribe-audit-events-v2.ts` buffers events per org using normalized number keys.
- `bufferAuditEvent` converts `orgId` and `timestamp` before storing.
- Long-poll connections reuse the buffer; timeouts return empty responses.
- Middleware (`audit-middleware.ts`) now writes the log and immediately buffers the event for instant delivery.

## Frontend Fix
- `useAuditLogs` exposes `fetchLogs(filters, { silent })` to refresh without loading spinners.
- `GuestCheckInPage` keeps stable refs for filters and fetch function.
- Tab activation:
  - First open fetches normally.
  - Returning triggers a silent refresh.
- Real-time hook (`useAuditLogsRealtimeV2`) calls `fetchLogs(..., { silent: true })`, so new rows appear instantly.
- Debounced filter changes reuse the stable fetch function to prevent extra connections.

## Testing Checklist
1. Open Audit Logs tab with devtools console open.
2. Perform an action (view/upload document, create check-in). Expect “Event buffered” server log and card updates without pressing refresh.
3. Switch tabs, perform another action, return to Audit Logs. List auto-refreshes silently.
4. Apply filters. List updates without tab reload; real-time updates continue.

## Commands
```
# restart backend (if needed)
encore run

# run automated real-time smoke test
./test-audit-realtime.sh
```

Keep this file updated if the Pub/Sub pipeline or frontend hook changes.*** End Patch

