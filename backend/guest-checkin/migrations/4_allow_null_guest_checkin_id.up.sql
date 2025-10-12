-- Allow guest_checkin_id to be NULL for form creation uploads
-- This enables document uploads during the form creation process before a guest check-in is created

ALTER TABLE guest_documents 
ALTER COLUMN guest_checkin_id DROP NOT NULL;

-- Add a comment to explain the purpose
COMMENT ON COLUMN guest_documents.guest_checkin_id IS 'ID of the guest check-in. Can be NULL for documents uploaded during form creation before check-in is created.';
