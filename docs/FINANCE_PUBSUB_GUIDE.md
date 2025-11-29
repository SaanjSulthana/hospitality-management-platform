# Finance Pub/Sub & Realtime Guide (V1)

This guide outlines the realtime architecture for Finance (expenses/revenues), mirroring the Guest Check-In blueprint with finance‑specific payloads and UI behavior.

---

## Topics & Payloads

- `finance-events` (at-least-once)
  - `FinanceEventPayload` includes: `eventId`, `eventVersion`, `eventType`, `orgId`, `propertyId`, `userId`, `timestamp`, `entityId`, `entityType`, and `metadata` with `amountCents`, `paymentMode`, `category/source`, `transactionDate`, `affectedReportDates`, and status deltas.

- `realtime-updates` (optional cross-domain signals)

---

## Realtime Delivery

- Per‑org in‑memory buffers (bounded: 200 items, 25s TTL) in `backend/finance/realtime_buffer.ts`.
- Fanout subscriber `finance_realtime_subscriber.ts` pushes `finance-events` into buffers.
- Long‑poll endpoint `GET /finance/realtime/subscribe` drains buffers; returns `{ events[], lastEventId }`.
- Metrics: `/finance/events/metrics` includes DB event counts (24h) and realtime buffer stats (buffer sizes, published/delivered by type, drops).

---

## Frontend

- `useFinanceRealtimeV2` hook long‑polls the subscribe endpoint with backoff and visibility pause; emits:
  - `finance-stream-events` custom DOM event with `events` array
  - `finance-stream-health` for “Live • last event Xs ago” badge

- `FinancePage.tsx`:
  - List queries remain, but mutations and stream events drive row‑level updates (no broad invalidations).
  - Summary cards use incremental totals updated on event approvals/deletions, with periodic reconciliation from query data.
  - Manual refresh for approval banner removed; stream updates trigger targeted invalidations only for approval checks.

---

## Publisher Guidance

All write paths must publish enriched events after successful DB commit:

- Create/Update/Delete/Approve for `expenses` and `revenues`
- Include `affectedReportDates` and `transactionDate` (IST) for reports/cache invalidation
- Status transitions: `previousStatus`, `newStatus`, approval metadata (`approvedBy`, `approvedAt`, `notes`)
- Payment metadata: `paymentMode`, `amountCents`, `category/source`

Idempotency: include `eventId` (UUID) and stable payload; Encore ensures at-least-once delivery.

---

## Observability

- Logs:
  - Buffer enqueue/dequeue/drops
  - Subscriber processing time and errors
- Metrics:
  - `/finance/events/metrics` includes buffer sizes, published/delivered by type, total drops, and DB event histogram.

---

## Failure & Degradation

- Hook auto‑reconnects with exponential backoff (≤ 5s).
- When hidden tab, subscription pauses and resumes when visible.
- If feed is unhealthy, the UI shows “Reconnecting”; list queries still refresh on focus and on narrow invalidations.

---

## Checklist

- [x] Topics defined (`finance-events`)
- [x] Fanout subscriber to in‑memory buffers
- [x] Long‑poll subscribe endpoint
- [x] Frontend hook + health badge
- [x] Row‑level cache updates for mutations
- [x] Incremental aggregates on stream events
- [x] Metrics endpoint augmented with realtime stats

Future:
- [ ] Optional SSE/WebSocket transport behind the same hook interface
- [ ] Explicit upload lifecycle events if needed (receipt processing)


