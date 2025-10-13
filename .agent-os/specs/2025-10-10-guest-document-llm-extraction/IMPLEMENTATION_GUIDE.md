# Implementation Guide

## Quick Reference

This guide provides a roadmap for implementing the Guest Document Upload with LLM Extraction & Audit Logging feature.

---

## 📋 Specification Files

1. **[@spec.md](./spec.md)** - Complete requirements document with user stories and scope
2. **[@spec-lite.md](./spec-lite.md)** - Condensed summary for quick reference
3. **[@sub-specs/technical-spec.md](./sub-specs/technical-spec.md)** - Technical architecture and implementation details
4. **[@sub-specs/database-schema.md](./sub-specs/database-schema.md)** - Complete database schema with migrations
5. **[@sub-specs/api-spec.md](./sub-specs/api-spec.md)** - API endpoints with request/response formats

---

## 🚀 Implementation Phases

### Phase 1: Database Foundation (2-3 days)
**Goal**: Set up database tables and relationships

**Tasks**:
1. ✅ Create `guest_documents` table
2. ✅ Create `guest_audit_logs` table
3. ✅ Add new columns to `guest_checkins` (data_source, data_verified, etc.)
4. ✅ Run migrations: `2_add_guest_documents_and_audit_logs.up.sql`
5. ✅ Verify foreign key relationships and indexes
6. ✅ Test soft delete functionality

**Files to Create**:
- `backend/guest-checkin/migrations/2_add_guest_documents_and_audit_logs.up.sql`
- `backend/guest-checkin/migrations/2_add_guest_documents_and_audit_logs.down.sql`

**Verification**:
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('guest_documents', 'guest_audit_logs');

-- Verify indexes
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('guest_documents', 'guest_audit_logs');
```

---

### Phase 2: LLM Service Integration (3-4 days)
**Goal**: Implement document text extraction using OpenAI GPT-4 Vision

**Tasks**:
1. ✅ Install OpenAI SDK: `bun add openai`
2. ✅ Add `OpenAIAPIKey` to Encore secrets
3. ✅ Create `backend/guest-checkin/llm-service.ts`
4. ✅ Implement extraction logic for each document type (Aadhaar, Passport, PAN, Visa)
5. ✅ Add error handling and retry logic
6. ✅ Create tests with mocked OpenAI responses
7. ✅ Implement confidence score calculation

**Files to Create**:
- `backend/guest-checkin/llm-service.ts` (main extraction service)
- `backend/guest-checkin/__tests__/llm-service.test.ts` (unit tests)
- `backend/guest-checkin/prompts/` (directory for LLM prompts)
  - `aadhaar-extraction.txt`
  - `passport-extraction.txt`
  - `pan-extraction.txt`
  - `visa-extraction.txt`

**Key Functions**:
```typescript
// backend/guest-checkin/llm-service.ts
export async function extractFromDocument(
  imageBase64: string,
  documentType: DocumentType
): Promise<LLMExtractionResponse>;

export async function retryExtraction(documentId: number): Promise<void>;

export function calculateOverallConfidence(
  fields: Record<string, FieldExtraction>
): number;
```

**Configuration**:
```bash
# Add to encore.dev secrets
encore secret set OpenAIAPIKey sk-proj-xxxxxxxxxxxxx
```

---

### Phase 3: Document Upload API (3-4 days)
**Goal**: Implement document upload endpoints with image processing

**Tasks**:
1. ✅ Install Sharp: `bun add sharp`
2. ✅ Create `backend/guest-checkin/documents.ts` (main API file)
3. ✅ Implement `uploadDocument` endpoint
4. ✅ Add image processing (resize, thumbnail generation, EXIF stripping)
5. ✅ Integrate with LLM service for extraction
6. ✅ Implement document listing, viewing, downloading
7. ✅ Add signed URL generation with JWT
8. ✅ Implement soft delete functionality

**Files to Create**:
- `backend/guest-checkin/documents.ts` (API endpoints)
- `backend/guest-checkin/document-types.ts` (TypeScript interfaces)
- `backend/guest-checkin/image-processor.ts` (Sharp image processing)
- `backend/guest-checkin/url-signer.ts` (JWT URL signing)

**Key Endpoints**:
- `POST /guest-checkin/documents/upload`
- `GET /guest-checkin/:checkInId/documents`
- `GET /guest-checkin/documents/:documentId/view`
- `GET /guest-checkin/documents/:documentId/download`
- `GET /guest-checkin/documents/:documentId/thumbnail`
- `DELETE /guest-checkin/documents/:documentId`
- `POST /guest-checkin/documents/:documentId/verify`

**File Storage Structure**:
```
backend/uploads/guest-documents/
  ├── {orgId}/
      ├── {guestCheckInId}/
          ├── aadhaar_front_20251010120530_uuid.jpg
          ├── aadhaar_front_20251010120530_uuid_thumb.jpg
          ├── aadhaar_back_20251010120530_uuid.jpg
          └── ...
