# Guest Check-In API Versioning Verification Report

## Executive Summary

**Status**: ⚠️ **PARTIALLY COMPLIANT** - Significant versioning work needed

This document verifies all guest check-in endpoints against the API versioning migration plan outlined in `docs/api-versioning-plan.md` and `docs/api/migration-to-v1.md`.

## Findings Overview

| Category | Count | Status |
|----------|-------|--------|
| **Total Endpoints** | 46 | - |
| **Dual Versioned (Legacy + v1)** | 10 | ✅ Compliant |
| **Legacy Only** | 24 | ❌ Missing v1 |
| **Already Named v2** | 2 | ⚠️ Needs Review |
| **Debug/Internal** | 2 | ℹ️ May be excluded |

---

## 1. Endpoints with CORRECT Dual Versioning ✅

These endpoints follow the migration plan correctly with both legacy and `/v1/` versions:

### 1.1 Check-In Core Endpoints (5 endpoints)

| Legacy Path | v1 Path | File | Status |
|-------------|---------|------|--------|
| `GET /guest-checkin/:id` | `GET /v1/guest-checkin/:id` | `get.ts` | ✅ |
| `GET /guest-checkin/list` | `GET /v1/guest-checkin/list` | `list.ts` | ✅ |
| `POST /guest-checkin/create` | `POST /v1/guest-checkin/create` | `create.ts` | ✅ |

### 1.2 Document Management Endpoints (7 endpoints)

| Legacy Path | v1 Path | File | Status |
|-------------|---------|------|--------|
| `POST /guest-checkin/documents/upload` | `POST /v1/guest-checkin/documents/upload` | `documents.ts` | ✅ |
| `GET /guest-checkin/:checkInId/documents` | `GET /v1/guest-checkin/:checkInId/documents` | `documents.ts` | ✅ |
| `DELETE /guest-checkin/documents/:documentId` | `DELETE /v1/guest-checkin/documents/:documentId` | `documents.ts` | ✅ |
| `POST /guest-checkin/documents/:documentId/verify` | `POST /v1/guest-checkin/documents/:documentId/verify` | `documents.ts` | ✅ |
| `POST /guest-checkin/documents/:documentId/retry-extraction` | `POST /v1/guest-checkin/documents/:documentId/retry-extraction` | `documents.ts` | ✅ |
| `GET /guest-checkin/documents/:documentId/view` | `GET /v1/guest-checkin/documents/:documentId/view` | `serve-documents.ts` | ✅ |
| `GET /guest-checkin/documents/:documentId/thumbnail` | `GET /v1/guest-checkin/documents/:documentId/thumbnail` | `serve-documents.ts` | ✅ |
| `GET /guest-checkin/documents/:documentId/download` | `GET /v1/guest-checkin/documents/:documentId/download` | `serve-documents.ts` | ✅ |

### 1.3 Audit Log Realtime Endpoints (2 endpoints)

| Legacy Path | v1 Path | File | Status |
|-------------|---------|------|--------|
| `GET /guest-checkin/audit-events/subscribe` | `GET /v1/guest-checkin/audit-events/subscribe` | `subscribe-audit-events.ts` | ✅ |

**Total Compliant: 10 endpoints**

---

## 2. Endpoints MISSING v1 Version ❌

These endpoints need `/v1/` versions added:

### 2.1 Check-In Operations (3 endpoints)

| Current Path | Expected v1 Path | File | Priority |
|--------------|------------------|------|----------|
| `POST /guest-checkin/:id/checkout` | `POST /v1/guest-checkin/:id/checkout` | `checkout.ts` | 🔴 HIGH |
| `DELETE /guest-checkin/:id` | `DELETE /v1/guest-checkin/:id` | `delete.ts` | 🔴 HIGH |
| `PUT /guest-checkin/:id/update` | `PUT /v1/guest-checkin/:id/update` | `update.ts` | 🔴 HIGH |

### 2.2 Document Operations (1 endpoint)

| Current Path | Expected v1 Path | File | Priority |
|--------------|------------------|------|----------|
| `POST /guest-checkin/documents/extract-only` | `POST /v1/guest-checkin/documents/extract-only` | `extract-only.ts` | 🟡 MEDIUM |

### 2.3 Audit Log Endpoints (4 endpoints)

