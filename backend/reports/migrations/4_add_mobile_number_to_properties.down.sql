-- Rollback: Remove mobile_number column and revert address_json to nullable

-- Remove index
DROP INDEX IF EXISTS idx_properties_mobile_number;

-- Make address_json nullable again
ALTER TABLE properties 
ALTER COLUMN address_json DROP NOT NULL;

-- Remove mobile_number column
ALTER TABLE properties 
DROP COLUMN IF EXISTS mobile_number;

-- Remove comments
COMMENT ON COLUMN properties.mobile_number IS NULL;
COMMENT ON COLUMN properties.address_json IS NULL;

