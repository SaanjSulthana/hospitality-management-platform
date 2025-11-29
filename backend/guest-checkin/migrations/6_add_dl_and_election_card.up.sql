-- Migration: Add Driving License and Election Card fields to guest_checkins
-- Version: 6
-- Date: 2025-10-15

BEGIN;

-- ============================================================================
-- 1. Add new columns for Indian ID types
-- ============================================================================

-- Add driving license number column
ALTER TABLE guest_checkins 
ADD COLUMN driving_license_number VARCHAR(20);

-- Add election card number column  
ALTER TABLE guest_checkins 
ADD COLUMN election_card_number VARCHAR(15);

-- ============================================================================
-- 2. Create indexes for performance
-- ============================================================================

-- Index for driving license number searches
CREATE INDEX idx_guest_checkins_dl_number ON guest_checkins(driving_license_number);

-- Index for election card number searches
CREATE INDEX idx_guest_checkins_election_card_number ON guest_checkins(election_card_number);

-- ============================================================================
-- 3. Add column comments
-- ============================================================================

COMMENT ON COLUMN guest_checkins.driving_license_number IS 'Indian Driving License number (format: DL-XX/YYYY/XXXXXXX or similar)';
COMMENT ON COLUMN guest_checkins.election_card_number IS 'Indian Election Card (EPIC) number (format: ABC1234567)';

-- ============================================================================
-- 4. Update constraint to include new fields in validation
-- ============================================================================

-- Drop existing constraint
ALTER TABLE guest_checkins DROP CONSTRAINT IF EXISTS valid_guest_type_fields;

-- Add updated constraint that allows optional ID fields for Indian guests
ALTER TABLE guest_checkins ADD CONSTRAINT valid_guest_type_fields CHECK (
  (guest_type = 'indian' AND aadhar_number IS NOT NULL) OR
  (guest_type = 'foreign' AND passport_number IS NOT NULL)
);

COMMIT;
