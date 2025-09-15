-- Comprehensive Staff Management Migration
-- This migration ensures all necessary tables and fields are properly implemented

-- 1. Drop and recreate staff_attendance table with comprehensive fields
DROP TABLE IF EXISTS staff_attendance CASCADE;

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

-- 2. Ensure salary_components table exists with all fields
CREATE TABLE IF NOT EXISTS salary_components (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  component_type TEXT NOT NULL CHECK (component_type IN ('base_salary', 'hourly_rate', 'overtime_rate', 'bonus', 'allowance', 'deduction', 'commission')),
  amount_cents BIGINT NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ensure payslips table exists with all fields
CREATE TABLE IF NOT EXISTS payslips (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  pay_period_start DATE NOT NULL,
  pay_period_end DATE NOT NULL,
  base_salary_cents BIGINT NOT NULL,
  overtime_pay_cents BIGINT DEFAULT 0,
  bonus_cents BIGINT DEFAULT 0,
  allowance_cents BIGINT DEFAULT 0,
  deduction_cents BIGINT DEFAULT 0,
  total_earnings_cents BIGINT NOT NULL,
  net_pay_cents BIGINT NOT NULL,
  hours_worked DECIMAL(4,2) DEFAULT 0.0,
  overtime_hours DECIMAL(4,2) DEFAULT 0.0,
  days_present INTEGER DEFAULT 0,
  days_absent INTEGER DEFAULT 0,
  leave_days INTEGER DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('draft', 'generated', 'paid', 'cancelled')) DEFAULT 'draft',
  pdf_file_path TEXT,
  generated_at TIMESTAMPTZ,
  generated_by_user_id BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, staff_id, pay_period_start, pay_period_end)
);

