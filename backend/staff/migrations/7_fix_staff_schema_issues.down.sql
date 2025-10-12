-- Rollback Staff Schema Fix
-- This migration removes the columns and constraints added in the up migration

-- 1. Remove added columns from staff_attendance table
DO $$
BEGIN
    -- Note: We don't drop the table as it may contain data
    -- Just remove the columns we added
    
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'staff_attendance' AND column_name = 'location_longitude') THEN
        ALTER TABLE staff_attendance DROP COLUMN location_longitude;
        RAISE NOTICE 'Dropped location_longitude column from staff_attendance';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'staff_attendance' AND column_name = 'location_latitude') THEN
        ALTER TABLE staff_attendance DROP COLUMN location_latitude;
        RAISE NOTICE 'Dropped location_latitude column from staff_attendance';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'staff_attendance' AND column_name = 'overtime_hours') THEN
        ALTER TABLE staff_attendance DROP COLUMN overtime_hours;
        RAISE NOTICE 'Dropped overtime_hours column from staff_attendance';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'staff_attendance' AND column_name = 'total_hours') THEN
        ALTER TABLE staff_attendance DROP COLUMN total_hours;
        RAISE NOTICE 'Dropped total_hours column from staff_attendance';
    END IF;
END $$;

-- 2. Remove added columns from staff table
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'is_full_time') THEN
        ALTER TABLE staff DROP COLUMN is_full_time;
        RAISE NOTICE 'Dropped is_full_time column from staff';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'max_overtime_hours') THEN
        ALTER TABLE staff DROP COLUMN max_overtime_hours;
        RAISE NOTICE 'Dropped max_overtime_hours column from staff';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'attendance_tracking_enabled') THEN
        ALTER TABLE staff DROP COLUMN attendance_tracking_enabled;
        RAISE NOTICE 'Dropped attendance_tracking_enabled column from staff';
    END IF;
END $$;

-- 3. Drop views
DROP VIEW IF EXISTS staff_attendance_summary;
DROP VIEW IF EXISTS staff_summary;

-- 4. Drop functions
DROP FUNCTION IF EXISTS get_staff_leave_balance(BIGINT);
DROP FUNCTION IF EXISTS calculate_staff_hours(BIGINT, DATE, DATE);
