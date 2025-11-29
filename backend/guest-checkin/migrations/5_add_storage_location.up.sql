-- Add storage location tracking to guest_documents table
-- This enables hybrid storage: existing files on local disk, new files in Encore buckets

ALTER TABLE guest_documents 
ADD COLUMN storage_location VARCHAR(20) DEFAULT 'local' CHECK (storage_location IN ('local', 'cloud'));

ALTER TABLE guest_documents
ADD COLUMN bucket_key VARCHAR(500); -- Path in bucket (null for local files)

-- Index for efficient filtering by storage location
CREATE INDEX idx_guest_documents_storage_location ON guest_documents(storage_location);

-- Update existing records to be marked as 'local'
UPDATE guest_documents SET storage_location = 'local' WHERE storage_location IS NULL;


