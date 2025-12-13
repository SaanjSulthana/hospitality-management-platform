# 🚀 Hospitality Management Platform — API Concise Reference
Last Updated: 2025-12-09
Base URL: http://localhost:4000
Timezone: IST (Asia/Kolkata), 24-hour format
Authentication: Bearer JWT in Authorization header
Related docs:
- Full reference: [docs/API_COMPLETE_REFERENCE.md](docs/API_COMPLETE_REFERENCE.md)
- Extended guide: [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)
- Versioning policy: [docs/api-versioning-plan.md](docs/api-versioning-plan.md)
- Streaming overview: [README_STREAMING_API.md](README_STREAMING_API.md)
- Finance realtime client notes: [docs/REALTIME_PROVIDER_FINANCE.md](docs/REALTIME_PROVIDER_FINANCE.md)
- MCP server diagnosis: [ENCORE_MCP_SERVER_DIAGNOSIS.md](ENCORE_MCP_SERVER_DIAGNOSIS.md)
## 1. Quick Start
Get access token
```bash
curl -s -X POST "http://localhost:4000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"changeme"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])" > /tmp/token.txt
```
Use token
```bash
TOKEN=$(cat /tmp/token.txt)
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/v1/health || true
```
Refresh token
```bash
curl -X POST "http://localhost:4000/v1/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<your_refresh_token>"}'
```
## 2. Versioning
- Prefer v1 endpoints, e.g., /v1/finance/expenses
- Legacy paths retained temporarily for backward compatibility
- Clients should migrate to /v1; deprecation timeline in [docs/api-versioning-plan.md](docs/api-versioning-plan.md)
## 3. Conventions
Headers
- Content-Type: application/json
- Authorization: Bearer <token>
- Idempotency-Key: recommended for POST finance writes
- Caching: If-None-Match with ETag supported on many GETs; responses may include _meta.etag
Pagination and filtering
- Common query params: limit, offset, search, startDate, endDate
- Sorting keys vary by endpoint; see full docs
Error format
```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Invalid input", "details": {} }
}
```
## 4. Services Index (examples; all require auth unless noted)
Auth
- POST /v1/auth/login
- POST /v1/auth/refresh
- GET  /v1/auth/me
- POST /v1/auth/forgot-password (PUBLIC)
- POST /v1/auth/reset-password (PUBLIC)
Properties
- GET  /v1/properties
- POST /v1/properties
- GET  /v1/properties/{id}/occupancy
- PATCH /v1/properties/{id}
Finance
- GET  /v1/finance/expenses
- POST /v1/finance/expenses
- GET  /v1/finance/revenues
- POST /v1/finance/revenues
- PATCH /v1/finance/expenses/{id}/approve
- PATCH /v1/finance/revenues/{id}/approve
Reports
- GET  /v1/reports/daily-report
- GET  /v1/reports/monthly-report
- POST /v1/reports/export/daily-pdf
- POST /v1/reports/export/monthly-excel
Guest Check-in
- POST /v1/guest-checkin/create
- GET  /v1/guest-checkin/{id}
- POST /v1/guest-checkin/documents/upload
- GET  /v1/guest-checkin/audit-logs
Staff
- GET  /v1/staff
- GET  /v1/staff/attendance
- POST /v1/staff/leave-requests
- GET  /v1/staff/leave/statistics
Tasks
- GET  /v1/tasks
- POST /v1/tasks
- PATCH /v1/tasks/{id}
- POST /v1/tasks/attachments
Users
- GET  /v1/users
- POST /v1/users
- GET  /v1/users/{id}
- PATCH /v1/users/{id}
Documents & Uploads
- POST /v1/documents/exports/create
- GET  /v1/documents/exports/{exportId}/status
- GET  /v1/documents/exports/{exportId}/download
- POST /v1/uploads/file (upload)
- GET  /v1/uploads/{fileId}/download
Monitoring & System (PUBLIC unless noted)
- GET  /v1/system/health
- GET  /v1/system/metrics/aggregated
- GET  /v1/system/alerts/active
- GET  /v1/system/monitoring/unified/metrics
- POST /v1/system/monitoring/cache/reset-metrics (AUTH)
Database & Config (PUBLIC unless noted)
- GET  /v1/system/database/connection-pool/stats
- GET  /v1/system/database/replicas/status
- GET  /v1/system/config/health
Realtime & Streaming
- GET  /v1/guest-checkin/realtime/subscribe (long-poll)
- GET  /v1/finance/realtime/subscribe (long-poll)
- GET  /v2/realtime/stream (multiplexed event stream)
- POST /v2/realtime/credits (flow control)
- POST /v2/realtime/update-services (dynamic filters)
Validation & Telemetry
- POST /v1/system/validation/check-consistency
- POST /v1/system/validation/auto-repair
- POST /v1/system/telemetry/client
Orgs & Seed
- POST /v1/orgs
- POST /v1/orgs/invite
- POST /seed/data (PUBLIC)
## 5. Quick Recipes
Create expense (idempotent)
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/v1/finance/expenses" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "propertyId": 1,
    "category": "maintenance",
    "amountCents": 125000,
    "currency": "INR",
    "description": "AC repair",
    "expenseDate": "2025-12-09T10:00:00Z",
    "paymentMode": "cash"
  }'
```
Get daily report
```bash
curl -X GET "http://localhost:4000/v1/reports/daily-report?propertyId=1&date=2025-12-08" \
  -H "Authorization: Bearer $TOKEN"
```
Create guest check-in
```bash
curl -X POST "http://localhost:4000/v1/guest-checkin/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": 1,
    "guestType": "indian",
    "fullName": "Ananya Sharma",
    "phone": "+91-9000000000",
    "expectedCheckoutDate": "2025-12-12"
  }'
```
Subscribe to realtime stream
```bash
curl -N "http://localhost:4000/v2/realtime/stream" \
  -H "Authorization: Bearer $TOKEN"
```
## 6. Security & Access
- Access types by endpoint: PUBLIC (no auth), AUTH (JWT required), PRIVATE (internal)
- Roles include ADMIN and MANAGER; access is constrained by assigned properties
- For auth scheme details see [AUTHENTICATION_SYSTEM.md](AUTHENTICATION_SYSTEM.md)
## 7. Notes
- Prefer /v1 routes; legacy paths are supported during migration only
- Many GET endpoints support ETag-based caching and may return _meta
- For streaming client patterns, see [frontend/providers/RealtimeProviderV2_Fixed.tsx](frontend/providers/RealtimeProviderV2_Fixed.tsx)
- For parameter tips, see [ENCORE_API_PARAMETER_HANDLING_GUIDE.md](ENCORE_API_PARAMETER_HANDLING_GUIDE.md)