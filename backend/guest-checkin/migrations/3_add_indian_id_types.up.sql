-- Migration: Add support for multiple Indian ID types
-- Version: 3
-- Date: 2025-10-10

BEGIN;

-- ============================================================================
-- 1. Update guest_documents table to support new Indian ID types
-- ============================================================================

-- Drop the existing constraint
ALTER TABLE guest_documents DROP CONSTRAINT IF EXISTS guest_documents_document_type_check;

-- Add new constraint with expanded document types
ALTER TABLE guest_documents ADD CONSTRAINT guest_documents_document_type_check CHECK (
  document_type IN (
    'aadhaar_front', 
    'aadhaar_back', 
    'pan_card', 
    'passport', 
    'visa_front', 
    'visa_back',
    'driving_license_front',
    'driving_license_back',
    'election_card_front',
    'election_card_back',
    'other'
  )
);

-- Add new column for detected document type
ALTER TABLE guest_documents 
ADD COLUMN IF NOT EXISTS detected_document_type VARCHAR(50);

-- Add index for detected document type
CREATE INDEX IF NOT EXISTS idx_guest_documents_detected_type ON guest_documents(detected_document_type);

-- Add column for document type confidence
ALTER TABLE guest_documents 
ADD COLUMN IF NOT EXISTS document_type_confidence INTEGER CHECK (document_type_confidence BETWEEN 0 AND 100);

-- Update existing records to set detected_document_type same as document_type
UPDATE guest_documents 
SET detected_document_type = document_type 
WHERE detected_document_type IS NULL;

COMMENT ON COLUMN guest_documents.detected_document_type IS 'Auto-detected document type during LLM processing';
COMMENT ON COLUMN guest_documents.document_type_confidence IS 'Confidence score for document type detection (0-100)';

COMMIT;
