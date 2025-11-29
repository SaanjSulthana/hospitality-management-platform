# 🚀 Migration Guide: Client-Side Storage Implementation

## 📋 **Pre-Migration Checklist**

- [ ] Backup database before migration
- [ ] Test in staging environment first
- [ ] Inform users of brief downtime (if needed)
- [ ] Review all changes in `PHASE2_IMPLEMENTATION_COMPLETE.md`

---

## 🔧 **Step-by-Step Migration**

### **Step 1: Backend Migration (Database Schema)**

```bash
# Navigate to backend directory
cd backend

# Run database migration
encore db migrate

# Verify migration applied successfully
encore db migrate status
```

**Expected Output:**
```
✅ Applied migration: 6_add_document_cleanup_fields
```

**What This Does:**
- Adds `is_temporary` column to `guest_documents` table
- Adds `expires_at` column for automatic expiry
- Creates index for efficient cleanup queries

---

### **Step 2: Verify Backend Changes**

```bash
# Still in backend directory
encore run
```

**Verify the following endpoints are available:**
- ✅ `POST /guest-checkin/documents/extract-only` (NEW)
- ✅ `GET /cron/cleanup-orphaned-documents` (NEW)
- ❌ `POST /guest-checkin/:checkInId/link-documents` (REMOVED)

**Check logs for:**
```
✅ Service: guest-checkin
✅ Service: cron
✅ Cron job: orphanedDocumentsCleanup (scheduled)
```

---

### **Step 3: Deploy Frontend Changes**

```bash
# Navigate to frontend directory
cd ../frontend

# Install dependencies (if needed)
npm install

# Build for production
npm run build

# Start development server (for testing)
npm run dev
```

---

### **Step 4: Test End-to-End Flow**

#### **Test 1: Document Upload & Extraction**
1. Navigate to Guest Check-In page
2. Upload a document (Aadhaar/Passport)
3. **Verify**: Form auto-fills with extracted data
4. **Verify Console**: Should see "extract-only" API call (NOT "upload")
5. **Verify**: NO document in cloud storage yet

#### **Test 2: Document Re-Upload (Client-Side Storage)**
1. Upload a document
2. Click "Remove" or upload a different document
3. **Verify**: Previous document removed from client-side state
4. **Verify**: NO orphaned documents in cloud storage

#### **Test 3: Check-In Submission (With Documents)**
1. Fill check-in form
2. Upload documents
3. Click "Check In"
4. **Verify Console**: Should see "Uploading documents to cloud with checkInId"
5. **Verify**: Documents uploaded AFTER check-in creation
6. **Verify Database**:
   ```sql
   SELECT id, guest_checkin_id, filename, storage_location
   FROM guest_documents
   WHERE guest_checkin_id IS NOT NULL
   ORDER BY created_at DESC;
   ```
   - All documents should have `guest_checkin_id` set
   - `storage_location` should be 'cloud'

#### **Test 4: Check-In Abandonment (No Pollution)**
1. Upload documents
2. Extract data
3. **DO NOT** submit check-in
4. Navigate away or refresh page
5. **Verify**: NO documents in cloud storage
6. **Verify Database**:
   ```sql
   SELECT COUNT(*) FROM guest_documents WHERE guest_checkin_id IS NULL;
   ```
   - Should return 0 (no orphaned documents)

---

### **Step 5: Verify Cron Job**

#### **Manual Trigger (for testing):**
```bash
# In backend directory
curl -X GET http://localhost:4000/cron/cleanup-orphaned-documents
```

**Expected Response:**
```json
{
  "deletedFromCloud": 0,
  "deletedFromDb": 0,
  "durationMs": 150
}
```

#### **Verify Cron Schedule:**
Check Encore dashboard or logs for:
```
✅ Cron job: orphanedDocumentsCleanup
📅 Schedule: 0 */6 * * * (every 6 hours)
⏰ Next run: [timestamp]
```

---

## 🧪 **Validation Queries**

### **1. Check for Orphaned Documents (Should be 0)**
```sql
SELECT COUNT(*) as orphaned_count
FROM guest_documents
WHERE guest_checkin_id IS NULL
  AND is_temporary = FALSE;
```