-- 4. Ensure schedule_change_requests table exists
CREATE TABLE IF NOT EXISTS schedule_change_requests (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  original_schedule_id BIGINT NOT NULL REFERENCES staff_schedules(id) ON DELETE CASCADE,
  requested_date DATE NOT NULL,
  requested_start_time TIME,
  requested_end_time TIME,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  approved_by_user_id BIGINT REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Add comprehensive fields to staff table
ALTER TABLE staff ADD COLUMN IF NOT EXISTS salary_type TEXT CHECK (salary_type IN ('hourly', 'monthly', 'daily')) DEFAULT 'hourly';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS base_salary_cents BIGINT DEFAULT 0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS overtime_rate_cents BIGINT DEFAULT 0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS attendance_tracking_enabled BOOLEAN DEFAULT true;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS max_overtime_hours DECIMAL(4,2) DEFAULT 0.0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS leave_balance INTEGER DEFAULT 0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS emergency_contact_relation TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say'));
ALTER TABLE staff ADD COLUMN IF NOT EXISTS nationality TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS passport_number TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS work_permit_number TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS work_permit_expiry DATE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS social_security_number TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_full_time BOOLEAN DEFAULT true;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS probation_period_end DATE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS last_promotion_date DATE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS next_review_date DATE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS skills TEXT[];
ALTER TABLE staff ADD COLUMN IF NOT EXISTS certifications TEXT[];
ALTER TABLE staff ADD COLUMN IF NOT EXISTS languages TEXT[];
ALTER TABLE staff ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE staff ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 6. Enhance staff_schedules table
ALTER TABLE staff_schedules ADD COLUMN IF NOT EXISTS actual_start_time TIMESTAMPTZ;
ALTER TABLE staff_schedules ADD COLUMN IF NOT EXISTS actual_end_time TIMESTAMPTZ;
ALTER TABLE staff_schedules ADD COLUMN IF NOT EXISTS actual_hours DECIMAL(4,2) DEFAULT 0.0;
ALTER TABLE staff_schedules ADD COLUMN IF NOT EXISTS completion_notes TEXT;
ALTER TABLE staff_schedules ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false;
ALTER TABLE staff_schedules ADD COLUMN IF NOT EXISTS shift_type TEXT CHECK (shift_type IN ('morning', 'afternoon', 'evening', 'night', 'overtime')) DEFAULT 'morning';
ALTER TABLE staff_schedules ADD COLUMN IF NOT EXISTS is_holiday BOOLEAN DEFAULT false;
ALTER TABLE staff_schedules ADD COLUMN IF NOT EXISTS holiday_pay_multiplier DECIMAL(3,2) DEFAULT 1.0;

-- 7. Enhance leave_requests table
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS leave_balance_before INTEGER;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS leave_balance_after INTEGER;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN DEFAULT false;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS return_date DATE;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS handover_notes TEXT;

-- 8. Create staff_documents table for file management
CREATE TABLE IF NOT EXISTS staff_documents (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('contract', 'id_copy', 'passport', 'work_permit', 'certificate', 'other')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by_user_id BIGINT NOT NULL REFERENCES users(id),
  is_verified BOOLEAN DEFAULT false,
  verified_by_user_id BIGINT REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  expiry_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Create staff_training table
CREATE TABLE IF NOT EXISTS staff_training (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  training_name TEXT NOT NULL,
  training_provider TEXT,
  training_date DATE NOT NULL,
  completion_date DATE,
  certificate_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')) DEFAULT 'scheduled',
  cost_cents BIGINT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Create staff_incidents table for incident reporting
CREATE TABLE IF NOT EXISTS staff_incidents (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  incident_type TEXT NOT NULL CHECK (incident_type IN ('safety', 'disciplinary', 'performance', 'attendance', 'other')),
  incident_date DATE NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low',
  status TEXT NOT NULL CHECK (status IN ('reported', 'investigating', 'resolved', 'closed')) DEFAULT 'reported',
  reported_by_user_id BIGINT NOT NULL REFERENCES users(id),
  assigned_to_user_id BIGINT REFERENCES users(id),
  resolution TEXT,
  resolution_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Create comprehensive indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff_date ON staff_attendance(staff_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_org_date ON staff_attendance(org_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_status ON staff_attendance(status);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_check_times ON staff_attendance(check_in_time, check_out_time);

CREATE INDEX IF NOT EXISTS idx_salary_components_staff ON salary_components(staff_id, is_active);
CREATE INDEX IF NOT EXISTS idx_salary_components_effective ON salary_components(effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_salary_components_type ON salary_components(component_type);

CREATE INDEX IF NOT EXISTS idx_payslips_staff_period ON payslips(staff_id, pay_period_start, pay_period_end);
CREATE INDEX IF NOT EXISTS idx_payslips_status ON payslips(status);
CREATE INDEX IF NOT EXISTS idx_payslips_generated ON payslips(generated_at);

CREATE INDEX IF NOT EXISTS idx_schedule_changes_staff ON schedule_change_requests(staff_id, status);
CREATE INDEX IF NOT EXISTS idx_schedule_changes_schedule ON schedule_change_requests(original_schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_changes_date ON schedule_change_requests(requested_date);

CREATE INDEX IF NOT EXISTS idx_staff_documents_staff ON staff_documents(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_documents_type ON staff_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_staff_documents_verified ON staff_documents(is_verified);

CREATE INDEX IF NOT EXISTS idx_staff_training_staff ON staff_training(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_training_status ON staff_training(status);
CREATE INDEX IF NOT EXISTS idx_staff_training_date ON staff_training(training_date);

CREATE INDEX IF NOT EXISTS idx_staff_incidents_staff ON staff_incidents(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_incidents_type ON staff_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_staff_incidents_severity ON staff_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_staff_incidents_status ON staff_incidents(status);

-- 12. Add foreign key constraints
ALTER TABLE staff_documents ADD CONSTRAINT fk_staff_documents_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE staff_documents ADD CONSTRAINT fk_staff_documents_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;
ALTER TABLE staff_documents ADD CONSTRAINT fk_staff_documents_uploaded_by FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id);
ALTER TABLE staff_documents ADD CONSTRAINT fk_staff_documents_verified_by FOREIGN KEY (verified_by_user_id) REFERENCES users(id);

ALTER TABLE staff_training ADD CONSTRAINT fk_staff_training_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE staff_training ADD CONSTRAINT fk_staff_training_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;

ALTER TABLE staff_incidents ADD CONSTRAINT fk_staff_incidents_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE staff_incidents ADD CONSTRAINT fk_staff_incidents_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;
ALTER TABLE staff_incidents ADD CONSTRAINT fk_staff_incidents_reported_by FOREIGN KEY (reported_by_user_id) REFERENCES users(id);
ALTER TABLE staff_incidents ADD CONSTRAINT fk_staff_incidents_assigned_to FOREIGN KEY (assigned_to_user_id) REFERENCES users(id);

-- 13. Add validation constraints
ALTER TABLE staff_attendance ADD CONSTRAINT chk_attendance_times CHECK (
  (check_in_time IS NULL AND check_out_time IS NULL) OR
  (check_in_time IS NOT NULL AND check_out_time IS NULL) OR
  (check_in_time IS NOT NULL AND check_out_time IS NOT NULL AND check_out_time > check_in_time)
);

ALTER TABLE salary_components ADD CONSTRAINT chk_salary_effective_dates CHECK (effective_to IS NULL OR effective_to > effective_from);
ALTER TABLE salary_components ADD CONSTRAINT chk_salary_amount CHECK (amount_cents >= 0);

ALTER TABLE payslips ADD CONSTRAINT chk_payslip_period CHECK (pay_period_end >= pay_period_start);
ALTER TABLE payslips ADD CONSTRAINT chk_payslip_amounts CHECK (net_pay_cents >= 0 AND total_earnings_cents >= 0);

ALTER TABLE staff ADD CONSTRAINT chk_staff_dates CHECK (
  (probation_period_end IS NULL OR probation_period_end > hire_date) AND
  (last_promotion_date IS NULL OR last_promotion_date >= hire_date) AND
  (next_review_date IS NULL OR next_review_date >= hire_date)
);

-- 14. Create views for common queries
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
  s.user_name,
  sa.attendance_date,
  sa.check_in_time,
  sa.check_out_time,
  sa.total_hours,
  sa.overtime_hours,
  sa.status,
  EXTRACT(EPOCH FROM (sa.check_out_time - sa.check_in_time))/3600 as calculated_hours
FROM staff_attendance sa
JOIN staff_summary s ON sa.staff_id = s.id;

-- 15. Create functions for common operations
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

-- 16. Insert sample data for testing (optional)
-- This can be uncommented for development/testing purposes
/*
INSERT INTO staff_documents (org_id, staff_id, document_type, file_name, file_path, uploaded_by_user_id)
SELECT 
  s.org_id,
  s.id,
  'contract',
  'employment_contract_' || s.id || '.pdf',
  '/documents/contracts/employment_contract_' || s.id || '.pdf',
  s.user_id
FROM staff s
WHERE s.id IN (SELECT id FROM staff LIMIT 5);
*/

