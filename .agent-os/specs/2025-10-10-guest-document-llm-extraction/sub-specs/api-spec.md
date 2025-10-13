# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-10-10-guest-document-llm-extraction/spec.md

## Overview

This API specification defines new endpoints for guest document management with LLM-based extraction and comprehensive audit logging. All endpoints require authentication and follow RESTful conventions. Endpoints are organized into three main categories: Document Management, Audit Logs, and Enhanced Check-in Operations.

**Base URL**: `http://localhost:4000` (development) | `https://api.yourdomain.com` (production)  
**Authentication**: Bearer JWT token in `Authorization` header  
**Content-Type**: `application/json` for requests and responses  
**File Uploads**: Base64-encoded file data in JSON payload

---

## 1. Document Management Endpoints

### 1.1 Upload Guest Document with LLM Extraction

Upload an ID document image and automatically extract guest information using LLM.

**Endpoint**: `POST /guest-checkin/documents/upload`  
**Auth Required**: Yes (Admin, Manager)  
**Rate Limit**: 10 requests/minute per user

**Request Body**:
```typescript
interface UploadDocumentRequest {
  guestCheckInId?: number; // Optional if uploading before check-in is created
  documentType: 'aadhaar_front' | 'aadhaar_back' | 'pan_card' | 'passport' | 'visa_front' | 'visa_back' | 'other';
  fileData: string; // Base64-encoded image
  filename: string; // Original filename
  mimeType: string; // image/jpeg, image/png, image/webp, application/pdf
  performExtraction?: boolean; // Default: true
}
```

**Example Request**:
```bash
curl -X POST "http://localhost:4000/guest-checkin/documents/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "guestCheckInId": 123,
    "documentType": "aadhaar_front",
    "fileData": "/9j/4AAQSkZJRgABAQEAYABgAAD...",
    "filename": "aadhaar_front.jpg",
    "mimeType": "image/jpeg",
    "performExtraction": true
  }'
```

**Response** (200 OK):
```typescript
interface UploadDocumentResponse {
  success: boolean;
  document: {
    id: number;
    documentType: string;
    filename: string;
    fileSize: number;
    thumbnailUrl: string;
    uploadedAt: string;
  };
  extraction: {
    status: 'completed' | 'processing' | 'failed' | 'skipped';
    data: {
      [fieldName: string]: {
        value: string;
        confidence: number;
        needsVerification: boolean;
      };
    };
    overallConfidence: number;
    processingTime: number; // milliseconds
  };
  message: string;
}
```

**Example Response**:
```json
{
  "success": true,
  "document": {
    "id": 456,
    "documentType": "aadhaar_front",
    "filename": "aadhaar_front_20251010120530_a3f2b8c9.jpg",
    "fileSize": 2456789,
    "thumbnailUrl": "/guest-checkin/documents/456/thumbnail?token=...",
    "uploadedAt": "2025-10-10T12:05:30.123Z"
  },
  "extraction": {
    "status": "completed",
    "data": {
      "fullName": {
        "value": "Ananya Sharma",
        "confidence": 95,
        "needsVerification": false
      },
      "aadharNumber": {
        "value": "1234 5678 9012",
        "confidence": 98,
        "needsVerification": false
      },
      "dateOfBirth": {
        "value": "1995-05-15",
        "confidence": 90,
        "needsVerification": false
      },
      "address": {
        "value": "123, Rose Villa, MG Road, Bangalore 560001",
        "confidence": 85,
        "needsVerification": true
      },
      "gender": {
        "value": "Female",
        "confidence": 95,
        "needsVerification": false
      }
    },
    "overallConfidence": 92,
    "processingTime": 2345
  },
  "message": "Document uploaded and processed successfully"
}
```

**Error Responses**:

- **400 Bad Request**: Invalid file type, file too large, missing required fields
```json
{
  "error": "invalid_file",
  "message": "File type not supported. Please upload JPEG, PNG, WEBP, or PDF.",
  "code": "INVALID_FILE_TYPE"
}
```

