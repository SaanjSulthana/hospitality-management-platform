-- Fix staff table by adding missing columns
-- This script adds all the columns that the frontend expects

-- Add missing columns to staff table
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS salary_type VARCHAR(20) DEFAULT 'hourly';

ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS base_salary_cents BIGINT DEFAULT 0;

ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS overtime_rate_cents BIGINT DEFAULT 0;

ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS attendance_tracking_enabled BOOLEAN DEFAULT true;

ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS max_overtime_hours DECIMAL(4,2) DEFAULT 0.0;

ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS leave_balance INTEGER DEFAULT 0;

-- Update existing records with default values
UPDATE staff 
SET salary_type = 'hourly' 
WHERE salary_type IS NULL;

UPDATE staff 
SET base_salary_cents = 0 
WHERE base_salary_cents IS NULL;

UPDATE staff 
SET overtime_rate_cents = 0 
WHERE overtime_rate_cents IS NULL;

UPDATE staff 
SET attendance_tracking_enabled = true 
WHERE attendance_tracking_enabled IS NULL;

UPDATE staff 
SET max_overtime_hours = 0.0 
WHERE max_overtime_hours IS NULL;

UPDATE staff 
SET leave_balance = 0 
WHERE leave_balance IS NULL;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'staff' 
AND column_name IN (
  'salary_type', 
  'base_salary_cents', 
  'overtime_rate_cents', 
  'attendance_tracking_enabled', 
  'max_overtime_hours', 
  'leave_balance'
)
ORDER BY column_name;