| Current Path | Expected v1 Path | File | Priority |
|--------------|------------------|------|----------|
| `GET /guest-checkin/audit-logs` | `GET /v1/guest-checkin/audit-logs` | `audit-logs.ts` | 🔴 HIGH |
| `GET /guest-checkin/audit-logs/:logId` | `GET /v1/guest-checkin/audit-logs/:logId` | `audit-logs.ts` | 🔴 HIGH |
| `GET /guest-checkin/audit-logs/summary` | `GET /v1/guest-checkin/audit-logs/summary` | `audit-logs.ts` | 🔴 HIGH |
| `GET /guest-checkin/audit-logs/export` | `GET /v1/guest-checkin/audit-logs/export` | `audit-logs.ts` | 🔴 HIGH |

### 2.4 Audit Actions (2 endpoints)

| Current Path | Expected v1 Path | File | Priority |
|--------------|------------------|------|----------|
| `POST /guest-checkin/audit/view-documents` | `POST /v1/guest-checkin/audit/view-documents` | `audit-actions.ts` | 🟡 MEDIUM |
| `POST /guest-checkin/audit/view-guest-details` | `POST /v1/guest-checkin/audit/view-guest-details` | `audit-actions.ts` | 🟡 MEDIUM |

### 2.5 Form Generation (1 endpoint)

| Current Path | Expected v1 Path | File | Priority |
|--------------|------------------|------|----------|
| `POST /guest-checkin/:id/generate-c-form` | `POST /v1/guest-checkin/:id/generate-c-form` | `generate-c-form.ts` | 🔴 HIGH |

### 2.6 Composite Operations (1 endpoint)

| Current Path | Expected v1 Path | File | Priority |
|--------------|------------------|------|----------|
| `POST /guest-checkin/create-with-documents` | `POST /v1/guest-checkin/create-with-documents` | `create-with-documents.ts` | 🔴 HIGH |

### 2.7 Realtime Subscriptions (2 endpoints)

| Current Path | Expected v1 Path | File | Priority |
|--------------|------------------|------|----------|
| `GET /guest-checkin/realtime/subscribe` | `GET /v1/guest-checkin/realtime/subscribe` | `subscribe-guest-events-v2.ts` | 🔴 HIGH |
| `GET /guest-checkin/events/subscribe` | `GET /v1/guest-checkin/events/subscribe` | `subscribe-events.ts` | 🟡 MEDIUM |

### 2.8 Statistics & Metrics (3 endpoints)

| Current Path | Expected v1 Path | File | Priority |
|--------------|------------------|------|----------|
| `GET /guest-checkin/stats` | `GET /v1/guest-checkin/stats` | `stats.ts` | 🟡 MEDIUM |
| `GET /guest-checkin/documents/stats` | `GET /v1/guest-checkin/documents/stats` | `document-stats.ts` | 🟡 MEDIUM |
| `GET /guest-checkin/events/metrics` | `GET /v1/guest-checkin/events/metrics` | `event-metrics.ts` | 🟡 MEDIUM |

**Total Missing: 17 endpoints**

---

## 3. Endpoints with Version Naming Confusion ⚠️

### 3.1 Already Named "v2" in Path

| Current Path | Issue | Recommendation |
|--------------|-------|----------------|
| `GET /guest-checkin/audit-events/subscribe/v2` | File `subscribe-audit-events-v2.ts` uses `/v2` suffix instead of `/v1` prefix | Should be: `GET /v1/guest-checkin/audit-events/subscribe` with payload `schemaVersion: 2` |

**Analysis**: According to the migration plan (section 3.4), realtime endpoints should use `/v1/.../realtime/subscribe` with a `schemaVersion` field in the payload, NOT path-based versioning like `/subscribe/v2`.

**Recommended Fix**:
```typescript
// CURRENT (INCORRECT):
path: "/guest-checkin/audit-events/subscribe/v2"

// SHOULD BE:
path: "/v1/guest-checkin/audit-events/subscribe"
// With payload:
interface AuditEventPayload {
  schemaVersion: 2;  // Indicate schema version in payload
  // ... other fields
}
```

---

## 4. Debug/Internal Endpoints ℹ️

These may be excluded from public API versioning:

| Path | File | Notes |
|------|------|-------|
| `GET /guest-checkin/verify-schema` | `verify-schema.ts` | Development/testing only, `auth: false` |
| `GET /guest-checkin/debug/db-test` | `debug-documents.ts` | Debug endpoint |

**Recommendation**: Keep these unversioned OR move to `/v1/system/debug/...` if they need to be retained.

---

## 5. Disabled Endpoints

