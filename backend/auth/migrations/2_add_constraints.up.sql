-- Add uniqueness constraints for natural keys to prevent duplicates

-- Rooms: unique per org/property/name
ALTER TABLE rooms ADD CONSTRAINT rooms_unique_org_property_name UNIQUE (org_id, property_id, name);

-- Beds/Units: unique per org/property/label
ALTER TABLE beds_or_units ADD CONSTRAINT beds_unique_org_property_label UNIQUE (org_id, property_id, label);

-- Staff: unique per org/user/property (prevent duplicate staff records)
ALTER TABLE staff ADD CONSTRAINT staff_unique_org_user_property 
UNIQUE (org_id, user_id, property_id);

-- Handle NULL property_id case for staff
CREATE UNIQUE INDEX staff_unique_org_user_null_property 
ON staff (org_id, user_id) 
WHERE property_id IS NULL;
