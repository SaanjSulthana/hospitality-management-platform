# Spec Requirements Document

> Spec: Guest Document Upload with LLM Extraction & Audit Logging
> Created: 2025-10-10

## Overview

Implement intelligent document processing for guest check-ins that uses LLM-based OCR to automatically extract guest information from uploaded ID documents (Aadhaar, passport, visa, PAN cards), stores the document images securely, and maintains comprehensive audit logs tracking all admin and manager actions on guest data. This feature will streamline the check-in process, reduce manual data entry errors, ensure compliance with document retention requirements, and provide full accountability for sensitive guest information access.

## User Stories

### Story 1: Automated Guest Information Extraction

**As a** property manager checking in a guest, **I want to** upload a photo of their ID document and have all information automatically extracted and filled into the form, **so that** I can complete check-ins faster with fewer data entry errors.

**Workflow:**
1. Manager selects guest type (Indian/Foreign) on check-in page
2. Manager clicks "Upload Aadhaar/Passport" button and selects image from device or takes a photo
3. System uploads image to backend and sends to LLM service for text extraction
4. LLM analyzes image and extracts: name, document number, address, date of birth, nationality, etc.
5. Extracted data automatically populates the check-in form fields
6. Manager reviews auto-filled data, makes corrections if needed, and completes check-in
7. Original document image is stored securely and linked to the guest record

### Story 2: Document Viewer with Audit Trail

**As an** admin reviewing guest records, **I want to** view uploaded ID documents while having all my actions automatically logged, **so that** we maintain compliance with data protection regulations and have full accountability for who accesses sensitive information.

**Workflow:**
1. Admin navigates to Guest Details page and selects a checked-in guest
2. Admin clicks "View Documents" button to see uploaded ID images
3. System displays document viewer modal showing all uploaded documents (front/back of ID)
4. System automatically logs: admin user ID, timestamp, guest ID, action type ("view_documents")
5. Admin can zoom, download, or print documents as needed
6. All interactions are logged with timestamps
7. Admin can view audit history showing who accessed this guest's information and when

### Story 3: Manager Action Accountability

**As a** hotel owner, **I want to** see a complete audit trail of all actions performed by managers and admins on guest records, **so that** I can ensure staff are following proper procedures and investigate any potential data breaches or misuse.

**Workflow:**
1. Owner navigates to Guest Check-in > Audit Logs tab
2. System displays filterable table showing all audit entries:
   - User name and role
   - Action performed (view, update, checkout, view_documents, download_document)
   - Guest name affected
   - Timestamp (precise to the second)
   - Additional context (e.g., which fields were updated)
3. Owner can filter by date range, user, guest, or action type
4. Owner can export audit logs to CSV for compliance reporting
5. System retains audit logs indefinitely for regulatory compliance

## Spec Scope

1. **LLM-Powered Document OCR** - Integration with OpenAI GPT-4 Vision API to extract structured data from ID document images with field-level confidence scores.

2. **Multi-Document Upload System** - Allow uploading multiple document images per guest (Aadhaar front/back, passport, visa, PAN card) with image preview, validation, and management.

3. **Guest Documents Database** - New table to store document metadata (type, file path, upload timestamp, extracted data JSON, confidence scores) with foreign key to guest_checkins.

4. **Comprehensive Audit Logging** - Track all CRUD operations and document views with user ID, timestamp, action type, IP address, and before/after states for updates.

5. **Document Viewer UI** - Modal interface for viewing guest documents with zoom, rotate, download capabilities, accessible from guest details page.

6. **Enhanced API Endpoints** - New endpoints for document upload with LLM processing, document retrieval, document deletion, and audit log querying.

7. **Frontend Integration** - Update GuestCheckInPage with file upload components, auto-fill functionality, document viewer modal, and audit log display.

8. **Role-Based Document Access** - Only admin and manager roles can view/download guest documents; all access attempts are logged regardless of permission level.

## Out of Scope

- Real-time document verification with government databases (UIDAI for Aadhaar, passport authorities)
- Facial recognition to match photo on ID with live guest photo
- Blockchain-based document verification
- Multi-language OCR support (focus on English and Hindi for Aadhaar)
- Document expiry date tracking and alerts
- Integration with third-party identity verification services (Onfido, Jumio)
- Automatic redaction of sensitive information in logs
- GDPR right-to-erasure automated document deletion

## Expected Deliverable

1. **Functional Document Upload with LLM Extraction** - Successfully upload an Aadhaar card image, have GPT-4 Vision extract name, Aadhaar number, and address, and see the check-in form automatically populated with extracted data (visible in browser at `/guest-checkin`).

2. **Complete Audit Trail** - After an admin views a guest's documents and checks them out, navigate to the Audit Logs page and see timestamped entries showing "view_documents" and "checkout_guest" actions with the admin's name (testable at `/guest-checkin?tab=audit-logs`).

3. **Document Viewer Functionality** - Click on a guest record, open the document viewer modal, see uploaded Aadhaar front/back images with zoom controls, and verify that the view action appears in the audit log within 2 seconds (testable in browser DevTools Network tab and database query).

