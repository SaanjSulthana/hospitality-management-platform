# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-10-10-guest-document-llm-extraction/spec.md

## Overview

This schema introduces two new tables: `guest_documents` for storing uploaded ID document metadata and images, and `guest_audit_logs` for comprehensive audit trail of all actions on guest records. The schema maintains foreign key relationships with existing `guest_checkins` and `users` tables.

---

## New Tables

### 1. guest_documents

Stores metadata and file information for all uploaded guest identification documents.

```sql
CREATE TABLE guest_documents (
  id BIGSERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  guest_checkin_id INTEGER NOT NULL,
  
  -- Document Classification
  document_type VARCHAR(50) NOT NULL CHECK (
    document_type IN (
      'aadhaar_front', 
      'aadhaar_back', 
      'pan_card', 
      'passport', 
      'visa_front', 
      'visa_back',
      'other'
    )
  ),
  
  -- File Information
  filename VARCHAR(500) NOT NULL,
  original_filename VARCHAR(500) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  
  -- Image Metadata
  thumbnail_path TEXT,
  image_width INTEGER,
  image_height INTEGER,
  
  -- LLM Extraction Results
  extracted_data JSONB,
  -- Example structure:
  -- {
  --   "fullName": {"value": "John Doe", "confidence": 95},
  --   "aadharNumber": {"value": "1234 5678 9012", "confidence": 98},
  --   "address": {"value": "123 Main St", "confidence": 85}
  -- }
  
  overall_confidence INTEGER CHECK (overall_confidence BETWEEN 0 AND 100),
  extraction_status VARCHAR(50) DEFAULT 'pending' CHECK (
    extraction_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')
  ),
  extraction_error TEXT,
  extraction_processed_at TIMESTAMPTZ,
  
  -- Access Control
  is_verified BOOLEAN DEFAULT FALSE,
  verified_by_user_id INTEGER,
  verified_at TIMESTAMPTZ,
  
  -- Audit Fields
  uploaded_by_user_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ, -- Soft delete
  deleted_by_user_id INTEGER,
  
  -- Foreign Keys
  CONSTRAINT fk_guest_documents_checkin 
    FOREIGN KEY (guest_checkin_id) 
    REFERENCES guest_checkins(id) 
    ON DELETE CASCADE,
  
  CONSTRAINT fk_guest_documents_uploaded_by 
    FOREIGN KEY (uploaded_by_user_id) 
    REFERENCES users(id) 
    ON DELETE SET NULL,
  
  CONSTRAINT fk_guest_documents_verified_by 
    FOREIGN KEY (verified_by_user_id) 
    REFERENCES users(id) 
    ON DELETE SET NULL,
    
  CONSTRAINT fk_guest_documents_deleted_by 
    FOREIGN KEY (deleted_by_user_id) 
    REFERENCES users(id) 
    ON DELETE SET NULL
);

-- Indexes for Performance
CREATE INDEX idx_guest_documents_org_id 
  ON guest_documents(org_id);

CREATE INDEX idx_guest_documents_checkin_id 
  ON guest_documents(guest_checkin_id);

CREATE INDEX idx_guest_documents_document_type 
  ON guest_documents(document_type);

CREATE INDEX idx_guest_documents_extraction_status 
  ON guest_documents(extraction_status);

CREATE INDEX idx_guest_documents_created_at 
  ON guest_documents(created_at DESC);

CREATE INDEX idx_guest_documents_uploaded_by 
  ON guest_documents(uploaded_by_user_id);

-- GIN index for JSON search on extracted_data
CREATE INDEX idx_guest_documents_extracted_data 
  ON guest_documents USING GIN (extracted_data);

-- Index for soft delete queries
CREATE INDEX idx_guest_documents_deleted_at 
  ON guest_documents(deleted_at) 
  WHERE deleted_at IS NULL;

-- Comment
COMMENT ON TABLE guest_documents IS 
  'Stores uploaded guest identification documents with LLM extraction results';
```

**Rationale:**
- **JSONB for extracted_data**: Flexible storage for varying document fields (Aadhaar has different fields than passport). GIN index enables fast searches within JSON.
- **Soft Delete**: Regulatory compliance often requires document retention even after deletion requests. `deleted_at` allows marking as deleted without physical removal.
- **Confidence Tracking**: Stores per-field and overall confidence scores to indicate data quality and flag fields needing manual verification.
- **Extraction Status**: Tracks async processing state for LLM extraction (pending → processing → completed/failed).
- **Cascade Delete**: When guest check-in is deleted, all associated documents are automatically deleted (or soft-deleted if business logic requires).

