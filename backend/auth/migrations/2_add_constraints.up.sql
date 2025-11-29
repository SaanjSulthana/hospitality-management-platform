-- Add uniqueness constraints for natural keys to prevent duplicates (idempotent)

DO $$ 
BEGIN
  -- Rooms: unique per org/property/name
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rooms_unique_org_property_name'
  ) THEN
    ALTER TABLE rooms ADD CONSTRAINT rooms_unique_org_property_name UNIQUE (org_id, property_id, name);
  END IF;

  -- Beds/Units: unique per org/property/label
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'beds_unique_org_property_label'
  ) THEN
    ALTER TABLE beds_or_units ADD CONSTRAINT beds_unique_org_property_label UNIQUE (org_id, property_id, label);
  END IF;

  -- Staff: unique per org/user/property (prevent duplicate staff records)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_unique_org_user_property'
  ) THEN
    ALTER TABLE staff ADD CONSTRAINT staff_unique_org_user_property 
    UNIQUE (org_id, user_id, property_id);
  END IF;

  -- Handle NULL property_id case for staff
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'staff_unique_org_user_null_property'
  ) THEN
    CREATE UNIQUE INDEX staff_unique_org_user_null_property 
    ON staff (org_id, user_id) 
    WHERE property_id IS NULL;
  END IF;
END $$;
