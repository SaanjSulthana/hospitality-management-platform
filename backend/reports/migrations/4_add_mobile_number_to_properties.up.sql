-- Add mobile_number column to properties table in reports database and make address_json NOT NULL

-- Step 1: Add mobile_number column (nullable first to allow existing records)
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS mobile_number TEXT;

-- Step 2: Update existing records to have a default empty address_json if null
UPDATE properties 
SET address_json = '{}'::jsonb 
WHERE address_json IS NULL;

-- Step 3: Make address_json NOT NULL (now that all records have a value)
ALTER TABLE properties 
ALTER COLUMN address_json SET NOT NULL;

-- Add index for mobile number searches
CREATE INDEX IF NOT EXISTS idx_properties_mobile_number ON properties(mobile_number);

-- Add comment
COMMENT ON COLUMN properties.mobile_number IS 'Contact mobile number for the property (required)';
COMMENT ON COLUMN properties.address_json IS 'Address details in JSON format (required)';