---

### 2. guest_audit_logs

Comprehensive audit trail for all actions performed on guest check-in records and documents.

```sql
CREATE TABLE guest_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  
  -- User Information
  user_id INTEGER NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  user_role VARCHAR(50) NOT NULL,
  
  -- Action Information
  action_type VARCHAR(100) NOT NULL CHECK (
    action_type IN (
      -- Guest Check-in Actions
      'create_checkin',
      'update_checkin',
      'delete_checkin',
      'checkout_guest',
      'view_guest_details',
      
      -- Document Actions
      'upload_document',
      'view_documents',
      'view_document',
      'download_document',
      'delete_document',
      'verify_document',
      
      -- Audit Actions
      'query_audit_logs',
      'export_audit_logs',
      
      -- Failed Attempts
      'unauthorized_access_attempt'
    )
  ),
  
  -- Resource Information
  resource_type VARCHAR(50) NOT NULL CHECK (
    resource_type IN ('guest_checkin', 'guest_document', 'audit_log')
  ),
  resource_id BIGINT,
  guest_checkin_id INTEGER,
  guest_name VARCHAR(255),
  
  -- Request Context
  ip_address VARCHAR(45), -- IPv4 (15) or IPv6 (45)
  user_agent TEXT,
  request_method VARCHAR(10),
  request_path TEXT,
  
  -- Action Details
  action_details JSONB,
  -- Example structures:
  -- For update_checkin:
  -- {
  --   "changedFields": {
  --     "roomNumber": {"before": "101", "after": "102"},
  --     "numberOfGuests": {"before": 1, "after": 2}
  --   }
  -- }
  --
  -- For view_document:
  -- {
  --   "documentId": 123,
  --   "documentType": "aadhaar_front",
  --   "viewDuration": 45 // seconds
  -- }
  --
  -- For unauthorized_access_attempt:
  -- {
  --   "attemptedAction": "view_documents",
  --   "guestCheckInId": 456,
  --   "deniedReason": "insufficient_permissions"
  -- }
  
  -- Result Information
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT,
  
  -- Timing
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER, -- Request duration in milliseconds
  
  -- Foreign Keys (nullable because user/guest may be deleted)
  CONSTRAINT fk_guest_audit_logs_user 
    FOREIGN KEY (user_id) 
    REFERENCES users(id) 
    ON DELETE SET NULL,
  
  CONSTRAINT fk_guest_audit_logs_checkin 
    FOREIGN KEY (guest_checkin_id) 
    REFERENCES guest_checkins(id) 
    ON DELETE SET NULL
);

-- Indexes for Performance
CREATE INDEX idx_guest_audit_logs_org_id 
  ON guest_audit_logs(org_id);

CREATE INDEX idx_guest_audit_logs_user_id 
  ON guest_audit_logs(user_id);

CREATE INDEX idx_guest_audit_logs_action_type 
  ON guest_audit_logs(action_type);

CREATE INDEX idx_guest_audit_logs_resource_type 
  ON guest_audit_logs(resource_type);

CREATE INDEX idx_guest_audit_logs_guest_checkin_id 
  ON guest_audit_logs(guest_checkin_id);

CREATE INDEX idx_guest_audit_logs_timestamp 
  ON guest_audit_logs(timestamp DESC);

-- Composite index for common query pattern: filter by org, date range, action type
CREATE INDEX idx_guest_audit_logs_org_timestamp_action 
  ON guest_audit_logs(org_id, timestamp DESC, action_type);

-- Composite index for user activity queries
CREATE INDEX idx_guest_audit_logs_user_timestamp 
  ON guest_audit_logs(user_id, timestamp DESC);

-- GIN index for JSON search on action_details
CREATE INDEX idx_guest_audit_logs_action_details 
  ON guest_audit_logs USING GIN (action_details);

-- Index for failed actions
CREATE INDEX idx_guest_audit_logs_failed 
  ON guest_audit_logs(success, timestamp DESC) 
  WHERE success = FALSE;

-- Comment
COMMENT ON TABLE guest_audit_logs IS 
  'Complete audit trail of all actions on guest check-ins and documents for compliance';
```

