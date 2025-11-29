# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-01-29-document-export-microservice/spec.md

## Technical Requirements

### Microservice Architecture

- **Service Boundary**: Standalone Encore service `documents` with independent database connection and storage bucket
- **Database**: Reuse `hospitality` SQLDatabase with dedicated `document_exports` table for export metadata
- **Storage**: New `documentExportsBucket` (private) in `backend/storage/buckets.ts` with signed URL support
- **API Contracts**: Typed Request/Response interfaces following `encore-api-patterns` with auth middleware
- **Client Integration**: Services call Documents APIs via Encore internal client, not direct database access

### Browser Pool Implementation

- **Library**: Puppeteer (headless Chromium) with `puppeteer-core` for production
- **Pool Size**: 5 concurrent browser instances max, using bulkhead pattern from `backend/resilience/bulkhead.ts`
- **Timeout**: 30-second render timeout per document with graceful fallback
- **Lifecycle**: Lazy initialization on first export, graceful shutdown on process termination
- **Memory**: Cap at 500MB per instance, restart browser if threshold exceeded

### Template System

- **Engine**: Handlebars 4.7+ with precompiled templates for performance
- **Location**: `backend/documents/templates/*.hbs` with shared `partials/` and `helpers/`
- **Templates Required**:
  - `daily-report.hbs` - Daily cash balance PDF
  - `monthly-report.hbs` - Monthly spreadsheet PDF
  - `yearly-report.hbs` - Annual summary PDF
  - `staff-leave.hbs` - Leave records PDF
  - `staff-attendance.hbs` - Attendance records PDF
  - `staff-salary.hbs` - Salary/payslip PDF
- **Helpers**: `formatCurrency`, `formatDate`, `formatPercentage`, `conditionalStyle` for consistent rendering
- **Styling**: Inline CSS for PDF compatibility, Tailwind-inspired utility classes

### Export Lifecycle States

```typescript
type ExportStatus = 'queued' | 'processing' | 'ready' | 'failed' | 'expired';

interface DocumentExport {
  id: number;
  exportId: string; // UUID for public reference
  orgId: number;
  userId: number;
  exportType: 'daily-report' | 'monthly-report' | 'yearly-report' | 'staff-leave' | 'staff-attendance' | 'staff-salary';
  format: 'pdf' | 'xlsx';
  status: ExportStatus;
  bucketKey: string | null;
  fileSizeBytes: number | null;
  expiresAt: Date;
  metadata: Record<string, any>; // Request params for retry
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### API Endpoints

**POST /documents/exports/create**
- Creates export record, queues rendering job, returns exportId
- Auth: Required, roles: ADMIN, MANAGER
- Params: `{ type, format, data, templateOverride? }`
- Response: `{ exportId, status, estimatedSeconds }`

**GET /documents/exports/:exportId/status**
- Polls export progress
- Auth: Required, must own export
- Response: `{ status, progress?, downloadUrl?, expiresAt? }`

**GET /documents/exports/:exportId/download**
- Streams file from bucket or returns signed URL
- Auth: Required, must own export
- Response: Binary stream or `{ signedUrl, expiresIn }`

**POST /documents/exports/:exportId/retry**
- Requeues failed export
- Auth: Required, roles: ADMIN
- Response: `{ exportId, status }`

### Performance Targets

- **PDF Generation**: <3 seconds for 100 transactions (typical daily report)
- **Excel Generation**: <2 seconds for 1000 rows (monthly staff data)
- **Concurrent Capacity**: Handle 10 simultaneous export requests without queue overflow
- **Memory Footprint**: <500MB per Puppeteer instance, <100MB for service logic
- **Throughput**: Process 50+ exports/minute under sustained load

### Error Handling

- **Render Failures**: Capture screenshots, log template data, mark export as failed with user-friendly message
- **Timeout**: Kill page after 30s, return partial data or error depending on context
- **Pool Saturation**: Return 429 status with retry-after header if queue full
- **Storage Errors**: Retry bucket upload 3x with exponential backoff before failing
- **Template Errors**: Validate data schema before rendering, log detailed compilation errors

### Observability

- **Structured Logs**: JSON logs with `exportId`, `orgId`, `renderDurationMs`, `status` for all operations
- **Metrics**: Expose counters for exports created/completed/failed, gauge for pool utilization, histogram for render times
- **Tracing**: Encore automatic tracing captures end-to-end latency across service boundaries

## External Dependencies

- **puppeteer**: ^21.0.0 - Headless browser automation
- **handlebars**: ^4.7.8 - Template compilation
- **@types/puppeteer**: ^5.4.7 - TypeScript definitions
- **@types/handlebars**: ^4.1.0 - TypeScript definitions

**Justification**: Puppeteer provides W3C-compliant PDF rendering with CSS support superior to `pdfkit`. Handlebars offers logic-less templates with security by default (no eval), unlike inline HTML strings. These dependencies align with the production-grade requirement and are widely adopted in Node.js ecosystems.

