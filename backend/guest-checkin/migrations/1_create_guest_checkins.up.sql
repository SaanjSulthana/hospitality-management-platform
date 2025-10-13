-- Create guest_checkins table
CREATE TABLE IF NOT EXISTS guest_checkins (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  property_id INTEGER NOT NULL,
  guest_type VARCHAR(20) NOT NULL CHECK (guest_type IN ('indian', 'foreign')),
  
  -- Personal Information
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address TEXT NOT NULL,
  
  -- Indian Guest ID Fields
  aadhar_number VARCHAR(12),
  pan_number VARCHAR(10),
  
  -- Foreign Guest ID Fields
  passport_number VARCHAR(50),
  country VARCHAR(100),
  visa_type VARCHAR(50),
  visa_expiry_date DATE,
  
  -- Booking Information
  check_in_date TIMESTAMP NOT NULL DEFAULT NOW(),
  expected_checkout_date DATE,
  actual_checkout_date TIMESTAMP,
  room_number VARCHAR(20),
  number_of_guests INTEGER DEFAULT 1,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'checked_in' CHECK (status IN ('checked_in', 'checked_out', 'cancelled')),
  
  -- Audit Fields
  created_by_user_id INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  checked_out_by_user_id INTEGER,
  
  -- Constraints
  -- Note: Foreign key to properties table removed for microservices architecture
  -- Referential integrity handled at application level
  CONSTRAINT valid_guest_type_fields CHECK (
    (guest_type = 'indian' AND aadhar_number IS NOT NULL) OR
    (guest_type = 'foreign' AND passport_number IS NOT NULL)
  )
);

-- Create indexes for performance
CREATE INDEX idx_guest_checkins_org_id ON guest_checkins(org_id);
CREATE INDEX idx_guest_checkins_property_id ON guest_checkins(property_id);
CREATE INDEX idx_guest_checkins_status ON guest_checkins(status);
CREATE INDEX idx_guest_checkins_check_in_date ON guest_checkins(check_in_date);
CREATE INDEX idx_guest_checkins_guest_type ON guest_checkins(guest_type);
CREATE INDEX idx_guest_checkins_email ON guest_checkins(email);
CREATE INDEX idx_guest_checkins_phone ON guest_checkins(phone);
CREATE INDEX idx_guest_checkins_created_by ON guest_checkins(created_by_user_id);