| Path | File | Status |
|------|------|--------|
| `POST /guest-checkin/documents/upload-formdata` | `upload-formdata.ts.disabled.bak` | Disabled, no action needed |

---

## 6. Comparison with Your List

You provided this list of endpoints:

```
checkOutGuest
createCheckIn
createCheckInV1
createCheckInWithDocuments
debugDocuments
deleteCheckIn
deleteDocument
deleteDocumentV1
downloadDocument
downloadDocumentV1
extractDocumentDataOnly
generateCForm
getAuditLogDetail
getAuditSummary
getCheckIn
getCheckInStats
getCheckInV1
getDocumentStats
getDocumentThumbnail
getDocumentThumbnailV1
getGuestEventMetrics
listAuditLogs
listCheckIns
listCheckInsV1
listDocuments
listDocumentsV1
logViewDocuments
logViewGuestDetails
retryDocumentExtraction
retryDocumentExtractionV1
subscribeAuditEvents
subscribeAuditEventsV1
subscribeAuditEventsV2
subscribeGuestCheckinEvents
subscribeGuestEventsV2
updateCheckIn
uploadDocument
uploadDocumentV1
verifyDocument
verifyDocumentV1
verifySchema
viewDocument
viewDocumentV1
```

### Analysis:

✅ **Correctly versioned** (have both base and V1):
- createCheckIn / createCheckInV1
- getCheckIn / getCheckInV1  
- listCheckIns / listCheckInsV1
- listDocuments / listDocumentsV1
- deleteDocument / deleteDocumentV1
- downloadDocument / downloadDocumentV1
- uploadDocument / uploadDocumentV1
- verifyDocument / verifyDocumentV1
- retryDocumentExtraction / retryDocumentExtractionV1
- viewDocument / viewDocumentV1
- getDocumentThumbnail / getDocumentThumbnailV1
- subscribeAuditEvents / subscribeAuditEventsV1

❌ **Missing V1 versions**:
- checkOutGuest (no checkOutGuestV1)
- deleteCheckIn (no deleteCheckInV1)
- updateCheckIn (no updateCheckInV1)
- createCheckInWithDocuments (no V1)
- generateCForm (no V1)
- getAuditLogDetail (no V1)
- getAuditSummary (no V1)
- getCheckInStats (no V1)
- getDocumentStats (no V1)
- getGuestEventMetrics (no V1)
- listAuditLogs (no V1)
- logViewDocuments (no V1)
- logViewGuestDetails (no V1)
- extractDocumentDataOnly (no V1)
- subscribeGuestCheckinEvents (no V1)

⚠️ **Confusing naming**:
- subscribeAuditEventsV2 - Should follow realtime pattern with schemaVersion in payload
- subscribeGuestEventsV2 - Should be `/v1/.../realtime/subscribe` with schemaVersion

---

## 7. Migration Plan Compliance Summary

### Per Migration Guide Requirements (docs/api/migration-to-v1.md):

| Requirement | Status | Notes |
|-------------|--------|-------|
| **All endpoints have `/v1` prefix** | ❌ FAIL | Only 10/27 endpoints (37%) have v1 versions |
| **Realtime uses `/v1/.../realtime/subscribe`** | ⚠️ PARTIAL | Mixed: some use `/v2` suffix pattern |
| **Realtime payloads include `schemaVersion`** | ❓ UNKNOWN | Need to verify payload structures |
| **Legacy paths have dual routing** | ✅ PASS | Where v1 exists, legacy is maintained |
| **System endpoints under `/v1/system/*`** | ✅ N/A | No system endpoints in this module |

---

## 8. Recommended Action Plan

### Phase 1: High Priority (Week 1-2) 🔴

Add `/v1` versions for core functionality:

1. **Check-In Operations**:
   ```typescript
   // checkout.ts
   export const checkOutGuest = api({ path: "/guest-checkin/:id/checkout", ... });
   export const checkOutGuestV1 = api({ path: "/v1/guest-checkin/:id/checkout", ... });
   
   // delete.ts
   export const deleteCheckIn = api({ path: "/guest-checkin/:id", ... });
   export const deleteCheckInV1 = api({ path: "/v1/guest-checkin/:id", ... });
   
   // update.ts
   export const updateCheckIn = api({ path: "/guest-checkin/:id/update", ... });
   export const updateCheckInV1 = api({ path: "/v1/guest-checkin/:id/update", ... });
   ```

