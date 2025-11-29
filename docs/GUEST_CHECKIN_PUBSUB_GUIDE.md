# Guest Check-In Pub/Sub & Realtime Guide

This document explains the end-to-end implementation for the Guest Check-In page. Use it as a template when rolling the same experience to other pages (Tasks, Properties, etc.).

---

## 1. Goals
- **Instant UI updates** across browser tabs and backend replicas without manual refresh.
- **Row-level granularity**: only the affected guest row/document viewer updates.
- **Observability**: track published vs delivered events via metrics endpoint.
- **Extensible metadata** for future UX (status badges, thumbnails, confidence).

---

## 2. High-Level Architecture

```
Guest API (create/update/delete/doc upload)
   │
   ├─> publish GuestEventPayload → Topic `guest-checkin-events`
   │       - enrich metadata (action, doc info, confidence, etc.)
   │       - increment metrics counter
   │       - buffer locally for instant delivery
   │
Encore Pub/Sub
   │
guest_checkin_events_subscriber.ts
   │
   └─> bufferGuestEvent (per-org in-memory queue, 25s retention)
           - bounded size (200) w/ back-pressure logs
           - used by long-poll endpoint

/guest-checkin/realtime/subscribe (long poll)
   │
   └─> returns new events + lastEventId → closes → reconnects

React hook `useGuestCheckinRealtimeV2`
   │
   ├─ guest events → targeted row fetch (/guest-checkin/:id) + mutate list
   └─ document events → refresh document viewer if open for same guest
```

Audit logs follow the same pattern via `audit-events` + `auditEventsBufferSubscriber`.

---

## 3. Backend Implementation

### 3.1 Topic & Payload
- File: `backend/guest-checkin/guest-checkin-events.ts`
- `GuestEventPayload` fields:
  - `eventType`: guest CRUD & doc lifecycle (`guest_created`, `guest_document_extracted`, …)
  - `metadata`: `action`, `guestName`, `documentId`, `status`, `thumbnailUrl`, `overallConfidence`, etc.
- Topic: `guest-checkin-events` (at-least-once).

### 3.2 Subscribers & Buffers
- Files: `guest_checkin_events_subscriber.ts`, `subscribe-guest-events-v2.ts`.
- Subscriber feeds in-memory per-org buffer (max 200, logs when dropping).
- Long poll endpoint (`GET /guest-checkin/realtime/subscribe`) drains buffer, logs “Guest events delivered …”, records metrics via `recordGuestEventsDelivered`.

### 3.3 Event Publishing
- Files touched: `create.ts`, `update.ts`, `checkout.ts`, `delete.ts`, `documents.ts`.
- After DB write succeeds, build `GuestEventPayload` with context + metadata.
- Call `bufferGuestEvent` (instant UI), `recordGuestEventPublished`, then `guestCheckinEvents.publish`.
- Documents: emit `guest_document_uploaded`, `guest_document_extracted`, `guest_document_extract_failed` with doc-specific metadata.

### 3.4 Metrics Endpoint
- File: `backend/guest-checkin/event-metrics.ts`.
- Counters for published vs delivered events; exposed via `GET /guest-checkin/events/metrics` (auth required, ADMIN/OWNER/MANAGER only).
- Imported/exported in `encore.service.ts` to register API.

### 3.5 Audit Logs (for reference)
- `audit_events_subscriber.ts` mirrors the pattern, feeding audit long-poll buffer for audit tab updates.

---

## 4. Frontend Implementation

### 4.1 Realtime Hook
- File: `frontend/hooks/useGuestCheckinRealtime-v2.ts`.
- Long polls `/guest-checkin/realtime/subscribe`.
- Supports metadata pass-through (`metadata` in response events).
- Handles reconnect/backoff and pauses when tab hidden.

### 4.2 Guest Check-In Page
- File: `frontend/pages/GuestCheckInPage.tsx`.
- Key additions:
  - `mapGuestApiToState` + `fetchGuestDetailsById` to reuse backend shape.
  - `refreshSelectedGuestDocuments` for targeted doc refresh.
  - `useGuestCheckinRealtimeV2` callback:
    - Document events → refresh viewer if same guest is open.
    - Guest events:
      - `guest_deleted` → remove row from `allCheckIns`.
      - Other types → fetch `/guest-checkin/:id` for each affected ID; update or prepend row without refetching list.
      - Fallback to `fetchCheckIns()` only if targeted fetch fails.

### 4.3 UX Result
- Visual refresh limited to the affected row; no spinners or list reloading.
- Document viewer updates only when needed.

---

## 5. Operational Notes

- **Buffer limits**: per-org queue capped at 200 events; logs when dropping (`Guest buffer full…`).
- **Logging**:
  - `Guest event buffered …`
  - `Guest events delivered …`
  - Document publisher logs on failure to publish.
- **Security**: metrics endpoint gated by role; realtime endpoints require auth (Encore handles JWT).
- **Performance**: DB load reduced (no polling); targeted fetches hit `/guest-checkin/:id` only for mutated guests.

---

## 6. Checklist for Applying to Other Pages

1. Define typed event payload + topic (e.g., `tasks-events.ts`).
2. Publish events after each successful mutation with rich metadata.
3. Add subscriber + per-org buffer + long-poll endpoint.
4. Add metrics recorder/exported endpoint.
5. Create a dedicated frontend hook (long-poll) + row-level update logic.
6. Update page components to use the hook, patch state in-place, and refresh detail views only when necessary.
7. Update docs/tests + sanity check logs & metrics endpoint.

Following this blueprint ensures consistent realtime behavior across the platform.  
Feel free to copy-paste this doc when kicking off the next page; adjust entity names and metadata accordingly.