```

---

### Phase 4: Audit Logging System (2-3 days)
**Goal**: Implement comprehensive audit trail for all actions

**Tasks**:
1. ✅ Create `backend/guest-checkin/audit-middleware.ts`
2. ✅ Implement audit log insertion logic
3. ✅ Wrap existing API endpoints with audit middleware
4. ✅ Create audit log query endpoints
5. ✅ Implement CSV export functionality
6. ✅ Add IP address and user agent tracking
7. ✅ Test audit logging for all action types

**Files to Create**:
- `backend/guest-checkin/audit-middleware.ts` (middleware wrapper)
- `backend/guest-checkin/audit-logs.ts` (audit log API endpoints)
- `backend/guest-checkin/audit-types.ts` (TypeScript interfaces)
- `backend/guest-checkin/csv-exporter.ts` (CSV export utility)

**Key Endpoints**:
- `GET /guest-checkin/audit-logs`
- `GET /guest-checkin/audit-logs/:logId`
- `GET /guest-checkin/audit-logs/export`
- `GET /guest-checkin/audit-logs/summary`

**Audit Middleware Usage**:
```typescript
// Wrap existing endpoints
export const getCheckIn = auditLog('view_guest_details')(
  api({ expose: true, method: "GET", path: "/guest-checkin/:id", auth },
  async ({ id }) => {
    // ... existing logic
  })
);
```

---

### Phase 5: Frontend Components (4-5 days)
**Goal**: Build UI components for document upload, viewing, and audit logs

**Tasks**:
1. ✅ Create `DocumentUploadZone` component
2. ✅ Create `DocumentViewer` modal component
3. ✅ Create `AuditLogTable` component
4. ✅ Add camera capture functionality
5. ✅ Implement auto-fill form fields from extracted data
6. ✅ Add confidence indicators and verification UI
7. ✅ Create audit log export button

**Files to Create**:
- `frontend/components/guest-checkin/DocumentUploadZone.tsx`
- `frontend/components/guest-checkin/DocumentViewer.tsx`
- `frontend/components/guest-checkin/DocumentCard.tsx`
- `frontend/components/guest-checkin/ConfidenceBadge.tsx`
- `frontend/components/guest-checkin/AuditLogTable.tsx`
- `frontend/components/guest-checkin/AuditLogFilters.tsx`
- `frontend/hooks/useDocumentUpload.ts`
- `frontend/hooks/useAuditLogs.ts`

**Integration Points**:
```typescript
// Update GuestCheckInPage.tsx
import { DocumentUploadZone } from '../components/guest-checkin/DocumentUploadZone';
import { DocumentViewer } from '../components/guest-checkin/DocumentViewer';
import { AuditLogTable } from '../components/guest-checkin/AuditLogTable';

// Add to Indian/Foreign guest forms
<DocumentUploadZone
  documentType="aadhaar_front"
  onUploadComplete={handleDocumentUpload}
  onExtractionComplete={handleAutoFill}