**Rationale:**
- **Denormalized Data**: Stores `user_email`, `user_role`, `guest_name` directly instead of only IDs. This ensures audit integrity even if users or guests are deleted (critical for legal/compliance investigations).
- **JSONB for action_details**: Flexible storage for varying action contexts. Different actions require different details. GIN index enables searching within JSON fields.
- **IP Address & User Agent**: Tracks request source for security investigations and fraud detection.
- **Duration Tracking**: Helps identify performance issues and unusual activity (e.g., very long document view times).
- **Composite Indexes**: Optimized for common query patterns (e.g., "show all actions by this user in the last 30 days").
- **Failed Action Logging**: Records unauthorized access attempts for security monitoring.

---

## Modified Tables

### guest_checkins (Existing Table)

**New Column Additions:**

```sql
-- Add column to track if guest data was auto-filled from document extraction
ALTER TABLE guest_checkins 
ADD COLUMN data_source VARCHAR(50) DEFAULT 'manual' CHECK (
  data_source IN ('manual', 'aadhaar_scan', 'passport_scan', 'pan_scan', 'visa_scan', 'mixed')
);

-- Add column to track data verification status
ALTER TABLE guest_checkins 
ADD COLUMN data_verified BOOLEAN DEFAULT FALSE;

-- Add column to track who verified the data
ALTER TABLE guest_checkins 
ADD COLUMN verified_by_user_id INTEGER;

-- Add column to track when data was verified
ALTER TABLE guest_checkins 
ADD COLUMN verified_at TIMESTAMPTZ;

-- Add foreign key for verified_by_user_id
ALTER TABLE guest_checkins 
ADD CONSTRAINT fk_guest_checkins_verified_by 
  FOREIGN KEY (verified_by_user_id) 
  REFERENCES users(id) 
  ON DELETE SET NULL;

-- Add index for verification queries
CREATE INDEX idx_guest_checkins_data_verified 
  ON guest_checkins(data_verified);

-- Comment
COMMENT ON COLUMN guest_checkins.data_source IS 
  'Indicates how guest data was entered (manual typing vs automated extraction)';
COMMENT ON COLUMN guest_checkins.data_verified IS 
  'Indicates whether auto-filled data has been manually verified by staff';
```

**Rationale:**
- **data_source**: Tracks how information was entered. Useful for quality analysis (e.g., "auto-scanned data has 95% accuracy vs manual entry").
- **data_verified**: Compliance requirement to track that auto-extracted data was reviewed by human staff member.
- **verified_by_user_id**: Accountability for who approved the data (important for legal disputes).

---

## Database Migration Files

### Migration: 2_add_guest_documents_and_audit_logs.up.sql

