-- Migration: Rollback - Remove Driving License and Election Card fields
-- Version: 6 (Rollback)
-- Date: 2025-10-15

BEGIN;

-- ============================================================================
-- 1. Drop indexes first
-- ============================================================================

DROP INDEX IF EXISTS idx_guest_checkins_dl_number;
DROP INDEX IF EXISTS idx_guest_checkins_election_card_number;

-- ============================================================================
-- 2. Drop columns
-- ============================================================================

ALTER TABLE guest_checkins 
DROP COLUMN IF EXISTS driving_license_number,
DROP COLUMN IF EXISTS election_card_number;

-- ============================================================================
-- 3. Restore original constraint
-- ============================================================================

-- Drop the updated constraint
ALTER TABLE guest_checkins DROP CONSTRAINT IF EXISTS valid_guest_type_fields;

-- Restore original constraint
ALTER TABLE guest_checkins ADD CONSTRAINT valid_guest_type_fields CHECK (
  (guest_type = 'indian' AND aadhar_number IS NOT NULL) OR
  (guest_type = 'foreign' AND passport_number IS NOT NULL)
);

COMMIT;
