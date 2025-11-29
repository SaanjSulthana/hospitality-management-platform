-- Add Form C specific fields to guest_checkins table

-- Personal Details
ALTER TABLE guest_checkins
ADD COLUMN IF NOT EXISTS surname VARCHAR(255),
ADD COLUMN IF NOT EXISTS sex VARCHAR(10) CHECK (sex IN ('Male', 'Female', 'Other')),
ADD COLUMN IF NOT EXISTS special_category VARCHAR(100) DEFAULT 'Others',
ADD COLUMN IF NOT EXISTS permanent_city VARCHAR(255);

-- Indian Address Details
ALTER TABLE guest_checkins
ADD COLUMN IF NOT EXISTS indian_address TEXT,
ADD COLUMN IF NOT EXISTS indian_city_district VARCHAR(255),
ADD COLUMN IF NOT EXISTS indian_state VARCHAR(100),
ADD COLUMN IF NOT EXISTS indian_pincode VARCHAR(20);

-- Arrival Details
ALTER TABLE guest_checkins
ADD COLUMN IF NOT EXISTS arrived_from VARCHAR(500),
ADD COLUMN IF NOT EXISTS date_of_arrival_in_india TIMESTAMP,
ADD COLUMN IF NOT EXISTS date_of_arrival_at_accommodation TIMESTAMP,
ADD COLUMN IF NOT EXISTS time_of_arrival VARCHAR(10),
ADD COLUMN IF NOT EXISTS intended_duration INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS employed_in_india VARCHAR(1) DEFAULT 'N' CHECK (employed_in_india IN ('Y', 'N'));

-- Other Details
ALTER TABLE guest_checkins
ADD COLUMN IF NOT EXISTS purpose_of_visit VARCHAR(255) DEFAULT 'Tourism',
ADD COLUMN IF NOT EXISTS next_place VARCHAR(255),
ADD COLUMN IF NOT EXISTS destination_city_district VARCHAR(255),
ADD COLUMN IF NOT EXISTS destination_state VARCHAR(100),
ADD COLUMN IF NOT EXISTS mobile_no_india VARCHAR(20),
ADD COLUMN IF NOT EXISTS contact_no_permanent VARCHAR(20),
ADD COLUMN IF NOT EXISTS mobile_no_permanent VARCHAR(20),
ADD COLUMN IF NOT EXISTS remarks TEXT;

-- Note: Property fields (star_rating, mobile) should be added to the properties service database
-- They are not added here as the properties table exists in a different microservice database

-- Add indexes for frequently queried fields
CREATE INDEX IF NOT EXISTS idx_guest_checkins_arrival_date ON guest_checkins(date_of_arrival_in_india);
CREATE INDEX IF NOT EXISTS idx_guest_checkins_guest_type ON guest_checkins(guest_type);

-- Add comment
COMMENT ON COLUMN guest_checkins.surname IS 'Surname for Form C';
COMMENT ON COLUMN guest_checkins.sex IS 'Gender for Form C';
COMMENT ON COLUMN guest_checkins.special_category IS 'Special category for Form C (e.g., Others, VIP, etc.)';
COMMENT ON COLUMN guest_checkins.indian_address IS 'Address/Reference in India for Form C';
COMMENT ON COLUMN guest_checkins.arrived_from IS 'Last port/city before arrival in India';
COMMENT ON COLUMN guest_checkins.date_of_arrival_in_india IS 'Date when guest first arrived in India (may differ from accommodation check-in)';
COMMENT ON COLUMN guest_checkins.date_of_arrival_at_accommodation IS 'Date when guest arrived at this specific accommodation';
COMMENT ON COLUMN guest_checkins.time_of_arrival IS 'Time of arrival at accommodation (HH:MM format)';
COMMENT ON COLUMN guest_checkins.intended_duration IS 'Intended duration of stay in days';
COMMENT ON COLUMN guest_checkins.employed_in_india IS 'Whether the guest is employed in India (Y/N)';
COMMENT ON COLUMN guest_checkins.purpose_of_visit IS 'Purpose of visit to India';
COMMENT ON COLUMN guest_checkins.next_place IS 'Next destination after leaving this accommodation';

