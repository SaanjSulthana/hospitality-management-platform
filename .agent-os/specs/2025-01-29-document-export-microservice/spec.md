# Spec Requirements Document

> Spec: Document Export Microservice
> Created: 2025-01-29

## Overview

Implement a production-ready document export microservice that transforms existing placeholder PDF/Excel generation into a scalable, templated rendering system with browser pooling, object storage streaming, and automatic cleanup. This replaces base64-encoded, memory-bound exports with a resilient architecture capable of handling concurrent requests while maintaining sub-3-second PDF generation and sub-2-second Excel rendering for typical datasets.

## User Stories

### Export Manager Story

As a **Finance Manager**, I want to export daily cash balance reports as PDF or Excel with professional formatting, so that I can share financial summaries with stakeholders without manual reformatting or performance delays.

**Workflow**: Manager navigates to Reports page, selects date/property filters, clicks "Export PDF" → system queues export job → displays progress indicator → provides download link when ready → file auto-expires after 24 hours.

**Problem Solved**: Eliminates base64 memory limits, provides consistent branding via templates, and prevents browser crashes from large datasets.

### Staff Administrator Story

As an **HR Administrator**, I want to bulk export staff attendance, leave, and salary records in Excel or PDF format with proper data validation, so that I can audit payroll and compliance without writing custom scripts.

**Workflow**: Admin accesses Staff Management, applies filters (date range, department, status), selects export format → system generates file with all records → downloads via secure signed URL → expired exports are cleaned automatically.

**Problem Solved**: Completes previously stubbed-out staff export endpoints, ensures data integrity through templates, and provides audit trails via export metadata.

### System Reliability Story

As a **Platform Engineer**, I want document generation to use pooled browser instances with circuit breakers and automatic cleanup, so that the system remains responsive under load and doesn't leak resources.

**Workflow**: Multiple users trigger simultaneous exports → browser pool queues requests (max 5 concurrent) → failed renders retry with backoff → cron job removes old files → observability metrics track pool utilization.

**Problem Solved**: Prevents Puppeteer memory leaks, enforces timeout/retry policies, and maintains system health through lifecycle management.

## Spec Scope

1. **Dedicated Microservice** - Standalone Encore service (`backend/documents`) with isolated database and storage, following bounded context principles for document lifecycle management.

2. **Browser Pooling** - Shared Puppeteer instance pool (5 concurrent max) with timeout enforcement (30s), graceful degradation, and automatic page cleanup to prevent memory leaks.

3. **Template System** - Handlebars-based HTML templates with partials, helpers, and consistent styling for reports (daily/monthly/yearly) and staff exports (leave/attendance/salary).

4. **Object Storage Integration** - Encore Bucket storage for generated documents with signed URL access, streaming downloads for files >5MB, and expiration policies (24-hour TTL).

5. **Export Lifecycle** - State machine (queued → processing → ready → expired/failed) with database tracking, retry logic, and status polling endpoints for frontend integration.

6. **Excel Generation** - `xlsx` library integration with shared formatters and multi-sheet support, mirroring PDF template sections for data consistency.

7. **Cleanup Automation** - Cron job to purge expired exports (>24h old) from both database and object storage, with logging and error recovery.

## Out of Scope

- Real-time collaborative document editing
- Custom template creation by end users (templates are code-defined)
- Document versioning or revision history
- OCR or document parsing (only generation)
- Integration with third-party document services (DocuSign, HelloSign)
- Support for formats beyond PDF and Excel (no Word, PowerPoint, etc.)

## Expected Deliverable

1. **Functional Exports**: All report and staff export endpoints return valid PDF/Excel files via signed URLs within performance targets (<3s for 100-transaction PDFs, <2s for 1000-row Excel).

2. **Resource Management**: Browser pool maintains <500MB memory per instance, handles 10+ concurrent export requests without degradation, and releases resources on completion/timeout.

3. **Data Consistency**: Generated documents match source data exactly, with proper currency formatting (INR), date localization (IST), and organizational branding across all templates.

