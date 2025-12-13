# Product Brief — Hospitality Management Platform

Last updated: 2025-12-09

## Snapshot

- **Services:** 29
- **Endpoints:** 608
- **Databases:** 7
- **Storage buckets:** 5
- **Realtime:** v2 unified streaming; v1 long-poll for compatibility

## What this platform does

- Unified, multi-tenant hospitality operations: properties, guests, staff, tasks, and branding
- Finance-grade ledgers for revenues and expenses with approvals and audit
- Real-time updates for dashboards, finance, and operational domains
- Document handling: uploads, exports, and guest identity verification
- Observability, health, and scheduled maintenance built-in

## Core capabilities by domain

- **Auth:** signup, login, refresh, sessions, me; role and org scoped access.
- **Finance:** revenues, expenses, approvals, summaries, notifications, partitioned tables.
- **Reports:** daily, monthly, quarterly, yearly, reconciliation, exports to PDF and Excel.
- **Guest check-in:** check-ins, document upload, extraction-only flows, audit logs, realtime signals.
- **Staff:** scheduling, attendance, leave, payroll exports.
- **Tasks:** creation, assignment, hours, image attachments.
- **Properties and users:** CRUD, occupancy, assignments.
- **Uploads and documents:** secure file storage, signed URLs, export lifecycle.
- **Monitoring:** health, liveness, readiness, unified metrics, partition verification.
- **Realtime:** v2 unified stream with dynamic subscription and credit flow control.