2. **Audit Log Endpoints** (audit-logs.ts):
   - Add v1 versions of all 4 audit log endpoints

3. **Form Generation**:
   - Add `generateCFormV1`

4. **Composite Operations**:
   - Add `createCheckInWithDocumentsV1`

### Phase 2: Medium Priority (Week 3) 🟡

Add `/v1` versions for supporting features:

1. **Statistics**:
   - Add `getCheckInStatsV1`, `getDocumentStatsV1`, `getGuestEventMetricsV1`

2. **Document Operations**:
   - Add `extractDocumentDataOnlyV1`

3. **Audit Actions**:
   - Add `logViewDocumentsV1`, `logViewGuestDetailsV1`

### Phase 3: Realtime Normalization (Week 3-4) ⚠️

Fix realtime endpoint naming:

1. **Rename and consolidate**:
   ```typescript
   // CURRENT INCORRECT:
   // subscribe-audit-events-v2.ts
   path: "/guest-checkin/audit-events/subscribe/v2"
   
   // SHOULD BE:
   path: "/v1/guest-checkin/audit-events/subscribe"
   // With payload schemaVersion: 2
   ```

2. **Standardize all realtime**:
   - `subscribeGuestCheckinEvents` → `/v1/guest-checkin/realtime/subscribe`
   - `subscribeGuestEventsV2` → `/v1/guest-checkin/events/subscribe`

### Phase 4: Deprecation Headers (Week 5-6)

Add deprecation headers to legacy endpoints per migration guide section 3.2.

---

## 9. Code Examples

### Template for Adding V1 Endpoints

```typescript
// Example: checkout.ts

async function checkOutGuestHandler(params: CheckOutParams): Promise<CheckOutResponse> {
  // Handler logic (unchanged)
}

// Legacy endpoint
export const checkOutGuest = api(
  { expose: true, method: "POST", path: "/guest-checkin/:id/checkout", auth: true },
  checkOutGuestHandler
);

// V1 endpoint
export const checkOutGuestV1 = api(
  { expose: true, method: "POST", path: "/v1/guest-checkin/:id/checkout", auth: true },
  checkOutGuestHandler
);
```

### Template for Realtime with SchemaVersion

```typescript
// Example: subscribe-audit-events-v2.ts → subscribe-audit-events.ts

interface AuditEventPayload {
  schemaVersion: 2;  // Indicate version in payload
  eventType: string;
  // ... other fields
}

export const subscribeAuditEventsV2 = api(
  {
    expose: true,
    method: "GET",
    path: "/v1/guest-checkin/audit-events/subscribe",  // Fixed path
    auth: true,
  },
  async (req) => {
    // In SSE stream:
    const payload: AuditEventPayload = {
      schemaVersion: 2,
      // ...
    };
    // Send event
  }
);
```

---

## 10. Testing Checklist

After implementing v1 endpoints:

- [ ] All legacy endpoints still work (backward compatibility)
- [ ] All v1 endpoints work identically to legacy
- [ ] Frontend updated to use v1 endpoints
- [ ] Deprecation headers added to legacy endpoints
- [ ] Integration tests cover both legacy and v1
- [ ] Documentation updated
- [ ] Postman collections updated
- [ ] OpenAPI spec generated for v1

---

## 11. Conclusion

**Overall Compliance: 37% (10/27 public endpoints)**

**Critical Issues**:
1. **17 endpoints missing v1 versions** - blocks full v1 rollout
2. **Realtime naming inconsistency** - violates migration plan standards
3. **No deprecation timeline** - risk of breaking changes without notice

**Recommended Timeline**:
- **Week 1-2**: Add v1 versions for high priority endpoints
- **Week 3-4**: Complete medium priority + fix realtime naming
- **Week 5-6**: Add deprecation headers and update documentation
- **Week 8+**: Begin legacy endpoint removal (per 60-90 day timeline)

**Estimated Effort**: 
- Development: 3-4 weeks
- Testing: 1-2 weeks
- Documentation: 1 week
- **Total**: 5-7 weeks for full compliance

---

## 12. References

- API Versioning Plan: `docs/api-versioning-plan.md`
- Migration Guide: `docs/api/migration-to-v1.md`
- Shared Constants: `backend/shared/http.ts` (v1Path helper)
- Changelog: `docs/api/changelog.md`

---

**Report Generated**: November 25, 2025
**Auditor**: AI Development Assistant
**Status**: ⚠️ ACTION REQUIRED