### **2. Verify All New Documents Have Check-In IDs**
```sql
SELECT 
  COUNT(*) as total_documents,
  COUNT(guest_checkin_id) as documents_with_checkin,
  COUNT(*) - COUNT(guest_checkin_id) as orphaned
FROM guest_documents
WHERE created_at > NOW() - INTERVAL '1 day';
```

### **3. Check Cleanup Efficiency**
```sql
SELECT 
  COUNT(*) as temp_documents,
  COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as cleaned_up
FROM guest_documents
WHERE is_temporary = TRUE;
```

---

## 🚨 **Rollback Plan (If Needed)**

### **Step 1: Revert Database Migration**
```bash
# In backend directory
encore db migrate down

# Verify rollback
encore db migrate status
```

### **Step 2: Revert Code Changes**
```bash
# Use git to revert to previous commit
git log --oneline
git revert <commit-hash>

# Or checkout previous version
git checkout <previous-tag>
```

### **Step 3: Redeploy Previous Version**
```bash
# Frontend
cd frontend
npm run build

# Backend
cd ../backend
encore run
```

---

## 📊 **Monitoring & Alerts**

### **Metrics to Monitor:**

1. **Orphaned Documents Count**
   ```sql
   SELECT COUNT(*) FROM guest_documents WHERE guest_checkin_id IS NULL;
   ```
   - **Expected**: 0 (with new implementation)
   - **Alert if**: > 10

2. **Cron Job Execution**
   - **Expected**: Runs every 6 hours
   - **Alert if**: No execution in 12 hours

3. **Cloud Storage Usage**
   - **Expected**: Gradual increase with confirmed check-ins only
   - **Alert if**: Sudden spike (may indicate bug)

4. **Extract-Only API Success Rate**
   - **Expected**: > 95% success rate
   - **Alert if**: < 90%

---

## ✅ **Post-Migration Checklist**

- [ ] Database migration applied successfully
- [ ] Backend server running without errors
- [ ] Frontend deployed and accessible
- [ ] Extract-only endpoint working
- [ ] Document upload flow works end-to-end
- [ ] No orphaned documents in database
- [ ] Cron job scheduled and running
- [ ] Monitoring alerts configured
- [ ] Users notified of changes (if user-facing)
- [ ] Documentation updated

---

## 🆘 **Troubleshooting**

### **Issue: "unsupported bucket operation" error**

**Solution**: This is expected. Encore buckets don't support `delete()`. The cron job performs soft deletes in the database only.

```typescript
// Current implementation (correct)
await guestCheckinDB.exec`
  UPDATE guest_documents
  SET deleted_at = NOW()
  WHERE id = ${doc.id}
`;
```

---

### **Issue: Documents not showing in viewer after check-in**

**Possible Causes:**
1. Check if documents were uploaded after check-in creation
2. Verify `guest_checkin_id` is set correctly
3. Check network logs for upload API calls

**Solution:**
```bash
# Check database
SELECT id, guest_checkin_id, filename, storage_location, bucket_key
FROM guest_documents
WHERE guest_checkin_id = <your-checkin-id>;
```

---

### **Issue: Extract-only endpoint not found**

**Solution:**
1. Verify `backend/guest-checkin/encore.service.ts` exports `extract-only`
2. Restart backend server: `encore run`
3. Check Encore API documentation: `encore api list`

---

### **Issue: Frontend not calling extract-only endpoint**

**Solution:**
1. Clear browser cache
2. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
3. Verify `DocumentUploadZone.tsx` uses correct endpoint:
   ```typescript
   fetch('/guest-checkin/documents/extract-only', { ... })
   ```

---

## 📞 **Support**

If you encounter issues not covered in this guide:

1. Check logs:
   - Backend: `encore run` terminal output
   - Frontend: Browser console (F12)
   - Database: Encore dashboard

2. Review implementation details:
   - `PHASE2_IMPLEMENTATION_COMPLETE.md`
   - Git commit history

3. Test in isolation:
   - Test extract-only endpoint with Postman/curl
   - Test document upload with minimal form
   - Test cron job manually

---

**Migration Date**: November 10, 2025  
**Version**: 2.0.0 (Client-Side Storage Implementation)  
**Status**: ✅ Ready for Production

