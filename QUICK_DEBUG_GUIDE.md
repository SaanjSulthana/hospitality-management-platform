# Quick Debug Guide - Guest Check-In Document Upload

**🚨 Use this guide when the document listing endpoints are failing**

---

## 🔥 Quick Diagnosis (30 seconds)

```bash
# 1. Check if backend is running
curl http://localhost:4000/guest-checkin/verify-schema

# 2. Test a working endpoint
curl http://localhost:4000/guest-checkin/4 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# 3. Test the failing endpoint
curl http://localhost:4000/guest-checkin/4/documents \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**If step 3 returns 500 error → Continue to fix steps below**

---

## 🔍 Step 1: View Backend Logs (CRITICAL)

```bash
# Real-time logs (best option)
encore logs --service guest-checkin --follow

# Recent logs only
encore logs --service guest-checkin

# Logs from specific time
encore logs --service guest-checkin --since 1h
```

**What to look for in logs:**
- `SQL Error:` or `PostgreSQL error:`
- `column "..." does not exist`
- `syntax error at or near`
- `relation "..." does not exist`
- Any stack traces

**Copy the exact error message and proceed to Step 2.**

---

## 🔍 Step 2: Test Database Directly

```bash
# Connect to the database
encore db shell guest-checkin
```

Once connected, run these queries:

```sql
-- Check if table exists
\d guest_documents;

-- Check if data exists
SELECT COUNT(*) FROM guest_documents;

-- View sample data
SELECT id, guest_checkin_id, filename, document_type 
FROM guest_documents 
LIMIT 5;

-- Test the exact query from the code
SELECT id, filename, document_type, file_size
FROM guest_documents
WHERE guest_checkin_id = 4;

-- Exit database shell
\q
```

**If queries work in shell but fail in API → SQL syntax issue in code**

---

## 🔧 Step 3: Common Fixes

### **Fix A: Column Name Mismatch**

If error says: `column "guestCheckInId" does not exist`

**Problem:** Code uses camelCase, database uses snake_case

**Fix:** Update queries in `backend/guest-checkin/documents.ts`:
```typescript
// ❌ WRONG
WHERE guest_checkin_id = ${guestCheckInId}

// ✅ CORRECT
WHERE guest_checkin_id = ${req.checkInId}
```

### **Fix B: Raw Query Syntax Error**

If error says: `syntax error at or near...`

**Problem:** `guestCheckinDB.raw()` query has SQL syntax issues

**Fix:** Replace raw query with query builder in `backend/guest-checkin/documents.ts`:
```typescript
// ❌ WRONG (raw SQL with bugs)
const result = await guestCheckinDB.raw(`
  SELECT * FROM guest_documents WHERE guest_checkin_id = ${id}
`);

// ✅ CORRECT (use query builder)
const result = await guestCheckinDB
  .select('*')
  .from('guest_documents')
  .where({ guest_checkin_id: id });
```

### **Fix C: Missing Error Logging**

If no error appears in logs:

**Problem:** Errors are swallowed by try-catch

**Fix:** Add detailed logging in `backend/guest-checkin/documents.ts`:
```typescript
try {
  const documents = await guestCheckinDB.raw(query);
  return { documents };
} catch (error) {
  console.error("❌ SQL Error:", error);
  console.error("📝 Query was:", query);
  console.error("📊 Parameters:", { orgId, checkInId, filters });
  throw new Error(`Failed to list documents: ${error.message}`);
}
```

### **Fix D: Wrong Table Name**

If error says: `relation "guest_documents" does not exist`

**Problem:** Table not created or wrong database

**Fix:** Run migration:
```bash
encore db migrate up --service guest-checkin
```

---

## 🧪 Step 4: Quick Test After Fix

```bash
# Set your token
export TOKEN="your_access_token_here"

# Test document listing
curl -X GET "http://localhost:4000/guest-checkin/4/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq

# Test statistics
curl -X GET "http://localhost:4000/guest-checkin/documents/stats" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq

# Test guest list
curl -X GET "http://localhost:4000/guest-checkin/list" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq
```

**If all return 200 status → Fixed! ✅**

---

## 📋 Pre-filled Test Commands

### **Get Access Token:**
```bash
curl -X POST "http://localhost:4000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"shreya@gmail.com","password":"123456789"}' \
  | jq -r '.accessToken'
```

### **Test with Existing Data:**
```bash
# Replace TOKEN with your actual token
TOKEN="eyJhbGci..."

