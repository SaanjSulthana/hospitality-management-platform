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
  deleted_at TIMESTAMPTZ,
  deleted_by_user_id INTEGER
  
  -- Note: Foreign key constraints removed for microservices architecture
  -- Referential integrity handled at application level
);

-- Indexes for guest_documents
CREATE INDEX IF NOT EXISTS idx_guest_documents_org_id ON guest_documents(org_id);
CREATE INDEX IF NOT EXISTS idx_guest_documents_checkin_id ON guest_documents(guest_checkin_id);
CREATE INDEX IF NOT EXISTS idx_guest_documents_document_type ON guest_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_guest_documents_extraction_status ON guest_documents(extraction_status);
CREATE INDEX IF NOT EXISTS idx_guest_documents_created_at ON guest_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guest_documents_uploaded_by ON guest_documents(uploaded_by_user_id);
CREATE INDEX IF NOT EXISTS idx_guest_documents_extracted_data ON guest_documents USING GIN (extracted_data);
CREATE INDEX IF NOT EXISTS idx_guest_documents_deleted_at ON guest_documents(deleted_at) WHERE deleted_at IS NULL;

COMMENT ON TABLE guest_documents IS 'Stores uploaded guest identification documents with LLM extraction results';

-- ============================================================================
-- 2. Create guest_audit_logs table
-- ============================================================================

CREATE TABLE IF NOT EXISTS guest_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  
  -- User Information
  user_id INTEGER NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  user_role VARCHAR(50) NOT NULL,
  
  -- Action Information
  action_type VARCHAR(100) NOT NULL CHECK (
    action_type IN (
      'create_checkin', 'update_checkin', 'delete_checkin', 'checkout_guest', 'view_guest_details',
      'upload_document', 'view_documents', 'view_document', 'download_document', 
      'delete_document', 'verify_document',
      'query_audit_logs', 'export_audit_logs',
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
  ip_address VARCHAR(45),
  user_agent TEXT,
  request_method VARCHAR(10),
  request_path TEXT,
  
  -- Action Details
  action_details JSONB,
  
  -- Result Information
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT,
  
  -- Timing
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER
);

-- Indexes for guest_audit_logs
CREATE INDEX IF NOT EXISTS idx_guest_audit_logs_org_id ON guest_audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_guest_audit_logs_user_id ON guest_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_guest_audit_logs_action_type ON guest_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_guest_audit_logs_resource_type ON guest_audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_guest_audit_logs_guest_checkin_id ON guest_audit_logs(guest_checkin_id);
CREATE INDEX IF NOT EXISTS idx_guest_audit_logs_timestamp ON guest_audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_guest_audit_logs_org_timestamp_action ON guest_audit_logs(org_id, timestamp DESC, action_type);
CREATE INDEX IF NOT EXISTS idx_guest_audit_logs_user_timestamp ON guest_audit_logs(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_guest_audit_logs_action_details ON guest_audit_logs USING GIN (action_details);
CREATE INDEX IF NOT EXISTS idx_guest_audit_logs_failed ON guest_audit_logs(success, timestamp DESC) WHERE success = FALSE;

COMMENT ON TABLE guest_audit_logs IS 'Complete audit trail of all actions on guest check-ins and documents for compliance';

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

CREATE INDEX IF NOT EXISTS idx_guest_checkins_data_verified ON guest_checkins(data_verified);

COMMENT ON COLUMN guest_checkins.data_source IS 'Indicates how guest data was entered (manual typing vs automated extraction)';
COMMENT ON COLUMN guest_checkins.data_verified IS 'Indicates whether auto-filled data has been manually verified by staff';

COMMIT;

