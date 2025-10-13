-- Rollback: Make guest_checkin_id NOT NULL again
-- Note: This will fail if there are any existing documents with NULL guest_checkin_id

ALTER TABLE guest_documents 
ALTER COLUMN guest_checkin_id SET NOT NULL;

-- Remove the comment
COMMENT ON COLUMN guest_documents.guest_checkin_id IS NULL;
