-- =====================================================
-- COMPREHENSIVE STAFF DATABASE FIELDS UPDATE
-- =====================================================
-- This script adds all missing fields for staff management
-- Execute this step by step in the database shell

-- Step 1: Check current staff_attendance table structure
-- Run this first to see what's missing:
-- \d staff_attendance

-- Step 2: Add missing columns to staff_attendance table
ALTER TABLE staff_attendance 
ADD COLUMN IF NOT EXISTS total_hours DECIMAL(5, 2) DEFAULT 0;

ALTER TABLE staff_attendance 
ADD COLUMN IF NOT EXISTS overtime_hours DECIMAL(5, 2) DEFAULT 0;

-- Step 3: Update status constraint to include 'leave'
ALTER TABLE staff_attendance 
DROP CONSTRAINT IF EXISTS staff_attendance_status_check;

ALTER TABLE staff_attendance 
ADD CONSTRAINT staff_attendance_status_check 
CHECK (status IN ('present', 'absent', 'late', 'half_day', 'leave'));

-- Step 4: Update existing records with default values
UPDATE staff_attendance 
SET total_hours = 0 
WHERE total_hours IS NULL;

UPDATE staff_attendance 
SET overtime_hours = 0 
WHERE overtime_hours IS NULL;

-- Step 5: Check if staff table has all required fields
-- Run this to see current staff table structure:
-- \d staff

-- Step 6: Add missing fields to staff table (if needed)
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS performance_rating DECIMAL(3, 1) DEFAULT 0;

ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS salary_type VARCHAR(20) DEFAULT 'hourly';

ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS base_salary_cents BIGINT DEFAULT 0;

ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS overtime_rate_cents BIGINT DEFAULT 0;

ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS attendance_tracking_enabled BOOLEAN DEFAULT true;

ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS max_overtime_hours DECIMAL(4, 1) DEFAULT 40.0;

ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS leave_balance INTEGER DEFAULT 20;

-- Step 7: Update existing staff records with default values
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

-- Step 8: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_staff_performance_rating ON staff(performance_rating);
CREATE INDEX IF NOT EXISTS idx_staff_salary_type ON staff(salary_type);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_tracking ON staff(attendance_tracking_enabled);

-- Step 9: Verify the changes
-- Run these commands to verify the changes:
-- \d staff_attendance
-- \d staff
-- SELECT COUNT(*) FROM staff_attendance WHERE total_hours IS NOT NULL;
-- SELECT COUNT(*) FROM staff WHERE performance_rating IS NOT NULL;

-- Step 10: Test the staff attendance endpoint
-- The endpoint should now work without 500 errors
