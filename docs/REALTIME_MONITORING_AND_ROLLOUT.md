# Realtime Monitoring, Alerts, Rollout and Rollback

This document defines Week 2 monitoring, alert thresholds, shadow/dogfood rollout, and rollback strategy for RealtimeProvider V2.

## Feature Flags

- REALTIME_PROVIDER_V2: master switch (default OFF)
- REALTIME_DISABLED_ORGS: CSV of org IDs for per‑org killswitch
- REALTIME_ROLLOUT_PERCENT: 0–100 staged rollout
- REALTIME_SHADOW_MODE: if true, transport runs but events are not dispatched to the app

## SLIs and Sampling

Collected at ~2% sampling via POST /telemetry/client with `type: 'realtime_sli'`:

- eventDeliveryLatencyMs (future extension)
- takeoverTimeMs (future extension)
- leaderElectionsPerHour (future extension)
- mutationToVisibleMs (future extension)
- circuitOpenPercent (derived)
- optimisticTimeoutRate (future extension)
- health snapshot (isLeader, circuitOpen, lastSuccessAt)

Targets:
- Delivery p50 < 500ms; p99 < 2s; p99.9 < 5s
- Takeover p95 < 500ms; p99 < 2s
- Leader churn < 1 election/hour/tab
- Mutation→visible p95 < 1s
- Circuit open < 0.1%

## Alert Thresholds

- Critical (page immediately):
  - Circuit open > 5 minutes
  - Leader churn > 10/hour
  - Event delivery p99 > 5s for > 10 minutes
  - Subscribe endpoint p99 > 30s
- Warning (next business day):
  - Event delivery p99 > 3s for > 1 hour
  - Leader churn > 3/hour
  - Optimistic timeouts > 1%
  - Dropped events > 10 in 5 minutes
- Info (dashboard only):
  - Circuit opened/recovered
  - Leader takeover events
  - Fast empty responses

## Rollout Plan

1. Shadow Mode (1 week): run transport, do not dispatch events; compare SLIs vs baseline.
2. Dogfood (1 week): enable V2 for internal orgs; validate navigation and takeover.
3. Staged Rollout (1 week): 5% → 25% → 100%, monitoring SLIs continuously.

## Rollback Strategy

Immediate (< 5 minutes):
1. Set REALTIME_PROVIDER_V2=false for affected org(s).
2. Shadow mode OFF; transport stops; original page listeners remain functional.
3. Verify metrics return to baseline.

Mitigations without rollback:
- Increase TAKEOVER_MS to 10000 if takeover too fast/flappy.
- Increase CIRCUIT failure threshold to 5.

Post‑incident:
- Export telemetry for the incident window.
- Reproduce via chaos tests.
- Add a regression test.

## Testing

Chaos:
- Kill leader tab randomly
- Inject 10s network delay
- Corrupt localStorage
- Clock skew ±5 minutes
- Toggle visibility rapidly

Load:
- 1000 tabs across 100 orgs
- Monitor RPS, p99 subscribe latency, waiter depth, dropped

Consistency:
- Two tabs with different filters; 10 mutations/sec; both converge within 2s

Failure modes:
- Backend restart mid‑poll
- Token expiry mid‑poll
- Org deletion or permission changes


