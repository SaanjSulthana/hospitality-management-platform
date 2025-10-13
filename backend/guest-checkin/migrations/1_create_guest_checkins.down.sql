-- Drop indexes
DROP INDEX IF EXISTS idx_guest_checkins_created_by;
DROP INDEX IF EXISTS idx_guest_checkins_phone;
DROP INDEX IF EXISTS idx_guest_checkins_email;
DROP INDEX IF EXISTS idx_guest_checkins_guest_type;
DROP INDEX IF EXISTS idx_guest_checkins_check_in_date;
DROP INDEX IF EXISTS idx_guest_checkins_status;
DROP INDEX IF EXISTS idx_guest_checkins_property_id;
DROP INDEX IF EXISTS idx_guest_checkins_org_id;

-- Drop table
DROP TABLE IF EXISTS guest_checkins;
