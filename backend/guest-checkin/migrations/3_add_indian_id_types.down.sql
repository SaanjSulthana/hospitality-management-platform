-- Migration: Rollback Indian ID types support
-- Version: 3
-- Date: 2025-10-10

BEGIN;

-- Remove new columns
ALTER TABLE guest_documents DROP COLUMN IF EXISTS detected_document_type;
ALTER TABLE guest_documents DROP COLUMN IF EXISTS document_type_confidence;

-- Drop new index
DROP INDEX IF EXISTS idx_guest_documents_detected_type;

-- Restore original constraint
ALTER TABLE guest_documents DROP CONSTRAINT IF EXISTS guest_documents_document_type_check;
ALTER TABLE guest_documents ADD CONSTRAINT guest_documents_document_type_check CHECK (
  document_type IN (
    'aadhaar_front', 
    'aadhaar_back', 
    'pan_card', 
    'passport', 
    'visa_front', 
    'visa_back',
    'other'
  )
);

COMMIT;