- **401 Unauthorized**: Missing or invalid auth token
- **403 Forbidden**: User lacks permission (not Admin or Manager)
- **413 Payload Too Large**: File exceeds 10MB limit
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: LLM service failure, disk space issues
```json
{
  "error": "extraction_failed",
  "message": "Failed to extract text from document. Please try again or enter manually.",
  "code": "LLM_SERVICE_ERROR",
  "retryable": true
}
```

---

### 1.2 List Documents for a Guest

Retrieve all documents uploaded for a specific guest check-in.

**Endpoint**: `GET /guest-checkin/:checkInId/documents`  
**Auth Required**: Yes (Admin, Manager)

**Path Parameters**:
- `checkInId` (required): Guest check-in ID

**Query Parameters**:
- `includeDeleted` (optional, boolean): Include soft-deleted documents (default: false)
- `documentType` (optional, string): Filter by document type

**Example Request**:
```bash
curl -X GET "http://localhost:4000/guest-checkin/123/documents?includeDeleted=false" \
  -H "Authorization: Bearer $TOKEN"
```

**Response** (200 OK):
```typescript
interface ListDocumentsResponse {
  documents: Array<{
    id: number;
    documentType: string;
    filename: string;
    originalFilename: string;
    fileSize: number;
    mimeType: string;
    thumbnailUrl: string;
    imageWidth: number;
    imageHeight: number;
    extractedData: {
      [fieldName: string]: {
        value: string;
        confidence: number;
      };
    } | null;
    overallConfidence: number | null;
    extractionStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
    isVerified: boolean;
    verifiedBy: {
      userId: number;
      email: string;
      verifiedAt: string;
    } | null;
    uploadedBy: {
      userId: number;
      email: string;
    };
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
  }>;
  total: number;
}
```

**Example Response**:
```json
{
  "documents": [
    {
      "id": 456,
      "documentType": "aadhaar_front",
      "filename": "aadhaar_front_20251010120530_a3f2b8c9.jpg",
      "originalFilename": "aadhaar_front.jpg",
      "fileSize": 2456789,
      "mimeType": "image/jpeg",
      "thumbnailUrl": "/guest-checkin/documents/456/thumbnail?token=...",
      "imageWidth": 1920,
      "imageHeight": 1080,
      "extractedData": {
        "fullName": { "value": "Ananya Sharma", "confidence": 95 },
        "aadharNumber": { "value": "1234 5678 9012", "confidence": 98 }
      },
      "overallConfidence": 92,
      "extractionStatus": "completed",
      "isVerified": true,
      "verifiedBy": {
        "userId": 10,
        "email": "manager@hotel.com",
        "verifiedAt": "2025-10-10T12:10:00Z"
      },
      "uploadedBy": {
        "userId": 10,
        "email": "manager@hotel.com"
      },
      "createdAt": "2025-10-10T12:05:30Z",
      "updatedAt": "2025-10-10T12:10:00Z",
      "deletedAt": null
    }
  ],
  "total": 1
}
```

**Error Responses**:
- **401 Unauthorized**: Missing or invalid auth token
- **403 Forbidden**: User lacks permission
- **404 Not Found**: Guest check-in not found

---

### 1.3 View Document Image

Retrieve the full-size document image with signed URL access.

**Endpoint**: `GET /guest-checkin/documents/:documentId/view`  
**Auth Required**: Yes (Admin, Manager)  
**Audit Logged**: Yes (action: `view_document`)

**Path Parameters**:
- `documentId` (required): Document ID

**Query Parameters**:
- `token` (required): JWT-signed token for URL authorization (auto-generated by backend, expires in 1 hour)

