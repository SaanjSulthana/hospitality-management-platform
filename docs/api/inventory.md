# API Endpoint Inventory (Current Snapshot)

This inventory summarizes public HTTP endpoints discovered in the repository. It is used as the source of truth for the v1 migration scope.

## Scope Note
This inventory focuses on production client‑facing APIs. Excluded:
- Internal/debug endpoints (e.g., admin tools, internal metrics with `expose: false`)
- Low-level or temporary maintenance hooks
- Detailed staff management endpoints (see `docs/api/staff-management-api.md` for the complete staff API)

Reference figures (from codebase scan):
- Total path definitions in backend: ~346 across ~238 TypeScript files
- Approximate public client-facing endpoints: ~150

Note: Encore exposes endpoints via `api({ path })` metadata and the legacy Express server defines routes in `backend/server.cjs`. The Encore control plane currently reports ~177 endpoints across 14 services.

## Finance
- POST `/finance/revenues`
- POST `/finance/expenses`
- GET `/finance/revenues/:id`
- GET `/finance/expenses/:id`
- PATCH `/finance/revenues/:id`
- PATCH `/finance/expenses/:id`
- DELETE `/finance/revenues/:id`
- DELETE `/finance/expenses/:id`
- GET `/finance/realtime/subscribe`
- GET `/finance/realtime/metrics`
- GET `/finance/events/subscribe`
- GET `/finance/events/history`
- GET `/finance/events/metrics`
- POST `/finance/revenue`
- POST `/finance/expense`
- POST `/finance/approve`
- GET `/finance/health`

## Guest Check-in
- POST `/guest-checkin/create`
- POST `/guest-checkin/create-with-documents`
- GET `/guest-checkin/list`
- GET `/guest-checkin/:id`
- PUT `/guest-checkin/:id/update`
- POST `/guest-checkin/:id/checkout`
- POST `/guest-checkin/:id/generate-c-form`
- Documents:
  - POST `/guest-checkin/documents/upload`
  - POST `/guest-checkin/documents/extract-only`
  - GET `/guest-checkin/:checkInId/documents`
  - GET `/guest-checkin/documents/:documentId/view`
  - GET `/guest-checkin/documents/:documentId/thumbnail`
  - GET `/guest-checkin/documents/:documentId/download`
  - DELETE `/guest-checkin/documents/:documentId`
  - POST `/guest-checkin/documents/:documentId/verify`
  - POST `/guest-checkin/documents/:documentId/retry-extraction`
- Audit logs:
  - GET `/guest-checkin/audit-logs`
  - GET `/guest-checkin/audit-logs/:logId`
  - GET `/guest-checkin/audit-logs/summary`
  - GET `/guest-checkin/audit-logs/export`
  - POST `/guest-checkin/audit/view-documents`
  - POST `/guest-checkin/audit/view-guest-details`
- Realtime / Events:
  - GET `/guest-checkin/realtime/subscribe`
  - GET `/guest-checkin/events/subscribe`
  - GET `/guest-checkin/audit-events/subscribe`
  - GET `/guest-checkin/audit-events/subscribe/v2`
  - GET `/guest-checkin/events/metrics`

## Properties
- GET `/properties`
- POST `/properties`
- PATCH `/properties/:id`
- DELETE `/properties/:id`
- GET `/properties/:id/occupancy`

## Tasks
- Common Encore endpoints are present (`/tasks`, `/tasks/:id`, `/tasks/:id/images`) used by the frontend helpers; legacy Express includes:
  - GET `/tasks/list`
  - POST `/tasks/create`

## Users & Staff
- Legacy Express (server.cjs):
  - GET `/users/list`
  - GET `/staff/list`
- Staff exports (Encore):
  - POST `/staff/v2/leave/export`
  - POST `/staff/v2/attendance/export`
  - POST `/staff/v2/salary/export`

