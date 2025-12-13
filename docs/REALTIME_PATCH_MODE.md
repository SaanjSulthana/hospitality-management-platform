# Realtime Patch Mode

Goal: Instant UI with minimal server load by treating list queries as live sources updated via WebSocket events. Queries refetch on mount only, not after every invalidation.

## Query Category

Use the `realtime-connected` category:

```
staleTime: Infinity
gcTime: 10 minutes
refetchOnWindowFocus: false
refetchOnMount: true
refetchInterval: false
```

Apply it to list queries that are patched by realtime handlers (e.g., `revenues`, `expenses`, `tasks`). Gate with `REALTIME_PATCH_MODE=true`.

## Handler Rules

- For entity updates (add/update/delete): patch lists via `queryClient.setQueryData`.
- Do not invalidate the same list you just patched.
- Invalidate aggregates only when truly impacted (e.g., `profit-loss` when amounts/status change; `pending-approvals` only on approval events).
- Keep invalidation coalescing at ~350ms to avoid refetch bursts.

## Telemetry

Client counters (dev-only):

- `window.__realtimeClientStats.patchesApplied`
- `window.__realtimeClientStats.invalidationsFlushed`

## Rollout

1. Enable `REALTIME_PATCH_MODE=true` for canary orgs.
2. Verify network refetches drop while UI remains instant.
3. Expand to all users.