**Example Request**:
```bash
# Step 1: Get signed URL
curl -X GET "http://localhost:4000/guest-checkin/documents/456" \
  -H "Authorization: Bearer $TOKEN"

# Response includes signedUrl field:
# { "signedUrl": "/guest-checkin/documents/456/view?token=eyJhbGc..." }

# Step 2: Access document using signed URL
curl -X GET "http://localhost:4000/guest-checkin/documents/456/view?token=eyJhbGc..." \
  --output document.jpg
```

**Response** (200 OK):
- **Content-Type**: `image/jpeg`, `image/png`, or `application/pdf` (based on original)
- **Body**: Binary image data

**Response Headers**:
```
Content-Type: image/jpeg
Content-Length: 2456789
Content-Disposition: inline; filename="aadhaar_front_20251010120530_a3f2b8c9.jpg"
Cache-Control: private, max-age=3600
X-Document-Id: 456
X-Guest-CheckIn-Id: 123
```

**Error Responses**:
- **401 Unauthorized**: Invalid or expired token
- **403 Forbidden**: User lacks permission to view this document
- **404 Not Found**: Document not found or deleted
- **410 Gone**: Document file missing from disk (deleted or corrupted)

---

### 1.4 Download Document

Download a document image (triggers `download_document` audit log).

**Endpoint**: `GET /guest-checkin/documents/:documentId/download`  
**Auth Required**: Yes (Admin, Manager)  
**Audit Logged**: Yes (action: `download_document`)

**Path Parameters**:
- `documentId` (required): Document ID

**Example Request**:
```bash
curl -X GET "http://localhost:4000/guest-checkin/documents/456/download" \
  -H "Authorization: Bearer $TOKEN" \
  --output aadhaar_front.jpg
```

**Response** (200 OK):
- **Content-Type**: `image/jpeg`, `image/png`, or `application/pdf`
- **Body**: Binary image data
- **Headers**:
```
Content-Disposition: attachment; filename="aadhaar_front_20251010120530_a3f2b8c9.jpg"
```

---

### 1.5 Get Document Thumbnail

Retrieve a thumbnail preview (300x300) of the document.

**Endpoint**: `GET /guest-checkin/documents/:documentId/thumbnail`  
**Auth Required**: Yes (Admin, Manager)  
**Audit Logged**: No (lightweight operation)

**Path Parameters**:
- `documentId` (required): Document ID

**Query Parameters**:
- `token` (optional): Signed token (if accessing via signed URL)

**Example Request**:
```bash
curl -X GET "http://localhost:4000/guest-checkin/documents/456/thumbnail" \
  -H "Authorization: Bearer $TOKEN" \
  --output thumbnail.jpg
```

**Response** (200 OK):
- **Content-Type**: `image/jpeg`
- **Body**: Thumbnail image data (max 300x300)

---

### 1.6 Delete Document (Soft Delete)

Mark a document as deleted (soft delete for audit trail).

**Endpoint**: `DELETE /guest-checkin/documents/:documentId`  
**Auth Required**: Yes (Admin, Manager - can only delete own uploads; Admin can delete any)  
**Audit Logged**: Yes (action: `delete_document`)

**Path Parameters**:
- `documentId` (required): Document ID

**Request Body** (optional):
```typescript
interface DeleteDocumentRequest {
  reason?: string; // Optional reason for deletion
  hardDelete?: boolean; // Default: false (soft delete)
}
```

**Example Request**:
```bash
curl -X DELETE "http://localhost:4000/guest-checkin/documents/456" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Incorrect document uploaded",
    "hardDelete": false
  }'
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Document deleted successfully",
  "documentId": 456,
  "deletedAt": "2025-10-10T15:30:00Z"
}
```

**Error Responses**:
- **403 Forbidden**: User doesn't have permission to delete this document
- **404 Not Found**: Document not found or already deleted

---

### 1.7 Verify Extracted Data

Mark document extraction as verified by a human staff member.

**Endpoint**: `POST /guest-checkin/documents/:documentId/verify`  
**Auth Required**: Yes (Admin, Manager)  
**Audit Logged**: Yes (action: `verify_document`)

