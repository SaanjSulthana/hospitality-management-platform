# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-01-29-document-export-microservice/spec.md

## Endpoints

### POST /documents/exports/create

**Purpose:** Create a new document export job and queue it for processing

**Authentication:** Required (ADMIN, MANAGER roles)

**Parameters:**
```typescript
interface CreateExportRequest {
  exportType: 'daily-report' | 'monthly-report' | 'yearly-report' | 'staff-leave' | 'staff-attendance' | 'staff-salary';
  format: 'pdf' | 'xlsx';
  data: Record<string, any>; // Type-specific data payload
  templateOverride?: string; // Optional custom template name
}
```

**Response:**
```typescript
interface CreateExportResponse {
  exportId: string; // UUID for status tracking
  status: 'queued';
  estimatedSeconds: number;
  createdAt: Date;
}
```

**Errors:**
- `401 Unauthorized`: Missing/invalid auth token
- `403 Forbidden`: Insufficient role permissions
- `400 Bad Request`: Invalid exportType/format/data schema
- `429 Too Many Requests`: Export queue full (>50 pending)

---

### GET /documents/exports/:exportId/status

**Purpose:** Check export job progress and retrieve download information

**Authentication:** Required (must own export or be ADMIN)

**Parameters:**
- `exportId` (path): UUID string

**Response:**
```typescript
interface ExportStatusResponse {
  exportId: string;
  status: 'queued' | 'processing' | 'ready' | 'failed' | 'expired';
  progress?: number; // 0-100 for processing state
  downloadUrl?: string; // Signed URL when ready
  fileSizeBytes?: number;
  expiresAt?: Date; // When ready
  errorMessage?: string; // When failed
  createdAt: Date;
  updatedAt: Date;
}
```

**Errors:**
- `401 Unauthorized`: Missing/invalid auth token
- `403 Forbidden`: User doesn't own export
- `404 Not Found`: Invalid exportId

---

### GET /documents/exports/:exportId/download

**Purpose:** Download generated document via streaming or signed URL

**Authentication:** Required (must own export or be ADMIN)

**Parameters:**
- `exportId` (path): UUID string
- `useSignedUrl` (query, optional): Return URL instead of streaming (default: false for <5MB, true for ≥5MB)

**Response (Stream Mode):**
- Content-Type: `application/pdf` or `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Content-Disposition: `attachment; filename="{export_type}_{date}.{format}"`
- Body: Binary file stream

**Response (Signed URL Mode):**
```typescript
interface DownloadResponse {
  signedUrl: string; // Valid for 1 hour
  expiresIn: number; // Seconds
  fileSizeBytes: number;
  filename: string;
}
```

**Errors:**
- `401 Unauthorized`: Missing/invalid auth token
- `403 Forbidden`: User doesn't own export
- `404 Not Found`: Export not found or expired
- `409 Conflict`: Export not ready (status != 'ready')

---

### POST /documents/exports/:exportId/retry

**Purpose:** Retry a failed export job

**Authentication:** Required (ADMIN role only)

**Parameters:**
- `exportId` (path): UUID string

**Response:**
```typescript
interface RetryExportResponse {
  exportId: string;
  status: 'queued';
  retryCount: number;
  createdAt: Date;
}
```

**Errors:**
- `401 Unauthorized`: Missing/invalid auth token
- `403 Forbidden`: Non-ADMIN user
- `404 Not Found`: Invalid exportId
- `400 Bad Request`: Export not in failed state
- `429 Too Many Requests`: Max retries exceeded (>3)

---

### DELETE /documents/exports/:exportId

**Purpose:** Manually delete an export before expiration

**Authentication:** Required (must own export or be ADMIN)

**Parameters:**
- `exportId` (path): UUID string

**Response:**
```typescript
interface DeleteExportResponse {
  exportId: string;
  deletedAt: Date;
  message: string;
}
```

**Errors:**
- `401 Unauthorized`: Missing/invalid auth token
- `403 Forbidden`: User doesn't own export
- `404 Not Found`: Export already deleted or doesn't exist

---

### GET /documents/exports

**Purpose:** List user's exports with filtering/pagination

**Authentication:** Required

**Parameters (Query):**
- `status` (optional): Filter by status
- `exportType` (optional): Filter by type
- `limit` (optional): Max 100, default 20
- `offset` (optional): Pagination offset

**Response:**
```typescript
interface ListExportsResponse {
  exports: ExportStatusResponse[];
  total: number;
  limit: number;
  offset: number;
}
```

---

## Integration Patterns

### Reports Service Integration

```typescript
// backend/reports/daily_reports.ts
export const exportDailyReportPDF = api(/*...*/async (req) => {
  const authData = getAuthData()!;
  const reportData = await getDailyReportData(req.propertyId, req.date, authData.orgId, authData);
  
  // Call Documents service
  const documentsClient = new DocumentsClient();
  const exportResponse = await documentsClient.createExport({
    exportType: 'daily-report',
    format: 'pdf',
    data: reportData
  });
  
  return {
    exportId: exportResponse.exportId,
    status: exportResponse.status,
    estimatedSeconds: exportResponse.estimatedSeconds
  };
});
```

### Staff Service Integration

```typescript
// backend/staff/export_leave.ts
export const exportLeave = api(/*...*/async (req) => {
  const leaveData = await fetchLeaveData(req); // Normalized DTO
  
  const documentsClient = new DocumentsClient();
  const exportResponse = await documentsClient.createExport({
    exportType: 'staff-leave',
    format: req.format, // 'pdf' | 'xlsx'
    data: {
      records: leaveData,
      filters: req,
      generatedAt: new Date()
    }
  });
  
  return exportResponse;
});
```