/>
```

---

### Phase 6: Enhanced Check-in Flow (2-3 days)
**Goal**: Integrate document upload into check-in process

**Tasks**:
1. ✅ Update `GuestCheckInPage.tsx` to support document uploads
2. ✅ Implement auto-fill logic when extraction completes
3. ✅ Add verification checkboxes for auto-filled data
4. ✅ Create "Scan Aadhaar/Passport" buttons
5. ✅ Add loading states during LLM extraction
6. ✅ Implement error handling for failed extractions
7. ✅ Add document preview in form

**Modified Files**:
- `frontend/pages/GuestCheckInPage.tsx`
- `backend/guest-checkin/create.ts` (add document support)
- `backend/guest-checkin/update.ts` (add verification support)

**User Flow**:
```
1. User clicks "Indian Guest Check-in"
2. User clicks "Scan Aadhaar Card" button
3. Camera opens or file picker appears
4. User captures/selects Aadhaar front image
5. System uploads and shows "Extracting information..." spinner
6. After 2-3 seconds, form fields auto-fill with extracted data
7. Fields show confidence badges (green/yellow/red)
8. User reviews and corrects any low-confidence fields
9. User uploads Aadhaar back image (optional)
10. User completes booking details
11. User checks "I verify this information is correct"
12. User clicks "Complete Check-in"
13. Success message shows with guest details
```

---

### Phase 7: Testing & QA (3-4 days)
**Goal**: Comprehensive testing of all functionality

**Tasks**:
1. ✅ Unit tests for LLM service
2. ✅ Unit tests for image processing
3. ✅ Unit tests for audit middleware
4. ✅ Integration tests for document upload flow
5. ✅ Integration tests for audit log queries
6. ✅ End-to-end test: Upload Aadhaar → Extract → Auto-fill → Submit
7. ✅ End-to-end test: View documents → Verify audit log created
8. ✅ Load testing: 10 concurrent uploads
9. ✅ Security testing: Unauthorized access attempts
10. ✅ Manual testing checklist completion

**Test Files to Create**:
- `backend/guest-checkin/__tests__/documents.test.ts`
- `backend/guest-checkin/__tests__/audit-logs.test.ts`
- `backend/guest-checkin/__tests__/llm-service.test.ts`
- `frontend/__tests__/DocumentUploadZone.test.tsx`
- `frontend/__tests__/DocumentViewer.test.tsx`
- `frontend/__tests__/AuditLogTable.test.tsx`

**Manual Testing Checklist**: See Technical Spec

---

### Phase 8: Documentation & Deployment (1-2 days)
**Goal**: Document API and deploy to production

**Tasks**:
1. ✅ Update `docs/API_DOCUMENTATION.md` with new endpoints
2. ✅ Create user guide for document upload feature
3. ✅ Add OpenAI API key to production secrets
4. ✅ Configure production file storage (ensure disk space)
5. ✅ Run database migrations in production
6. ✅ Deploy backend with document endpoints
7. ✅ Deploy frontend with new components
8. ✅ Verify production functionality
9. ✅ Monitor error logs for 24 hours
10. ✅ Create runbook for common issues

**Documentation Files to Update/Create**:
- `docs/API_DOCUMENTATION.md` (add document endpoints)
- `docs/GUEST_CHECKIN_GUIDE.md` (user guide)
- `docs/ADMIN_GUIDE.md` (audit log usage)
- `docs/TROUBLESHOOTING.md` (common issues)
- `CHANGELOG.md` (feature release notes)

---

## 📦 Dependencies to Install

### Backend
```bash
cd backend
bun add openai       # LLM integration
bun add sharp        # Image processing
bun add uuid         # Unique file naming
```

### Frontend
```bash
cd frontend
# No new dependencies needed (reuse existing file-upload component)
```

---

## 🔐 Environment Configuration

### Development
```bash
# backend/.env.local
OpenAIAPIKey=sk-proj-xxxxxxxxxxxxx
```

### Production (Encore Secrets)
```bash
encore secret set --prod OpenAIAPIKey sk-proj-xxxxxxxxxxxxx
```

---

## 📊 Success Metrics

After implementation, track these metrics:

1. **Extraction Success Rate**: Target >90%
2. **Extraction Confidence**: Target >85% average
3. **Processing Time**: Target <3 seconds per document
4. **User Adoption**: % of check-ins using document upload
5. **Manual Corrections**: Track how often users correct auto-filled data
6. **Audit Log Coverage**: Verify all actions are logged
7. **Document Storage Growth**: Monitor disk usage

---

## 🐛 Common Issues & Solutions

### Issue: OpenAI API Rate Limit
**Solution**: Implement exponential backoff, queue requests, or upgrade API tier

### Issue: Large Image Upload Fails
**Solution**: Add client-side compression before upload, increase nginx upload limit

### Issue: Extraction Confidence Too Low
**Solution**: Improve image quality requirements, refine LLM prompts, add validation

### Issue: Audit Logs Growing Too Large
**Solution**: Implement partitioning, archive old logs, add retention policy

### Issue: File Storage Disk Full
**Solution**: Implement S3 storage, add disk space monitoring, compress old images

---

## 🎯 Next Steps After Spec Review

1. **Review and Approve**: Go through all spec files and provide feedback
2. **Prioritize Phases**: Decide if any phases should be reordered or deferred
3. **Assign Resources**: Determine who will work on each phase
4. **Set Timeline**: Estimate total implementation time (recommended: 3-4 weeks)
5. **Create Tasks**: Run `/create-tasks` command to generate detailed task list
6. **Start Development**: Begin with Phase 1 (Database Foundation)

---

## 📞 Support & Questions

For questions about this spec, refer to:
- **Technical Details**: [@sub-specs/technical-spec.md](./sub-specs/technical-spec.md)
- **Database Schema**: [@sub-specs/database-schema.md](./sub-specs/database-schema.md)
- **API Endpoints**: [@sub-specs/api-spec.md](./sub-specs/api-spec.md)
- **Requirements**: [@spec.md](./spec.md)

---

**Estimated Total Implementation Time**: 20-25 working days  
**Team Size Recommended**: 2-3 developers  
**Complexity**: High (LLM integration, audit logging, security considerations)  
**Business Value**: Very High (streamlined check-ins, compliance, accountability)