**Path Parameters**:
- `documentId` (required): Document ID

**Request Body**:
```typescript
interface VerifyDocumentRequest {
  correctedData?: {
    [fieldName: string]: string;
  }; // Optional field corrections
  notes?: string;
}
```

**Example Request**:
```bash
curl -X POST "http://localhost:4000/guest-checkin/documents/456/verify" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "correctedData": {
      "address": "123, Rose Villa, MG Road, Bangalore 560001, Karnataka"
    },
    "notes": "Corrected address to include state"
  }'
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Document verified successfully",
  "documentId": 456,
  "verifiedBy": {
    "userId": 10,
    "email": "manager@hotel.com"
  },
  "verifiedAt": "2025-10-10T12:15:00Z"
}
```

---

### 1.8 Retry Failed Extraction

Retry LLM extraction for a document that previously failed.

**Endpoint**: `POST /guest-checkin/documents/:documentId/retry-extraction`  
**Auth Required**: Yes (Admin, Manager)

**Path Parameters**:
- `documentId` (required): Document ID

**Example Request**:
```bash
curl -X POST "http://localhost:4000/guest-checkin/documents/456/retry-extraction" \
  -H "Authorization: Bearer $TOKEN"
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Extraction retry initiated",
  "documentId": 456,
  "extractionStatus": "processing"
}
```

---

## 2. Audit Log Endpoints

### 2.1 List Audit Logs

Retrieve audit logs with filtering and pagination.

**Endpoint**: `GET /guest-checkin/audit-logs`  
**Auth Required**: Yes (Admin, Manager, Owner)  
**Audit Logged**: Yes (action: `query_audit_logs`)

**Query Parameters**:
- `startDate` (optional, ISO 8601): Filter by start date
- `endDate` (optional, ISO 8601): Filter by end date
- `userId` (optional, number): Filter by user who performed action
- `guestCheckInId` (optional, number): Filter by guest check-in
- `actionType` (optional, string): Filter by action type
- `resourceType` (optional, string): Filter by resource type
- `success` (optional, boolean): Filter by success/failure
- `limit` (optional, number): Results per page (default: 50, max: 200)
- `offset` (optional, number): Pagination offset (default: 0)

