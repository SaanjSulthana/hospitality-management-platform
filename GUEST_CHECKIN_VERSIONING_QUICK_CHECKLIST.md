# Guest Check-In API Versioning - Quick Implementation Checklist

## 📊 Current Status

```
Progress: [████████░░░░░░░░░░░░] 37% Complete (10/27 endpoints)

✅ Compliant:    10 endpoints
❌ Missing v1:   17 endpoints  
⚠️  Needs fix:    2 endpoints (realtime naming)
```

---

## 🎯 What You Need to Do

### Summary
**You have 17 endpoints that need v1 versions added, following the same pattern as your existing working endpoints.**

---

## ✅ Already Correct (No Action Needed)

These 10 endpoints are perfect - use them as templates:

1. ✅ `createCheckIn` / `createCheckInV1`
2. ✅ `getCheckIn` / `getCheckInV1`
3. ✅ `listCheckIns` / `listCheckInsV1`
4. ✅ `uploadDocument` / `uploadDocumentV1`
5. ✅ `listDocuments` / `listDocumentsV1`
6. ✅ `deleteDocument` / `deleteDocumentV1`
7. ✅ `verifyDocument` / `verifyDocumentV1`
8. ✅ `retryDocumentExtraction` / `retryDocumentExtractionV1`
9. ✅ `viewDocument` / `viewDocumentV1`
10. ✅ `getDocumentThumbnail` / `getDocumentThumbnailV1`
11. ✅ `downloadDocument` / `downloadDocumentV1`
12. ✅ `subscribeAuditEvents` / `subscribeAuditEventsV1`

---

## 🔴 HIGH PRIORITY - Core Functionality (8 endpoints)

### 1. Check-In Operations (3)

**File: `backend/guest-checkin/checkout.ts`**
```diff
+ export const checkOutGuestV1 = api(
+   { expose: true, method: "POST", path: "/v1/guest-checkin/:id/checkout", auth: true },
+   checkOutGuestHandler  // Same handler
+ );
```

**File: `backend/guest-checkin/delete.ts`**
```diff
+ export const deleteCheckInV1 = api(
+   { expose: true, method: "DELETE", path: "/v1/guest-checkin/:id", auth: true },
+   deleteCheckInHandler  // Same handler
+ );
```

**File: `backend/guest-checkin/update.ts`**
```diff
+ export const updateCheckInV1 = api(
+   { expose: true, method: "PUT", path: "/v1/guest-checkin/:id/update", auth: true },
+   updateCheckInHandler  // Same handler
+ );
```

### 2. Audit Logs (4)

**File: `backend/guest-checkin/audit-logs.ts`**

Add v1 versions for:
- `listAuditLogs` → `listAuditLogsV1` 
  - Path: `/v1/guest-checkin/audit-logs`
- `getAuditLogDetail` → `getAuditLogDetailV1`
  - Path: `/v1/guest-checkin/audit-logs/:logId`
- `getAuditSummary` → `getAuditSummaryV1`
  - Path: `/v1/guest-checkin/audit-logs/summary`
- `exportAuditLogs` → `exportAuditLogsV1`
  - Path: `/v1/guest-checkin/audit-logs/export`

### 3. Forms & Composite (2)

**File: `backend/guest-checkin/generate-c-form.ts`**
```diff
+ export const generateCFormV1 = api(
+   { expose: true, method: "POST", path: "/v1/guest-checkin/:id/generate-c-form", auth: true },
+   generateCFormHandler
+ );
```

**File: `backend/guest-checkin/create-with-documents.ts`**
```diff
+ export const createCheckInWithDocumentsV1 = api(
+   { expose: true, method: "POST", path: "/v1/guest-checkin/create-with-documents", auth: true },
+   createCheckInWithDocumentsHandler
+ );
```

---

## 🟡 MEDIUM PRIORITY - Supporting Features (7 endpoints)

### 4. Statistics (3)

