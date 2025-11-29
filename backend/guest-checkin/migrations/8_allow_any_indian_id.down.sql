-- Rollback: Revert to requiring Aadhaar for Indian guests
-- Version: 8
-- Date: 2025-11-10

BEGIN;

-- Drop the flexible constraint
ALTER TABLE guest_checkins DROP CONSTRAINT IF EXISTS valid_guest_type_fields;

-- Restore the old constraint that requires Aadhaar
ALTER TABLE guest_checkins ADD CONSTRAINT valid_guest_type_fields CHECK (
  (guest_type = 'indian' AND aadhar_number IS NOT NULL) OR
  (guest_type = 'foreign' AND passport_number IS NOT NULL)
);

COMMIT;

