-- Comprehensive Staff Management Migration Rollback

-- 1. Drop views
DROP VIEW IF EXISTS staff_attendance_summary CASCADE;
DROP VIEW IF EXISTS staff_summary CASCADE;

-- 2. Drop functions
DROP FUNCTION IF EXISTS calculate_staff_hours(BIGINT, DATE, DATE);
DROP FUNCTION IF EXISTS get_staff_leave_balance(BIGINT);

-- 3. Drop new tables
DROP TABLE IF EXISTS staff_incidents CASCADE;
DROP TABLE IF EXISTS staff_training CASCADE;
DROP TABLE IF EXISTS staff_documents CASCADE;

-- 4. Remove added columns from staff table
ALTER TABLE staff DROP COLUMN IF EXISTS salary_type;
ALTER TABLE staff DROP COLUMN IF EXISTS base_salary_cents;
ALTER TABLE staff DROP COLUMN IF EXISTS overtime_rate_cents;
ALTER TABLE staff DROP COLUMN IF EXISTS attendance_tracking_enabled;
ALTER TABLE staff DROP COLUMN IF EXISTS max_overtime_hours;
ALTER TABLE staff DROP COLUMN IF EXISTS leave_balance;
ALTER TABLE staff DROP COLUMN IF EXISTS emergency_contact_name;
ALTER TABLE staff DROP COLUMN IF EXISTS emergency_contact_phone;
ALTER TABLE staff DROP COLUMN IF EXISTS emergency_contact_relation;
ALTER TABLE staff DROP COLUMN IF EXISTS address;
ALTER TABLE staff DROP COLUMN IF EXISTS phone_number;
ALTER TABLE staff DROP COLUMN IF EXISTS date_of_birth;
ALTER TABLE staff DROP COLUMN IF EXISTS gender;
ALTER TABLE staff DROP COLUMN IF EXISTS nationality;
ALTER TABLE staff DROP COLUMN IF EXISTS passport_number;
ALTER TABLE staff DROP COLUMN IF EXISTS work_permit_number;
ALTER TABLE staff DROP COLUMN IF EXISTS work_permit_expiry;
ALTER TABLE staff DROP COLUMN IF EXISTS bank_account_number;
ALTER TABLE staff DROP COLUMN IF EXISTS bank_name;
ALTER TABLE staff DROP COLUMN IF EXISTS tax_id;
ALTER TABLE staff DROP COLUMN IF EXISTS social_security_number;
ALTER TABLE staff DROP COLUMN IF EXISTS is_full_time;
ALTER TABLE staff DROP COLUMN IF EXISTS probation_period_end;
ALTER TABLE staff DROP COLUMN IF EXISTS last_promotion_date;
ALTER TABLE staff DROP COLUMN IF EXISTS next_review_date;
ALTER TABLE staff DROP COLUMN IF EXISTS skills;
ALTER TABLE staff DROP COLUMN IF EXISTS certifications;
ALTER TABLE staff DROP COLUMN IF EXISTS languages;
ALTER TABLE staff DROP COLUMN IF EXISTS created_at;
ALTER TABLE staff DROP COLUMN IF EXISTS updated_at;

-- 5. Remove added columns from staff_schedules table
ALTER TABLE staff_schedules DROP COLUMN IF EXISTS actual_start_time;
ALTER TABLE staff_schedules DROP COLUMN IF EXISTS actual_end_time;
ALTER TABLE staff_schedules DROP COLUMN IF EXISTS actual_hours;
ALTER TABLE staff_schedules DROP COLUMN IF EXISTS completion_notes;
ALTER TABLE staff_schedules DROP COLUMN IF EXISTS is_completed;
ALTER TABLE staff_schedules DROP COLUMN IF EXISTS shift_type;
ALTER TABLE staff_schedules DROP COLUMN IF EXISTS is_holiday;
ALTER TABLE staff_schedules DROP COLUMN IF EXISTS holiday_pay_multiplier;

-- 6. Remove added columns from leave_requests table
ALTER TABLE leave_requests DROP COLUMN IF EXISTS leave_balance_before;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS leave_balance_after;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS admin_notes;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS is_emergency;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS attachment_url;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS return_date;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS handover_notes;

-- 7. Drop enhanced tables
DROP TABLE IF EXISTS schedule_change_requests CASCADE;
DROP TABLE IF EXISTS payslips CASCADE;
DROP TABLE IF EXISTS salary_components CASCADE;
DROP TABLE IF EXISTS staff_attendance CASCADE;

-- 8. Drop indexes
DROP INDEX IF EXISTS idx_staff_attendance_staff_date;
DROP INDEX IF EXISTS idx_staff_attendance_org_date;
DROP INDEX IF EXISTS idx_staff_attendance_status;
DROP INDEX IF EXISTS idx_staff_attendance_check_times;
DROP INDEX IF EXISTS idx_salary_components_staff;
DROP INDEX IF EXISTS idx_salary_components_effective;
DROP INDEX IF EXISTS idx_salary_components_type;
DROP INDEX IF EXISTS idx_payslips_staff_period;
DROP INDEX IF EXISTS idx_payslips_status;
DROP INDEX IF EXISTS idx_payslips_generated;
DROP INDEX IF EXISTS idx_schedule_changes_staff;
DROP INDEX IF EXISTS idx_schedule_changes_schedule;
DROP INDEX IF EXISTS idx_schedule_changes_date;
DROP INDEX IF EXISTS idx_staff_documents_staff;
DROP INDEX IF EXISTS idx_staff_documents_type;
DROP INDEX IF EXISTS idx_staff_documents_verified;
DROP INDEX IF EXISTS idx_staff_training_staff;
DROP INDEX IF EXISTS idx_staff_training_status;
DROP INDEX IF EXISTS idx_staff_training_date;
DROP INDEX IF EXISTS idx_staff_incidents_staff;
DROP INDEX IF EXISTS idx_staff_incidents_type;
DROP INDEX IF EXISTS idx_staff_incidents_severity;
DROP INDEX IF EXISTS idx_staff_incidents_status;

