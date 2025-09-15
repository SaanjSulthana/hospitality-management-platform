-- Add missing columns to staff table
-- This migration adds all the columns that the update function expects

-- Add performance_rating column
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS performance_rating DECIMAL(3, 1) DEFAULT 0;

-- Add salary_type column
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS salary_type VARCHAR(20) DEFAULT 'hourly';

-- Add base_salary_cents column
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS base_salary_cents BIGINT DEFAULT 0;

-- Add overtime_rate_cents column
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS overtime_rate_cents BIGINT DEFAULT 0;

-- Add attendance_tracking_enabled column
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS attendance_tracking_enabled BOOLEAN DEFAULT true;

-- Add max_overtime_hours column
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS max_overtime_hours DECIMAL(4, 1) DEFAULT 40.0;

-- Add leave_balance column
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS leave_balance INTEGER DEFAULT 20;

-- Update existing records with default values
UPDATE staff 
SET performance_rating = 0 
WHERE performance_rating IS NULL;

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
SET max_overtime_hours = 40.0 
WHERE max_overtime_hours IS NULL;

UPDATE staff 
SET leave_balance = 20 
WHERE leave_balance IS NULL;

