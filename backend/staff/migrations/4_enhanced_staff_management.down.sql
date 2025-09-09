-- Enhanced Staff Management Migration Rollback
-- This migration removes the enhanced staff management tables and columns

-- 1. Drop new tables
DROP TABLE IF EXISTS schedule_change_requests;
DROP TABLE IF EXISTS payslips;
DROP TABLE IF EXISTS salary_components;
DROP TABLE IF EXISTS staff_attendance;

-- 2. Remove enhanced columns from staff table
ALTER TABLE staff DROP COLUMN IF EXISTS leave_balance;
ALTER TABLE staff DROP COLUMN IF EXISTS max_overtime_hours;
ALTER TABLE staff DROP COLUMN IF EXISTS attendance_tracking_enabled;
ALTER TABLE staff DROP COLUMN IF EXISTS overtime_rate_cents;
ALTER TABLE staff DROP COLUMN IF EXISTS base_salary_cents;
ALTER TABLE staff DROP COLUMN IF EXISTS salary_type;

-- 3. Remove enhanced columns from staff_schedules table
ALTER TABLE staff_schedules DROP COLUMN IF EXISTS is_completed;
ALTER TABLE staff_schedules DROP COLUMN IF EXISTS completion_notes;
ALTER TABLE staff_schedules DROP COLUMN IF EXISTS actual_hours;
ALTER TABLE staff_schedules DROP COLUMN IF EXISTS actual_end_time;
ALTER TABLE staff_schedules DROP COLUMN IF EXISTS actual_start_time;

-- 4. Remove enhanced columns from leave_requests table
ALTER TABLE leave_requests DROP COLUMN IF EXISTS is_emergency;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS admin_notes;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS leave_balance_after;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS leave_balance_before;