```sql
-- Migration: Add guest documents and audit logging
-- Version: 2
-- Date: 2025-10-10

BEGIN;

-- ============================================================================
-- 1. Create guest_documents table
-- ============================================================================

CREATE TABLE IF NOT EXISTS guest_documents (
  id BIGSERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  guest_checkin_id INTEGER NOT NULL,
  
  document_type VARCHAR(50) NOT NULL CHECK (
    document_type IN (
      'aadhaar_front', 
      'aadhaar_back', 
      'pan_card', 
      'passport', 
      'visa_front', 
      'visa_back',
      'other'
    )
  ),
  
  filename VARCHAR(500) NOT NULL,
  original_filename VARCHAR(500) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  
  thumbnail_path TEXT,
  image_width INTEGER,
  image_height INTEGER,
  
  extracted_data JSONB,
  overall_confidence INTEGER CHECK (overall_confidence BETWEEN 0 AND 100),
  extraction_status VARCHAR(50) DEFAULT 'pending' CHECK (
    extraction_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')
  ),
  extraction_error TEXT,
  extraction_processed_at TIMESTAMPTZ,
  
  is_verified BOOLEAN DEFAULT FALSE,
  verified_by_user_id INTEGER,
  verified_at TIMESTAMPTZ,
  
  uploaded_by_user_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_by_user_id INTEGER,
  
  CONSTRAINT fk_guest_documents_checkin 
    FOREIGN KEY (guest_checkin_id) 
    REFERENCES guest_checkins(id) 
    ON DELETE CASCADE,
  
  CONSTRAINT fk_guest_documents_uploaded_by 
    FOREIGN KEY (uploaded_by_user_id) 
    REFERENCES users(id) 
    ON DELETE SET NULL,
  
  CONSTRAINT fk_guest_documents_verified_by 
    FOREIGN KEY (verified_by_user_id) 
    REFERENCES users(id) 
    ON DELETE SET NULL,
    
  CONSTRAINT fk_guest_documents_deleted_by 
    FOREIGN KEY (deleted_by_user_id) 
    REFERENCES users(id) 
    ON DELETE SET NULL
);

-- Indexes for guest_documents
CREATE INDEX idx_guest_documents_org_id ON guest_documents(org_id);
CREATE INDEX idx_guest_documents_checkin_id ON guest_documents(guest_checkin_id);
CREATE INDEX idx_guest_documents_document_type ON guest_documents(document_type);
CREATE INDEX idx_guest_documents_extraction_status ON guest_documents(extraction_status);
CREATE INDEX idx_guest_documents_created_at ON guest_documents(created_at DESC);
CREATE INDEX idx_guest_documents_uploaded_by ON guest_documents(uploaded_by_user_id);
CREATE INDEX idx_guest_documents_extracted_data ON guest_documents USING GIN (extracted_data);
CREATE INDEX idx_guest_documents_deleted_at ON guest_documents(deleted_at) WHERE deleted_at IS NULL;

COMMENT ON TABLE guest_documents IS 
  'Stores uploaded guest identification documents with LLM extraction results';

-- ============================================================================
-- 2. Create guest_audit_logs table
-- ============================================================================

CREATE TABLE IF NOT EXISTS guest_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  
  user_id INTEGER NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  user_role VARCHAR(50) NOT NULL,
  
  action_type VARCHAR(100) NOT NULL CHECK (
    action_type IN (
      'create_checkin', 'update_checkin', 'delete_checkin', 'checkout_guest', 'view_guest_details',
      'upload_document', 'view_documents', 'view_document', 'download_document', 
      'delete_document', 'verify_document',
      'query_audit_logs', 'export_audit_logs',
      'unauthorized_access_attempt'
    )
  ),
  
  resource_type VARCHAR(50) NOT NULL CHECK (
    resource_type IN ('guest_checkin', 'guest_document', 'audit_log')
  ),
  resource_id BIGINT,
  guest_checkin_id INTEGER,
  guest_name VARCHAR(255),
  
  ip_address VARCHAR(45),
  user_agent TEXT,
  request_method VARCHAR(10),
  request_path TEXT,
  
  action_details JSONB,
  
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT,
  
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER,
  
  CONSTRAINT fk_guest_audit_logs_user 
    FOREIGN KEY (user_id) 
    REFERENCES users(id) 
    ON DELETE SET NULL,
  
  CONSTRAINT fk_guest_audit_logs_checkin 
    FOREIGN KEY (guest_checkin_id) 
    REFERENCES guest_checkins(id) 
    ON DELETE SET NULL
);

-- Indexes for guest_audit_logs
CREATE INDEX idx_guest_audit_logs_org_id ON guest_audit_logs(org_id);
CREATE INDEX idx_guest_audit_logs_user_id ON guest_audit_logs(user_id);
CREATE INDEX idx_guest_audit_logs_action_type ON guest_audit_logs(action_type);
CREATE INDEX idx_guest_audit_logs_resource_type ON guest_audit_logs(resource_type);
CREATE INDEX idx_guest_audit_logs_guest_checkin_id ON guest_audit_logs(guest_checkin_id);
CREATE INDEX idx_guest_audit_logs_timestamp ON guest_audit_logs(timestamp DESC);
CREATE INDEX idx_guest_audit_logs_org_timestamp_action ON guest_audit_logs(org_id, timestamp DESC, action_type);
CREATE INDEX idx_guest_audit_logs_user_timestamp ON guest_audit_logs(user_id, timestamp DESC);
CREATE INDEX idx_guest_audit_logs_action_details ON guest_audit_logs USING GIN (action_details);
CREATE INDEX idx_guest_audit_logs_failed ON guest_audit_logs(success, timestamp DESC) WHERE success = FALSE;

COMMENT ON TABLE guest_audit_logs IS 
  'Complete audit trail of all actions on guest check-ins and documents for compliance';

-- ============================================================================
-- 3. Modify guest_checkins table
-- ============================================================================

ALTER TABLE guest_checkins 
ADD COLUMN IF NOT EXISTS data_source VARCHAR(50) DEFAULT 'manual' CHECK (
  data_source IN ('manual', 'aadhaar_scan', 'passport_scan', 'pan_scan', 'visa_scan', 'mixed')
);

ALTER TABLE guest_checkins 
ADD COLUMN IF NOT EXISTS data_verified BOOLEAN DEFAULT FALSE;

ALTER TABLE guest_checkins 
ADD COLUMN IF NOT EXISTS verified_by_user_id INTEGER;

ALTER TABLE guest_checkins 
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Add foreign key if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_guest_checkins_verified_by'
  ) THEN
    ALTER TABLE guest_checkins 
    ADD CONSTRAINT fk_guest_checkins_verified_by 
      FOREIGN KEY (verified_by_user_id) 
      REFERENCES users(id) 
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_guest_checkins_data_verified 
  ON guest_checkins(data_verified);

COMMENT ON COLUMN guest_checkins.data_source IS 
  'Indicates how guest data was entered (manual typing vs automated extraction)';
COMMENT ON COLUMN guest_checkins.data_verified IS 
  'Indicates whether auto-filled data has been manually verified by staff';

COMMIT;
```

