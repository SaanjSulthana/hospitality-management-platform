-- Migration: Allow any Indian ID (not just Aadhaar)
-- Version: 8
-- Date: 2025-11-10
-- Description: Updates the constraint to accept ANY Indian ID instead of requiring Aadhaar

BEGIN;

-- ============================================================================
-- 1. Drop existing constraint that requires Aadhaar
-- ============================================================================

ALTER TABLE guest_checkins DROP CONSTRAINT IF EXISTS valid_guest_type_fields;

-- ============================================================================
-- 2. Add new constraint that accepts ANY Indian ID
-- ============================================================================

-- For Indian guests: At least ONE of (Aadhaar, PAN, Driving License, Election Card)
-- For Foreign guests: Passport is required
ALTER TABLE guest_checkins ADD CONSTRAINT valid_guest_type_fields CHECK (
  (guest_type = 'indian' AND (
    aadhar_number IS NOT NULL OR 
    pan_number IS NOT NULL OR 
    driving_license_number IS NOT NULL OR 
    election_card_number IS NOT NULL
  )) OR
  (guest_type = 'foreign' AND passport_number IS NOT NULL)
);

COMMIT;