## Reports & Documents
- Reports (service):
  - GET `/reports/daily`
  - GET `/reports/monthly`
  - POST `/reports/reconcile`
  - GET `/reports/health`
- Exports (mixed versioning):
  - POST `/reports/v2/export-daily-pdf`
  - POST `/reports/v2/export-daily-excel`
  - POST `/reports/v2/export-monthly-pdf`
  - POST `/reports/v2/export-monthly-excel`
- Realtime:
  - GET `/reports/realtime/poll`
- Documents:
  - POST `/documents/exports/create`
  - GET `/documents/exports/:exportId/status`
  - POST `/documents/exports/:exportId/retry`
  - DELETE `/documents/exports/:exportId`
  - GET `/documents/exports/:exportId/download`
  - POST `/documents/exports/:exportId/process` (internal)

## Cache / Config / Telemetry / Database
- Cache:
  - GET `/cache/get`, POST `/cache/set`
  - POST `/cache/invalidate`, POST `/cache/clear`
  - GET `/cache/stats`, GET `/cache/health`
  - GET `/cache/status`
- Config:
  - GET `/config/health`
  - GET `/config/validate`
  - GET `/config/environment`
  - GET `/config/test-database`
- Telemetry:
  - POST `/telemetry/client`
- Database Monitoring:
  - GET `/database/replicas/status`
  - GET `/database/replicas/health`
  - GET `/database/replicas/lag`
  - GET `/database/connection-pool/stats`

## Monitoring / Metrics / Alerts
- GET `/monitoring/dashboard`
- GET `/monitoring/unified/metrics`
- GET `/monitoring/unified/health`
- GET `/monitoring/partitions/metrics`
- GET `/monitoring/partitions/table-stats`
- POST `/monitoring/run-partition-migration`
- GET `/metrics/all`
- GET `/metrics/:name`
- GET `/metrics/aggregated`
- Alerts:
  - GET `/alerts/active`
  - GET `/alerts/history`
  - POST `/alerts/:alertId/acknowledge`
  - POST `/alerts/:alertId/clear`
  - GET `/alerts/stats`
- Health surfaces:
  - GET `/health`
  - GET `/ready`
  - GET `/live`

### Versioned System Endpoint Mapping (/v1)

| Legacy | Versioned (/v1) |
| --- | --- |
| `/health` | `/v1/system/health` |
| `/ready` | `/v1/system/ready` |
| `/live` | `/v1/system/live` |
| `/monitoring/dashboard` | `/v1/system/monitoring/dashboard` |
| `/monitoring/unified/metrics` | `/v1/system/monitoring/unified/metrics` |
| `/monitoring/unified/health` | `/v1/system/monitoring/unified/health` |
| `/cache/status` | `/v1/system/cache/status` |
| `/database/replicas/status` | `/v1/system/database/replicas/status` |
| `/database/replicas/health` | `/v1/system/database/replicas/health` |
| `/database/replicas/lag` | `/v1/system/database/replicas/lag` |
| `/database/connection-pool/stats` | `/v1/system/database/connection-pool/stats` |
| `/telemetry/client` | `/v1/system/telemetry/client` |
| `/config/health` | `/v1/system/config/health` |
| `/config/validate` | `/v1/system/config/validate` |
| `/config/environment` | `/v1/system/config/environment` |
| `/config/test-database` | `/v1/system/config/test-database` |

## Legacy Express (server.cjs) — Summary
- Auth: `/auth/signup`, `/auth/login`, `/auth/logout`, `/auth/me`
- Analytics: `/analytics/overview`
- Lists/CRUD samplers: `/tasks/list`, `/tasks/create`, `/properties/list`, `/users/list`, `/staff/list`
- Finance mock: `/finance/revenues`, `/finance/expenses`

---

Maintenance:
- Update this file when adding/removing endpoints.
- During the /v1 migration, use this inventory to verify 1:1 coverage and ensure legacy proxies exist where necessary.