### Migration: 2_add_guest_documents_and_audit_logs.down.sql

```sql
-- Rollback migration: Remove guest documents and audit logging
-- Version: 2
-- Date: 2025-10-10

BEGIN;

-- Drop new columns from guest_checkins
ALTER TABLE guest_checkins DROP COLUMN IF EXISTS verified_at;
ALTER TABLE guest_checkins DROP COLUMN IF EXISTS verified_by_user_id;
ALTER TABLE guest_checkins DROP COLUMN IF EXISTS data_verified;
ALTER TABLE guest_checkins DROP COLUMN IF EXISTS data_source;

-- Drop tables
DROP TABLE IF EXISTS guest_audit_logs CASCADE;
DROP TABLE IF EXISTS guest_documents CASCADE;

COMMIT;
```

---

## Data Integrity Constraints

### Referential Integrity

1. **guest_documents → guest_checkins**: CASCADE delete ensures orphaned documents are removed when guest check-in is deleted.

2. **guest_documents → users**: SET NULL on user deletion preserves documents even if uploader/verifier account is deleted.

3. **guest_audit_logs → users**: SET NULL on user deletion preserves audit trail even if user account is deleted (critical for compliance).

4. **guest_audit_logs → guest_checkins**: SET NULL on guest deletion preserves audit history even after guest data removal (anonymized audit trail).

### Check Constraints

1. **document_type**: Enforces valid document type values, preventing data entry errors.

2. **extraction_status**: Ensures extraction state machine follows valid transitions.

3. **overall_confidence**: Ensures confidence scores are between 0-100%.

4. **action_type**: Enforces valid audit action types, enabling reliable audit log queries.

5. **resource_type**: Ensures audit logs reference valid resource types.

6. **data_source**: Enforces valid data entry methods in guest_checkins.

---

## Storage Estimates

### guest_documents

**Per Row Size Estimate:**
- Fixed columns: ~100 bytes
- Variable columns (paths, filenames): ~500 bytes
- JSONB extracted_data: ~1-2 KB (depends on document type)
- **Average row size**: ~2 KB

**Storage for 10,000 Guests** (assuming 3 documents per guest):
- Rows: 30,000
- Table data: 30,000 × 2 KB = 60 MB
- Indexes: ~20 MB (estimated)
- **Total**: ~80 MB

**Annual Growth** (100 check-ins/day × 365 days × 3 docs):
- Rows: 109,500
- Storage: ~220 MB/year

### guest_audit_logs

**Per Row Size Estimate:**
- Fixed columns: ~150 bytes
- Variable columns (email, user_agent, paths): ~500 bytes
- JSONB action_details: ~500 bytes - 2 KB
- **Average row size**: ~1.5 KB

**Storage for 10,000 Guests** (assuming 10 audit entries per guest):
- Rows: 100,000
- Table data: 100,000 × 1.5 KB = 150 MB
- Indexes: ~50 MB (estimated)
- **Total**: ~200 MB

**Annual Growth** (100 check-ins/day × 365 days × 10 actions):
- Rows: 365,000
- Storage: ~550 MB/year

### Total Database Impact

