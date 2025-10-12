-- Fix Staff Schema Issues
-- This migration fixes the missing columns and constraints in staff-related tables

-- 1. Ensure staff_attendance table has all required columns
DO $$
BEGIN
    -- Check if staff_attendance table exists
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'staff_attendance') THEN
        -- Create the table if it doesn't exist
        CREATE TABLE staff_attendance (
            id BIGSERIAL PRIMARY KEY,
            org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
            attendance_date DATE NOT NULL,
            check_in_time TIMESTAMPTZ,
            check_out_time TIMESTAMPTZ,
            total_hours DECIMAL(4,2) DEFAULT 0.0,
            overtime_hours DECIMAL(4,2) DEFAULT 0.0,
            status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'half_day', 'leave', 'sick')) DEFAULT 'absent',
            notes TEXT,
            location_latitude DECIMAL(10, 8),
            location_longitude DECIMAL(11, 8),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(org_id, staff_id, attendance_date)
        );
        
        -- Create indexes
        CREATE INDEX idx_staff_attendance_org_staff_date ON staff_attendance(org_id, staff_id, attendance_date);
        CREATE INDEX idx_staff_attendance_date ON staff_attendance(attendance_date);
        CREATE INDEX idx_staff_attendance_status ON staff_attendance(status);
        
        RAISE NOTICE 'Created staff_attendance table';
    ELSE
        -- Add missing columns if they don't exist
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'staff_attendance' AND column_name = 'total_hours') THEN
            ALTER TABLE staff_attendance ADD COLUMN total_hours DECIMAL(4,2) DEFAULT 0.0;
            RAISE NOTICE 'Added total_hours column to staff_attendance';
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'staff_attendance' AND column_name = 'overtime_hours') THEN
            ALTER TABLE staff_attendance ADD COLUMN overtime_hours DECIMAL(4,2) DEFAULT 0.0;
            RAISE NOTICE 'Added overtime_hours column to staff_attendance';
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'staff_attendance' AND column_name = 'location_latitude') THEN
            ALTER TABLE staff_attendance ADD COLUMN location_latitude DECIMAL(10, 8);
            RAISE NOTICE 'Added location_latitude column to staff_attendance';
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'staff_attendance' AND column_name = 'location_longitude') THEN
            ALTER TABLE staff_attendance ADD COLUMN location_longitude DECIMAL(11, 8);
            RAISE NOTICE 'Added location_longitude column to staff_attendance';
        END IF;
        
        -- Update status constraint to include 'sick'
        BEGIN
            ALTER TABLE staff_attendance DROP CONSTRAINT IF EXISTS staff_attendance_status_check;
            ALTER TABLE staff_attendance ADD CONSTRAINT staff_attendance_status_check 
                CHECK (status IN ('present', 'absent', 'late', 'half_day', 'leave', 'sick'));
            RAISE NOTICE 'Updated staff_attendance status constraint';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Status constraint update skipped: %', SQLERRM;
        END;
        
        RAISE NOTICE 'Updated existing staff_attendance table';
    END IF;
END $$;

-- 2. Add missing columns to staff table
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'attendance_tracking_enabled') THEN
        ALTER TABLE staff ADD COLUMN attendance_tracking_enabled BOOLEAN DEFAULT true;
        RAISE NOTICE 'Added attendance_tracking_enabled column to staff';
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'max_overtime_hours') THEN
        ALTER TABLE staff ADD COLUMN max_overtime_hours DECIMAL(4,2) DEFAULT 0.0;
        RAISE NOTICE 'Added max_overtime_hours column to staff';
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'is_full_time') THEN
        ALTER TABLE staff ADD COLUMN is_full_time BOOLEAN DEFAULT true;
        RAISE NOTICE 'Added is_full_time column to staff';
    END IF;
END $$;

-- 3. Create or update views
CREATE OR REPLACE VIEW staff_summary AS
SELECT 
    s.id,
    s.org_id,
    s.user_id,
    u.display_name as user_name,
    u.email as user_email,
    s.property_id,
    p.name as property_name,
    s.department,
    s.status,
    s.hire_date,
    s.salary_type,
    s.base_salary_cents,
    s.hourly_rate_cents,
    s.overtime_rate_cents,
    s.performance_rating,
    s.leave_balance,
    s.attendance_tracking_enabled,
    s.is_full_time,
    s.created_at,
    s.updated_at
FROM staff s
JOIN users u ON s.user_id = u.id
LEFT JOIN properties p ON s.property_id = p.id;

CREATE OR REPLACE VIEW staff_attendance_summary AS
SELECT 
    sa.staff_id,
    u.display_name as staff_name,
    sa.attendance_date,
    sa.check_in_time,
    sa.check_out_time,
    sa.total_hours,
    sa.overtime_hours,
    sa.status,
    EXTRACT(EPOCH FROM (sa.check_out_time - sa.check_in_time))/3600 as calculated_hours
FROM staff_attendance sa
JOIN staff s ON sa.staff_id = s.id
JOIN users u ON s.user_id = u.id;

-- 4. Create utility functions
CREATE OR REPLACE FUNCTION calculate_staff_hours(staff_id_param BIGINT, start_date DATE, end_date DATE)
RETURNS DECIMAL(4,2) AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(total_hours) 
         FROM staff_attendance 
         WHERE staff_id = staff_id_param 
           AND attendance_date BETWEEN start_date AND end_date
           AND status = 'present'), 0.0
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_staff_leave_balance(staff_id_param BIGINT)
RETURNS INTEGER AS $$
BEGIN
    RETURN COALESCE(
        (SELECT leave_balance FROM staff WHERE id = staff_id_param), 0
    );
END;
$$ LANGUAGE plpgsql;