**File: `backend/guest-checkin/stats.ts`**
```diff
+ export const getCheckInStatsV1 = api(
+   { expose: true, method: "GET", path: "/v1/guest-checkin/stats", auth: true },
+   getCheckInStatsHandler
+ );
```

**File: `backend/guest-checkin/document-stats.ts`**
```diff
+ export const getDocumentStatsV1 = api(
+   { expose: true, method: "GET", path: "/v1/guest-checkin/documents/stats", auth: true },
+   getDocumentStatsHandler
+ );
```

**File: `backend/guest-checkin/event-metrics.ts`**
```diff
+ export const getGuestEventMetricsV1 = api(
+   { expose: true, method: "GET", path: "/v1/guest-checkin/events/metrics", auth: true },
+   getGuestEventMetricsHandler
+ );
```

### 5. Document Operations (1)

**File: `backend/guest-checkin/extract-only.ts`**
```diff
+ export const extractDocumentDataOnlyV1 = api(
+   { expose: true, method: "POST", path: "/v1/guest-checkin/documents/extract-only", auth: true },
+   extractDocumentDataOnlyHandler
+ );
```

### 6. Audit Actions (2)

**File: `backend/guest-checkin/audit-actions.ts`**
```diff
+ export const logViewDocumentsV1 = api(
+   { expose: true, method: "POST", path: "/v1/guest-checkin/audit/view-documents", auth: true },
+   logViewDocumentsHandler
+ );

+ export const logViewGuestDetailsV1 = api(
+   { expose: true, method: "POST", path: "/v1/guest-checkin/audit/view-guest-details", auth: true },
+   logViewGuestDetailsHandler
+ );
```

---

## ⚠️ SPECIAL CASE - Realtime Endpoints (2 files need fixing)

### Problem
Some files use `/v2` in the path name instead of proper v1 versioning with `schemaVersion` in payload.

### Fix 1: subscribe-guest-events-v2.ts

**Current (WRONG):**
```typescript
path: "/guest-checkin/realtime/subscribe"
```

**Should be:**
```typescript
path: "/v1/guest-checkin/realtime/subscribe"

// And in the payload:
interface GuestEventPayload {
  schemaVersion: 2;  // Version in payload, not path
  // ... rest of payload
}
```

### Fix 2: subscribe-audit-events-v2.ts

**Current (WRONG):**
```typescript
path: "/guest-checkin/audit-events/subscribe/v2"
```

**Should be:**
```typescript
path: "/v1/guest-checkin/audit-events/subscribe"

// And differentiate via payload:
interface AuditEventPayload {
  schemaVersion: 2;  // Version in payload
  // ... rest of payload
}
```

### Fix 3: subscribe-events.ts

**Current:**
```typescript
path: "/guest-checkin/events/subscribe"
```

**Should be:**
```typescript
path: "/v1/guest-checkin/events/subscribe"
```

---

## 📋 Step-by-Step Implementation Guide

### Step 1: Create v1 versions (copy pattern from working endpoints)

For each file listed above:

1. Find the existing endpoint handler function
2. Copy the existing `api()` export
3. Add a new export with `V1` suffix
4. Change path to `/v1/...`
5. Point to same handler

**Example Pattern:**
```typescript
// Existing (keep this)
export const myEndpoint = api(
  { expose: true, method: "GET", path: "/guest-checkin/something", auth: true },
  myHandler
);

// Add this (new)
export const myEndpointV1 = api(
  { expose: true, method: "GET", path: "/v1/guest-checkin/something", auth: true },
  myHandler  // Same handler!
);
```

### Step 2: Test

After adding v1 versions, test:
```bash
# Old endpoint should still work
curl https://api.yourdomain.com/guest-checkin/something

# New v1 endpoint should work identically  
curl https://api.yourdomain.com/v1/guest-checkin/something
```

### Step 3: Update Frontend

Update frontend to use `/v1/` paths:
```typescript
// Before
fetch('/guest-checkin/something')

// After  
fetch('/v1/guest-checkin/something')
```

---

