-- Add fields for document cleanup tracking
-- This migration adds support for temporary document cleanup

ALTER TABLE guest_documents 
ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

-- Create index for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_guest_documents_cleanup 
ON guest_documents(is_temporary, expires_at) 
WHERE guest_checkin_id IS NULL AND deleted_at IS NULL;

-- Mark existing orphaned documents as temporary with 24 hour expiry
UPDATE guest_documents 
SET is_temporary = true,
    expires_at = NOW() + INTERVAL '24 hours'
WHERE guest_checkin_id IS NULL 
  AND created_at < NOW() - INTERVAL '1 hour'  -- Give grace period for active uploads
  AND deleted_at IS NULL;

-- Add comment
COMMENT ON COLUMN guest_documents.is_temporary IS 'Marks documents that are uploaded before check-in creation';
COMMENT ON COLUMN guest_documents.expires_at IS 'Timestamp when temporary document should be deleted if not linked to check-in';

