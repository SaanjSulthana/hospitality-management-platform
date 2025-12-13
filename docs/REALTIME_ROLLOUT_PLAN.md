# Realtime V2 Rollout Plan (Conflation, Invalidate, Credits)

## Flags
- Server:
  - `REALTIME_CONFLATION` (default: on)
  - `REALTIME_COMPRESS_BATCHES` (default: off)
  - `REALTIME_CREDITS_ENABLED` (default: off)
- Client (localStorage):
  - `REALTIME_INVALIDATE` (default: off)
  - `REALTIME_CREDITS` (default: off)
  - `REALTIME_ROLLOUT_PERCENT` (default: 100)

## Phases
1) Canary orgs (1–3 orgs)
   - Enable `REALTIME_CONFLATION=true`
   - Leave credits and compress OFF
   - Client: keep `REALTIME_INVALIDATE` off initially
2) Partial rollout (10–20% orgs)
   - Monitor metrics; enable client `REALTIME_INVALIDATE=true` for canaries
3) Broad rollout (50–100% orgs)
   - Keep credits OFF unless backpressure persists
4) Credits pilot (optional)
   - Server: `REALTIME_CREDITS_ENABLED=true` for canaries
   - Client: `REALTIME_CREDITS=true` in canaries only

## Success Criteria
- p95 latency stable or improved vs baseline
- Conflation ratio ≤ 0.7 (≥30% reduction), bytesSaved grows under bursts
- No increase in reconnects, errors, or quarantine events
- Dashboard/Finance tiles remain “instant” (<350 ms perceived update)

## Rollback
- Server: set `REALTIME_CONFLATION=false`, `REALTIME_CREDITS_ENABLED=false`
- Client: remove `REALTIME_INVALIDATE`, `REALTIME_CREDITS`


