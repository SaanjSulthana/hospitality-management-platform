-- Revert Form C specific fields from guest_checkins table

-- Drop indexes
DROP INDEX IF EXISTS idx_guest_checkins_arrival_date;
DROP INDEX IF EXISTS idx_guest_checkins_guest_type;

-- Note: Property fields (star_rating, mobile) are not removed here
-- as they should be managed in the properties service database

-- Remove columns from guest_checkins table
ALTER TABLE guest_checkins
DROP COLUMN IF EXISTS surname,
DROP COLUMN IF EXISTS sex,
DROP COLUMN IF EXISTS special_category,
DROP COLUMN IF EXISTS permanent_city,
DROP COLUMN IF EXISTS indian_address,
DROP COLUMN IF EXISTS indian_city_district,
DROP COLUMN IF EXISTS indian_state,
DROP COLUMN IF EXISTS indian_pincode,
DROP COLUMN IF EXISTS arrived_from,
DROP COLUMN IF EXISTS date_of_arrival_in_india,
DROP COLUMN IF EXISTS date_of_arrival_at_accommodation,
DROP COLUMN IF EXISTS time_of_arrival,
DROP COLUMN IF EXISTS intended_duration,
DROP COLUMN IF EXISTS employed_in_india,
DROP COLUMN IF EXISTS purpose_of_visit,
DROP COLUMN IF EXISTS next_place,
DROP COLUMN IF EXISTS destination_city_district,
DROP COLUMN IF EXISTS destination_state,
DROP COLUMN IF EXISTS mobile_no_india,
DROP COLUMN IF EXISTS contact_no_permanent,
DROP COLUMN IF EXISTS mobile_no_permanent,
DROP COLUMN IF EXISTS remarks;

