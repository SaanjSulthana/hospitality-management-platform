# File Upload Size Limits - Configuration Guide

**Last Updated:** October 10, 2025

---

## 🎯 Quick Reference

| Layer | Limit | Reason |
|-------|-------|--------|
| **Frontend (Pre-upload)** | 8MB | Original file size before base64 encoding |
| **HTTP Body (Encore)** | 15MB | Handles base64-encoded file (~10.6MB for 8MB file) |
| **Backend Validation** | 10MB | Decoded file size after base64 decoding |

---

## 📐 Why These Limits?

### **The Base64 Encoding Problem**

When uploading files, the frontend converts images to base64 for JSON transmission. This encoding adds **~33% overhead**:

```
Original File:        8.0 MB  (binary)
                       ↓ (base64 encode)
Base64 String:       ~10.6 MB  (text in JSON)
                       ↓ (HTTP POST)
Server Receives:     ~10.6 MB  (request body)
                       ↓ (base64 decode)
Backend Validates:    8.0 MB  (binary again)
```

### **Why 8MB Frontend Limit?**

- 8MB original file → ~10.6MB after base64 → fits within 15MB HTTP limit
- Provides buffer for HTTP headers and other request data
- Safe margin for network efficiency

### **Why 15MB HTTP Body Limit?**

- Accommodates 8MB files after base64 encoding (~10.6MB)
- Provides overhead for request metadata
- Balances user experience with server resources

### **Why 10MB Backend Validation?**

- Validates the actual decoded file size
- Prevents abuse through direct API calls
- Consistent with industry standards for image uploads

---

## 🔧 Configuration Locations

### **1. Frontend File Size Validation**

**File:** `frontend/components/guest-checkin/DocumentUploadZone.tsx`

```typescript
export function DocumentUploadZone({
  // ...
  maxSize = 8, // 8MB limit to account for ~33% base64 encoding overhead
}: DocumentUploadZoneProps) {
  
  // Validation before upload
  if (file.size > maxSize * 1024 * 1024) {
    const actualSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    setError(`File size too large. Maximum size is ${maxSize}MB (your file is ${actualSizeMB}MB).`);
    return;
  }
}
```

**To Change:** Modify the `maxSize` default parameter

---

### **2. Encore HTTP Body Size Limit**

**File:** `backend/encore.app`

```json
{
  "id": "hospitality-management-platform-cr8i",
  "lang": "typescript",
  "http": {
    "max_body_size": 15728640  // 15MB in bytes
  },
  // ...
}
```

**To Change:**
```json
"max_body_size": 20971520  // 20MB = 20 * 1024 * 1024
```

**Note:** Restart Encore after changing: `encore run`

---

### **3. Backend File Size Validation**

**File:** `backend/guest-checkin/image-processor.ts`

```typescript
// This validates the decoded file size, not the base64-encoded request size
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (decoded file size)

export function validateImage(mimeType: string, fileSize: number): ValidationResult {
  if (fileSize > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
    };
  }
  return { valid: true };
}
```

**To Change:** Modify `MAX_FILE_SIZE` constant

---

## 🧮 Calculating Limits

### **Formula:**

```
Frontend Limit = Backend Limit × 0.75
HTTP Body Limit = Frontend Limit × 1.5
```

### **Example: Allow 12MB Files**

```
1. Backend Validation:  12MB
2. Frontend Limit:      12MB × 0.75 = 9MB    (conservative)
3. HTTP Body Limit:     12MB × 1.5  = 18MB   (accounts for base64)
```

**Configuration:**
```typescript
// Frontend
maxSize = 9

// Backend encore.app
"max_body_size": 18874368  // 18MB = 18 * 1024 * 1024

// Backend image-processor.ts
const MAX_FILE_SIZE = 12 * 1024 * 1024;
```

---

## ⚠️ Common Errors

### **Error: "length limit exceeded"**

```
Upload error: Error: unable to read request body: length limit exceeded
```

**Cause:** File (after base64 encoding) exceeds HTTP body size limit

