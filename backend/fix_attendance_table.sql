-- Add missing columns to staff_attendance table
ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS total_hours DECIMAL(5, 2) DEFAULT 0;
ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS overtime_hours DECIMAL(5, 2) DEFAULT 0;

-- Update the status constraint to include 'leave'
ALTER TABLE staff_attendance DROP CONSTRAINT IF EXISTS staff_attendance_status_check;
ALTER TABLE staff_attendance ADD CONSTRAINT staff_attendance_status_check CHECK (status IN ('present', 'absent', 'late', 'half_day', 'leave'));

-- Update existing records to have default values
UPDATE staff_attendance SET total_hours = 0 WHERE total_hours IS NULL;
UPDATE staff_attendance SET overtime_hours = 0 WHERE overtime_hours IS NULL;
