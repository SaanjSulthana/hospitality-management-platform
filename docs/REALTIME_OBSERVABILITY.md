# Realtime Observability

## Server Metrics
GET `/v2/realtime/metrics` returns:

- activeConnections, totalConnections
- eventsDelivered, eventsByService{service→count}
- errorCount, missedEventsReplayed
- connectionPoolStats:
  - totalConnections, totalOrgs, totalSubscriptions
  - sentTotal, droppedTotal, quarantinedActive
  - connectionsByOrg[]
- conflation:
  - input, output, ratio, bytesBefore, bytesAfter, bytesSaved
  - currentBatchWindowMsByService{service→ms}

## Client Metrics
In console:

- `window.__realtimeState()`:
  - connected, lastSeq, lastEventAt, services, subscribedPropertyId
  - byServiceDelivered, byServiceSuppressed
- `window.__realtimeMetrics()`:
  - avgLatencyMs, p95LatencyMs, connectionUptimeSeconds, eventRate

## Dashboards (suggested KPIs)
- By service: p95 latency, delivered/sec, suppressed/sec, lastEventAt
- Conflation: ratio, bytesSaved (over time)
- Backpressure: droppedTotal, quarantinedActive
- Batch window per service (adaptive)

## Alerting (suggestions)
- High droppedTotal growth rate
- p95 latency > SLO for N minutes
- Zero delivered events for critical service for N minutes