**Initial (10,000 guests)**: ~280 MB  
**Annual Growth**: ~770 MB/year  
**3-Year Projection**: ~2.6 GB

---

## Backup & Retention Strategy

### guest_documents
- **Backup**: Daily full backups, 7-day retention
- **Retention**: Indefinite (or per organizational policy, e.g., 7 years for hospitality industry)
- **Soft Delete**: Use `deleted_at` instead of hard delete for regulatory compliance

### guest_audit_logs
- **Backup**: Daily full backups, continuous WAL archiving
- **Retention**: Indefinite (never delete for compliance)
- **Archival**: After 1 year, move to cold storage table `guest_audit_logs_archive` for performance

---

## Performance Considerations

### Query Optimization

**Most Common Queries:**

1. **Get all documents for a guest check-in:**
```sql
SELECT * FROM guest_documents 
WHERE guest_checkin_id = $1 
  AND deleted_at IS NULL
ORDER BY created_at ASC;
```
*Optimized by: `idx_guest_documents_checkin_id`, `idx_guest_documents_deleted_at`*

2. **Get audit logs for a guest:**
```sql
SELECT * FROM guest_audit_logs 
WHERE guest_checkin_id = $1 
  AND timestamp >= $2 
  AND timestamp <= $3
ORDER BY timestamp DESC
LIMIT 50;
```
*Optimized by: `idx_guest_audit_logs_guest_checkin_id`, `idx_guest_audit_logs_timestamp`*

3. **Get all actions by a user in date range:**
```sql
SELECT * FROM guest_audit_logs 
WHERE org_id = $1 
  AND user_id = $2 
  AND timestamp >= $3 
  AND timestamp <= $4
ORDER BY timestamp DESC;
```
*Optimized by: `idx_guest_audit_logs_user_timestamp`*

4. **Search extracted data (e.g., find all documents with specific Aadhaar number):**
```sql
SELECT * FROM guest_documents 
WHERE org_id = $1 
  AND extracted_data @> '{"aadharNumber": {"value": "123456789012"}}'
  AND deleted_at IS NULL;
```
*Optimized by: `idx_guest_documents_extracted_data` (GIN index on JSONB)*

### Partitioning Strategy (Optional for Large Scale)

For organizations with >1 million audit logs, consider partitioning `guest_audit_logs` by timestamp:

```sql
-- Create partitioned table
CREATE TABLE guest_audit_logs_partitioned (
  LIKE guest_audit_logs INCLUDING ALL
) PARTITION BY RANGE (timestamp);

-- Create monthly partitions
CREATE TABLE guest_audit_logs_2025_10 
  PARTITION OF guest_audit_logs_partitioned
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE guest_audit_logs_2025_11 
  PARTITION OF guest_audit_logs_partitioned
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
```

**Benefits**: Faster queries on recent data, easier archival of old partitions.

---

## Security Considerations

### Row-Level Security (RLS)

Enable RLS on `guest_documents` and `guest_audit_logs` to enforce org-level data isolation:

```sql
-- Enable RLS
ALTER TABLE guest_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access documents from their organization
CREATE POLICY org_isolation_documents 
  ON guest_documents
  FOR ALL
  USING (org_id = current_setting('app.current_org_id')::INTEGER);

-- Policy: Users can only access audit logs from their organization
CREATE POLICY org_isolation_audit_logs 
  ON guest_audit_logs
  FOR ALL
  USING (org_id = current_setting('app.current_org_id')::INTEGER);
```

**Note**: Application must set `app.current_org_id` session variable on each request.

### Encryption at Rest

For sensitive guest documents, consider:
- PostgreSQL transparent data encryption (TDE) if available
- Application-level encryption for `file_path` and `extracted_data` fields
- Encrypted filesystem for `/backend/uploads/guest-documents/` directory

---

## Summary

This database schema provides:

✅ **Complete Document Management**: Store, track, and manage all guest ID documents
✅ **LLM Integration Ready**: Schema supports storing extraction results and confidence scores
✅ **Comprehensive Audit Trail**: Track every action on guest data for compliance
✅ **Performance Optimized**: Strategic indexes for common query patterns
✅ **Data Integrity**: Foreign keys, check constraints, and soft deletes
✅ **Scalability**: Designed to handle millions of records with partitioning strategy
✅ **Security**: Row-level security and encryption support
✅ **Compliance**: Meets data retention and audit requirements for hospitality industry