# Test guest check-in 4 (has documents)
curl "http://localhost:4000/guest-checkin/4/documents" \
  -H "Authorization: Bearer $TOKEN"

# Test guest check-in 5
curl "http://localhost:4000/guest-checkin/5/documents" \
  -H "Authorization: Bearer $TOKEN"

# Test guest check-in 6
curl "http://localhost:4000/guest-checkin/6/documents" \
  -H "Authorization: Bearer $TOKEN"

# Test guest check-in 7
curl "http://localhost:4000/guest-checkin/7/documents" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🎯 Expected Good Response

When fixed, you should see:
```json
{
  "documents": [
    {
      "id": 5,
      "guestCheckInId": 4,
      "documentType": "aadhaar_card",
      "detectedDocumentType": "aadhaar_card",
      "documentTypeConfidence": 95,
      "filename": "aadhaar-test.jpg",
      "fileSize": 102400,
      "mimeType": "image/jpeg",
      "extractedData": { ... },
      "extractionConfidence": 85,
      "status": "verified",
      "uploadedAt": "2025-10-10T12:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 50
}
```

---

## 🚨 Error Reference

| Error Message | Meaning | Fix |
|---------------|---------|-----|
| `column "..." does not exist` | Column name wrong | Check snake_case vs camelCase |
| `relation "..." does not exist` | Table missing | Run migrations |
| `syntax error at or near` | SQL syntax wrong | Check raw query syntax |
| `undefined is not a function` | Query method wrong | Check guestCheckinDB API |
| `permission denied` | Auth issue | Check role permissions |
| `Failed to list documents` | Generic error | Add detailed logging |

---

## 📊 Database Quick Reference

### **Table: guest_documents**
```
id                          → SERIAL PRIMARY KEY
guest_checkin_id           → INTEGER (foreign key)
document_type              → VARCHAR(50)
detected_document_type     → VARCHAR(50)
document_type_confidence   → INTEGER (0-100)
filename                   → VARCHAR(255)
file_path                  → TEXT
file_size                  → INTEGER
mime_type                  → VARCHAR(100)
extracted_data             → JSONB
extraction_confidence      → INTEGER (0-100)
document_front_back        → VARCHAR(10)
status                     → VARCHAR(50)
verified_by                → INTEGER
verified_at                → TIMESTAMP
org_id                     → INTEGER
uploaded_by                → INTEGER
uploaded_at                → TIMESTAMP
```

### **Quick Queries:**
```sql
-- Count all documents
SELECT COUNT(*) FROM guest_documents;

-- Documents by check-in
SELECT guest_checkin_id, COUNT(*) 
FROM guest_documents 
GROUP BY guest_checkin_id;

-- Documents by type
SELECT document_type, COUNT(*) 
FROM guest_documents 
GROUP BY document_type;

-- Recent uploads
SELECT * FROM guest_documents 
ORDER BY uploaded_at DESC 
LIMIT 10;
```

---

## 🔄 If Nothing Works

1. **Restart Encore backend:**
   ```bash
   # Stop current instance (Ctrl+C)
   # Then restart
   encore run
   ```

2. **Check environment variables:**
   ```bash
   encore env ls
   ```

3. **Reset database (CAUTION - deletes data):**
   ```bash
   encore db reset guest-checkin
   encore db migrate up --service guest-checkin
   ```

4. **Check for port conflicts:**
   ```bash
   lsof -i :4000
   ```

5. **View full Encore status:**
   ```bash
   encore daemon status
   encore services
   ```

---

## 📞 Get Help

- **Encore Docs:** https://encore.dev/docs
- **Discord:** https://encore.dev/discord
- **GitHub Issues:** https://github.com/encoredev/encore/issues

---

## ✅ Success Checklist

- [ ] Backend logs show no errors
- [ ] Database queries work in shell
- [ ] GET `/guest-checkin/:id/documents` returns 200
- [ ] GET `/guest-checkin/documents/stats` returns 200
- [ ] GET `/guest-checkin/list` returns 200
- [ ] Response includes expected document data
- [ ] No console errors in backend logs

**When all checked → Feature is working! 🎉**

---

**Quick Reference Card - Print this page for debugging!**

**Last Updated:** October 10, 2025  
**For:** Guest Check-In Document Upload Feature  
**Related Files:** See `TESTING_STATUS.md` and `GUEST_CHECKIN_SUMMARY.md`