**Fix:**
1. Check if file is larger than 8MB
2. Increase `max_body_size` in `backend/encore.app`
3. Restart Encore: `encore run`

---

### **Error: "File size too large"**

**Cause:** Frontend validation caught oversized file

**Fix:**
- User: Compress or resize the image
- Developer: Increase `maxSize` in DocumentUploadZone
- Note: Also increase backend limits proportionally

---

## 📊 Recommended Limits by Use Case

| Use Case | Frontend | HTTP Body | Backend | Rationale |
|----------|----------|-----------|---------|-----------|
| **Government IDs** | 8MB | 15MB | 10MB | Current setup ✅ |
| **High-Res Photos** | 12MB | 20MB | 15MB | Professional photography |
| **Scanned Documents** | 5MB | 10MB | 6MB | PDFs and scans |
| **Quick Uploads** | 3MB | 5MB | 4MB | Mobile-first |

---

## 🔍 Debugging File Size Issues

### **Step 1: Check File Size Before Upload**

```typescript
console.log('Original file size:', file.size, 'bytes');
console.log('Original file size:', (file.size / (1024 * 1024)).toFixed(2), 'MB');
```

### **Step 2: Check Base64 Size**

```typescript
const base64String = btoa(binaryString);
console.log('Base64 size:', base64String.length, 'bytes');
console.log('Base64 size:', (base64String.length / (1024 * 1024)).toFixed(2), 'MB');
console.log('Overhead:', ((base64String.length / file.size - 1) * 100).toFixed(1), '%');
```

### **Step 3: Check Backend Logs**

```bash
encore logs --service guest-checkin --follow
```

Look for:
- `"Uploading guest document"` - shows received file size
- `"Invalid base64 file data"` - encoding issues
- `"File size too large"` - validation failure

---

## 🚀 Performance Tips

### **1. Compress Images Before Upload**

Client-side compression can reduce file sizes by 60-80%:

```typescript
import imageCompression from 'browser-image-compression';

const options = {
  maxSizeMB: 2,
  maxWidthOrHeight: 2048,
  useWebWorker: true
};

const compressedFile = await imageCompression(file, options);
```

### **2. Show Compression UI**

```typescript
if (file.size > 5 * 1024 * 1024) {
  setMessage('Large file detected. Compressing...');
  const compressed = await compressImage(file);
  file = compressed;
}
```

### **3. Progressive Upload for Large Files**

For files > 10MB, consider chunked uploads:

```typescript
// Split base64 into chunks
const chunkSize = 5 * 1024 * 1024; // 5MB chunks
for (let i = 0; i < base64String.length; i += chunkSize) {
  const chunk = base64String.slice(i, i + chunkSize);
  await uploadChunk(chunk, i / chunkSize);
}
```

---

## 📝 Testing Checklist

- [ ] Test upload with 1MB file (should succeed)
- [ ] Test upload with 5MB file (should succeed)
- [ ] Test upload with 8MB file (should succeed)
- [ ] Test upload with 9MB file (should fail with clear error)
- [ ] Test upload with 15MB file (should fail before upload)
- [ ] Verify error messages are helpful
- [ ] Check mobile device uploads
- [ ] Test with different image formats (JPEG, PNG, WEBP)

---

## 🔗 Related Files

- **Frontend Component:** `frontend/components/guest-checkin/DocumentUploadZone.tsx`
- **Backend Config:** `backend/encore.app`
- **Backend Validation:** `backend/guest-checkin/image-processor.ts`
- **Backend Upload Handler:** `backend/guest-checkin/documents.ts`

---

## 📞 Support

**Issue:** File uploads still failing?

1. Check Encore is running: `encore daemon status`
2. Restart Encore: `encore run`
3. Check logs: `encore logs --service guest-checkin`
4. Verify encore.app changes: `cat backend/encore.app | grep max_body_size`

**Still stuck?** Check the [QUICK_DEBUG_GUIDE.md](./QUICK_DEBUG_GUIDE.md)

---

**Last Updated:** October 10, 2025  
**Encore Version:** Latest  
**Platform:** Hospitality Management System