## 📝 Files to Modify

| Priority | File | Endpoints to Add |
|----------|------|------------------|
| 🔴 HIGH | `checkout.ts` | 1 (checkOutGuestV1) |
| 🔴 HIGH | `delete.ts` | 1 (deleteCheckInV1) |
| 🔴 HIGH | `update.ts` | 1 (updateCheckInV1) |
| 🔴 HIGH | `audit-logs.ts` | 4 (all audit endpoints) |
| 🔴 HIGH | `generate-c-form.ts` | 1 (generateCFormV1) |
| 🔴 HIGH | `create-with-documents.ts` | 1 (createCheckInWithDocumentsV1) |
| 🟡 MED | `stats.ts` | 1 (getCheckInStatsV1) |
| 🟡 MED | `document-stats.ts` | 1 (getDocumentStatsV1) |
| 🟡 MED | `event-metrics.ts` | 1 (getGuestEventMetricsV1) |
| 🟡 MED | `extract-only.ts` | 1 (extractDocumentDataOnlyV1) |
| 🟡 MED | `audit-actions.ts` | 2 (both audit action endpoints) |
| ⚠️ FIX | `subscribe-guest-events-v2.ts` | Fix path to /v1/... |
| ⚠️ FIX | `subscribe-audit-events-v2.ts` | Fix path to /v1/... |
| ⚠️ FIX | `subscribe-events.ts` | Fix path to /v1/... |

**Total Files: 14**
**Total Changes: ~17-20 new exports + 3 path fixes**

---

## ✅ Completion Checklist

### Phase 1: Implementation
- [ ] All 17 missing v1 endpoints added
- [ ] All 3 realtime paths fixed to use `/v1/`
- [ ] All handlers point to existing logic (no duplication)
- [ ] Export statements added to `encore.service.ts` if needed

### Phase 2: Testing
- [ ] Legacy endpoints still work
- [ ] V1 endpoints work identically
- [ ] Realtime subscriptions work with schemaVersion in payload
- [ ] No breaking changes to existing integrations

### Phase 3: Frontend Updates  
- [ ] Frontend API client updated to use `/v1/` paths
- [ ] All API calls tested
- [ ] No console errors

### Phase 4: Documentation
- [ ] OpenAPI spec regenerated
- [ ] Postman collections updated
- [ ] Changelog updated
- [ ] Migration timeline communicated

---

## 🚀 Estimated Effort

| Phase | Time | Difficulty |
|-------|------|------------|
| Add v1 exports | 2-3 hours | ⭐ Easy (copy-paste pattern) |
| Fix realtime paths | 1 hour | ⭐⭐ Medium |
| Testing | 2-3 hours | ⭐⭐ Medium |
| Frontend updates | 1-2 hours | ⭐ Easy |
| Documentation | 1 hour | ⭐ Easy |
| **TOTAL** | **7-10 hours** | **⭐⭐ Medium** |

---

## 💡 Pro Tips

1. **Use existing files as templates**: `create.ts`, `list.ts`, `documents.ts` are perfect examples
2. **Don't duplicate handler logic**: V1 endpoints should point to the same handler functions
3. **Test incrementally**: Add v1 versions file-by-file and test each one
4. **Keep legacy working**: Don't remove or change legacy endpoints yet
5. **Use consistent naming**: Always suffix with `V1`, always prefix path with `/v1/`

---

## 🎯 Success Criteria

You'll know you're done when:

✅ All endpoint names in your list have both base and V1 versions
✅ All paths follow `/v1/guest-checkin/...` pattern  
✅ No endpoints use `/v2` or `/v3` in path (use schemaVersion in payload instead)
✅ Frontend can call either legacy or v1 endpoints
✅ Progress shows 100% (27/27 endpoints compliant)

---

**Current Status**: 37% → **Target**: 100%
**Timeline**: 1-2 weeks for full compliance
**Next Step**: Start with HIGH priority endpoints (checkout, delete, update, audit-logs)

Good luck! 🚀

