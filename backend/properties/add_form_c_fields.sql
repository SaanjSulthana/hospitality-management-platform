-- Add Form C related fields to properties table
-- Run this manually in your properties database

-- Add star_rating and mobile fields for Form C accommodation details
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS star_rating VARCHAR(50),
ADD COLUMN IF NOT EXISTS mobile VARCHAR(20);

-- Add comments for documentation
COMMENT ON COLUMN properties.star_rating IS 'Hotel/accommodation star rating (e.g., "Three Star", "Five Star", "Not Rated") for Form C';
COMMENT ON COLUMN properties.mobile IS 'Mobile contact number for the property, used in Form C generation';

-- Optional: Update existing properties with default values
-- UPDATE properties SET star_rating = 'Not Rated' WHERE star_rating IS NULL;
-- UPDATE properties SET mobile = phone WHERE mobile IS NULL AND phone IS NOT NULL;