**Example Request**:
```bash
curl -X GET "http://localhost:4000/guest-checkin/audit-logs?\
startDate=2025-10-01T00:00:00Z&\
endDate=2025-10-10T23:59:59Z&\
actionType=view_documents&\
limit=20&\
offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

**Response** (200 OK):
```typescript
interface ListAuditLogsResponse {
  logs: Array<{
    id: number;
    timestamp: string;
    user: {
      id: number;
      email: string;
      role: string;
    };
    action: {
      type: string;
      resourceType: string;
      resourceId: number | null;
    };
    guest: {
      checkInId: number | null;
      name: string | null;
    };
    context: {
      ipAddress: string;
      userAgent: string;
      requestMethod: string;
      requestPath: string;
    };
    details: Record<string, any>;
    success: boolean;
    errorMessage: string | null;
    durationMs: number | null;
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
```

**Example Response**:
```json
{
  "logs": [
    {
      "id": 12345,
      "timestamp": "2025-10-10T12:10:00.123Z",
      "user": {
        "id": 10,
        "email": "manager@hotel.com",
        "role": "MANAGER"
      },
      "action": {
        "type": "view_documents",
        "resourceType": "guest_document",
        "resourceId": 456
      },
      "guest": {
        "checkInId": 123,
        "name": "Ananya Sharma"
      },
      "context": {
        "ipAddress": "192.168.1.100",
        "userAgent": "Mozilla/5.0...",
        "requestMethod": "GET",
        "requestPath": "/guest-checkin/123/documents"
      },
      "details": {
        "documentIds": [456, 457],
        "viewDuration": 45
      },
      "success": true,
      "errorMessage": null,
      "durationMs": 234
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

**Error Responses**:
- **401 Unauthorized**: Missing or invalid auth token
- **403 Forbidden**: User lacks permission (not Admin/Manager/Owner)

---

### 2.2 Get Audit Log Details

Retrieve detailed information for a specific audit log entry.

**Endpoint**: `GET /guest-checkin/audit-logs/:logId`  
**Auth Required**: Yes (Admin, Manager, Owner)

**Path Parameters**:
- `logId` (required): Audit log entry ID

**Example Request**:
```bash
curl -X GET "http://localhost:4000/guest-checkin/audit-logs/12345" \
  -H "Authorization: Bearer $TOKEN"
```

**Response** (200 OK):
```json
{
  "log": {
    "id": 12345,
    "timestamp": "2025-10-10T12:10:00.123Z",
    "user": {
      "id": 10,
      "email": "manager@hotel.com",
      "role": "MANAGER",
      "displayName": "John Smith"
    },
    "action": {
      "type": "update_checkin",
      "resourceType": "guest_checkin",
      "resourceId": 123
    },
    "guest": {
      "checkInId": 123,
      "name": "Ananya Sharma",
      "email": "ananya@example.com",
      "phone": "+91 98765 43210"
    },
    "context": {
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
      "requestMethod": "PUT",
      "requestPath": "/guest-checkin/123/update"
    },
    "details": {
      "changedFields": {
        "roomNumber": {
          "before": "101",
          "after": "102"
        },
        "numberOfGuests": {
          "before": 1,
          "after": 2
        }
      }
    },
    "success": true,
    "errorMessage": null,
    "durationMs": 456
  }
}
```

---

### 2.3 Export Audit Logs to CSV

Export filtered audit logs as CSV for compliance reporting.

**Endpoint**: `GET /guest-checkin/audit-logs/export`  
**Auth Required**: Yes (Admin, Owner)  
**Audit Logged**: Yes (action: `export_audit_logs`)

**Query Parameters**:
- Same as List Audit Logs endpoint (startDate, endDate, userId, etc.)

**Example Request**:
```bash
curl -X GET "http://localhost:4000/guest-checkin/audit-logs/export?\
startDate=2025-10-01T00:00:00Z&\
endDate=2025-10-10T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN" \
  --output audit_logs_20251001_20251010.csv
```

**Response** (200 OK):
- **Content-Type**: `text/csv`
- **Headers**:
```
Content-Disposition: attachment; filename="audit_logs_20251001_20251010.csv"
```
- **Body**: CSV data with columns:
```csv
Timestamp,User Email,User Role,Action Type,Resource Type,Resource ID,Guest Name,IP Address,Success,Duration (ms)
2025-10-10T12:10:00.123Z,manager@hotel.com,MANAGER,view_documents,guest_document,456,Ananya Sharma,192.168.1.100,true,234
```

---

## 3. Enhanced Check-in Endpoints

### 3.1 Create Check-in with Document Upload

Enhanced version of existing create endpoint that accepts document uploads.

**Endpoint**: `POST /guest-checkin/create-with-documents`  
**Auth Required**: Yes (Admin, Manager)  
**Audit Logged**: Yes (action: `create_checkin`)

**Request Body**:
```typescript
interface CreateCheckInWithDocumentsRequest {
  // Standard check-in fields
  propertyId: number;
  guestType: 'indian' | 'foreign';
  fullName: string;
  email: string;
  phone: string;
  address: string;
  aadharNumber?: string;
  panNumber?: string;
  passportNumber?: string;
  country?: string;
  visaType?: string;
  visaExpiryDate?: string;
  expectedCheckoutDate?: string;
  roomNumber?: string;
  numberOfGuests?: number;
  
  // New fields
  dataSource?: 'manual' | 'aadhaar_scan' | 'passport_scan' | 'pan_scan' | 'visa_scan' | 'mixed';
  
  // Documents to upload (optional)
  documents?: Array<{
    documentType: string;
    fileData: string; // Base64
    filename: string;
    mimeType: string;
  }>;
}
```

**Example Request**:
```bash
curl -X POST "http://localhost:4000/guest-checkin/create-with-documents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": 1,
    "guestType": "indian",
    "fullName": "Ananya Sharma",
    "email": "ananya@example.com",
    "phone": "+91 98765 43210",
    "address": "123, Rose Villa, MG Road, Bangalore 560001",
    "aadharNumber": "123456789012",
    "roomNumber": "101",
    "numberOfGuests": 1,
    "dataSource": "aadhaar_scan",
    "documents": [
      {
        "documentType": "aadhaar_front",
        "fileData": "/9j/4AAQSkZJRgABAQEAYABgAAD...",
        "filename": "aadhaar_front.jpg",
        "mimeType": "image/jpeg"
      },
      {
        "documentType": "aadhaar_back",
        "fileData": "/9j/4AAQSkZJRgABAQEAYABgAAD...",
        "filename": "aadhaar_back.jpg",
        "mimeType": "image/jpeg"
      }
    ]
  }'
```

**Response** (200 OK):
```json
{
  "id": 123,
  "message": "Guest checked in successfully",
  "checkInDate": "2025-10-10T12:00:00Z",
  "documents": [
    {
      "id": 456,
      "documentType": "aadhaar_front",
      "extractionStatus": "completed",
      "overallConfidence": 92
    },
    {
      "id": 457,
      "documentType": "aadhaar_back",
      "extractionStatus": "completed",
      "overallConfidence": 88
    }
  ]
}
```

---

### 3.2 Update Check-in with Data Verification

Enhanced update endpoint that tracks data verification.

**Endpoint**: `PUT /guest-checkin/:id/update`  
**Auth Required**: Yes (Admin, Manager)  
**Audit Logged**: Yes (action: `update_checkin` with before/after field values)

**Request Body**:
```typescript
interface UpdateCheckInRequest {
  // Standard fields (as before)
  fullName?: string;
  email?: string;
  phone?: string;
  address?: string;
  roomNumber?: string;
  numberOfGuests?: number;
  expectedCheckoutDate?: string;
  
  // New fields
  dataVerified?: boolean; // Mark data as verified
  verifyExtractedData?: boolean; // Verify auto-extracted data
}
```

**Example Request**:
```bash
curl -X PUT "http://localhost:4000/guest-checkin/123/update" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roomNumber": "102",
    "dataVerified": true,
    "verifyExtractedData": true
  }'
```

**Response** (200 OK):
```json
{
  "message": "Check-in updated successfully",
  "updatedAt": "2025-10-10T12:20:00Z",
  "dataVerified": true,
  "verifiedBy": {
    "userId": 10,
    "email": "manager@hotel.com",
    "verifiedAt": "2025-10-10T12:20:00Z"
  }
}
```

---

## 4. Statistics & Analytics

### 4.1 Document Statistics

Get statistics on document uploads and extraction success rates.

**Endpoint**: `GET /guest-checkin/documents/stats`  
**Auth Required**: Yes (Admin, Manager)

**Query Parameters**:
- `startDate` (optional): Start date for stats
- `endDate` (optional): End date for stats
- `propertyId` (optional): Filter by property

**Example Request**:
```bash
curl -X GET "http://localhost:4000/guest-checkin/documents/stats?\
startDate=2025-10-01T00:00:00Z&\
endDate=2025-10-31T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN"
```

**Response** (200 OK):
```json
{
  "totalDocuments": 1500,
  "byDocumentType": {
    "aadhaar_front": 450,
    "aadhaar_back": 450,
    "passport": 300,
    "pan_card": 200,
    "visa_front": 50,
    "visa_back": 50
  },
  "extractionStats": {
    "completed": 1350,
    "processing": 20,
    "failed": 100,
    "skipped": 30,
    "avgConfidence": 89,
    "avgProcessingTime": 2100
  },
  "verificationStats": {
    "verified": 1200,
    "needsVerification": 150,
    "verificationRate": 88.9
  },
  "storageStats": {
    "totalSizeBytes": 3221225472,
    "totalSizeMB": 3072,
    "avgFileSizeBytes": 2147483
  }
}
```

---

### 4.2 Audit Activity Summary

Get summary of audit activity for security monitoring.

**Endpoint**: `GET /guest-checkin/audit-logs/summary`  
**Auth Required**: Yes (Admin, Owner)

**Query Parameters**:
- `startDate` (optional): Start date
- `endDate` (optional): End date

**Example Request**:
```bash
curl -X GET "http://localhost:4000/guest-checkin/audit-logs/summary?\
startDate=2025-10-01T00:00:00Z&\
endDate=2025-10-10T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN"
```

**Response** (200 OK):
```json
{
  "totalActions": 5000,
  "byActionType": {
    "create_checkin": 500,
    "update_checkin": 200,
    "view_guest_details": 1500,
    "view_documents": 800,
    "download_document": 300,
    "delete_document": 50,
    "checkout_guest": 450,
    "unauthorized_access_attempt": 10
  },
  "byUser": [
    {
      "userId": 10,
      "email": "manager@hotel.com",
      "totalActions": 2000,
      "mostCommonAction": "view_guest_details"
    }
  ],
  "securityAlerts": {
    "unauthorizedAttempts": 10,
    "failedActions": 25,
    "unusualActivity": []
  }
}
```

---

## 5. Error Handling

### Standard Error Response Format

All API errors follow this format:

```typescript
interface ErrorResponse {
  error: string; // Machine-readable error code
  message: string; // Human-readable error message
  code: string; // Application-specific error code
  details?: Record<string, any>; // Additional error details
  timestamp: string;
  requestId: string; // For support/debugging
}
```

### Common Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `invalid_request` | Malformed request body or parameters |
| 400 | `invalid_file` | File validation failed |
| 400 | `file_too_large` | File exceeds size limit |
| 401 | `unauthorized` | Missing or invalid auth token |
| 403 | `forbidden` | User lacks required permissions |
| 404 | `not_found` | Resource not found |
| 409 | `conflict` | Resource already exists or constraint violation |
| 413 | `payload_too_large` | Request body exceeds limit |
| 429 | `rate_limit_exceeded` | Too many requests |
| 500 | `internal_error` | Server error |
| 503 | `service_unavailable` | LLM service or external dependency down |

---

## 6. Rate Limiting

| Endpoint Category | Rate Limit | Window |
|-------------------|------------|--------|
| Document Upload | 10 requests | 1 minute |
| Document View/Download | 100 requests | 1 minute |
| Audit Log Queries | 20 requests | 1 minute |
| All Other Endpoints | 100 requests | 1 minute |

**Rate Limit Headers**:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1696950000
```

---

## 7. Webhooks (Future Enhancement)

For future integration, consider webhooks for async events:

- `document.extraction.completed`
- `document.extraction.failed`
- `audit.suspicious_activity_detected`

---

## Summary

This API specification provides:

✅ **Complete Document Management**: Upload, view, download, delete guest documents  
✅ **LLM Integration**: Automatic text extraction with confidence scores  
✅ **Comprehensive Audit Trail**: Track all actions with detailed context  
✅ **Enhanced Check-in Flow**: Seamless integration with existing check-in process  
✅ **Statistics & Analytics**: Monitor extraction success and audit activity  
✅ **RESTful Design**: Standard HTTP methods and status codes  
✅ **Security First**: JWT auth, signed URLs, rate limiting, audit logging  
✅ **Error Handling**: Consistent error responses with actionable messages  
✅ **Scalability**: Pagination, filtering, efficient queries

