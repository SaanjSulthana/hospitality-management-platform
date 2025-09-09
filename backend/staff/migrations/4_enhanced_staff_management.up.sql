-- Enhanced Staff Management Migration
-- This migration adds new tables and columns for comprehensive staff management

-- 1. Staff Attendance Table
CREATE TABLE IF NOT EXISTS staff_attendance (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  total_hours DECIMAL(4,2) DEFAULT 0.0,
  overtime_hours DECIMAL(4,2) DEFAULT 0.0,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'half_day', 'leave')) DEFAULT 'absent',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, staff_id, attendance_date)
);

-- 2. Salary Components Table
CREATE TABLE IF NOT EXISTS salary_components (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  base_salary_cents BIGINT NOT NULL DEFAULT 0,
  hourly_rate_cents BIGINT DEFAULT 0,
  overtime_rate_cents BIGINT DEFAULT 0,
  bonus_cents BIGINT DEFAULT 0,
  allowance_cents BIGINT DEFAULT 0,
  deduction_cents BIGINT DEFAULT 0,
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Payslips Table
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
  status TEXT NOT NULL CHECK (status IN ('draft', 'generated', 'paid')) DEFAULT 'draft',
  pdf_file_path TEXT,
  generated_at TIMESTAMPTZ,
  generated_by_user_id BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, staff_id, pay_period_start, pay_period_end)
);

-- 4. Schedule Change Requests Table
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

-- 5. Enhanced Staff Table - Add new columns
ALTER TABLE staff ADD COLUMN IF NOT EXISTS salary_type TEXT CHECK (salary_type IN ('hourly', 'monthly', 'daily')) DEFAULT 'hourly';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS base_salary_cents BIGINT DEFAULT 0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS overtime_rate_cents BIGINT DEFAULT 0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS attendance_tracking_enabled BOOLEAN DEFAULT true;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS max_overtime_hours DECIMAL(4,2) DEFAULT 0.0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS leave_balance INTEGER DEFAULT 0;

-- 6. Enhanced Staff Schedules Table - Add new columns
ALTER TABLE staff_schedules ADD COLUMN IF NOT EXISTS actual_start_time TIMESTAMPTZ;
ALTER TABLE staff_schedules ADD COLUMN IF NOT EXISTS actual_end_time TIMESTAMPTZ;
ALTER TABLE staff_schedules ADD COLUMN IF NOT EXISTS actual_hours DECIMAL(4,2) DEFAULT 0.0;
ALTER TABLE staff_schedules ADD COLUMN IF NOT EXISTS completion_notes TEXT;
ALTER TABLE staff_schedules ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false;

-- 7. Enhanced Leave Requests Table - Add new columns
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS leave_balance_before INTEGER;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS leave_balance_after INTEGER;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN DEFAULT false;

-- 8. Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff_date ON staff_attendance(staff_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_org_date ON staff_attendance(org_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_status ON staff_attendance(status);

CREATE INDEX IF NOT EXISTS idx_salary_components_staff ON salary_components(staff_id, is_active);
CREATE INDEX IF NOT EXISTS idx_salary_components_effective ON salary_components(effective_from, effective_to);

CREATE INDEX IF NOT EXISTS idx_payslips_staff_period ON payslips(staff_id, pay_period_start, pay_period_end);
CREATE INDEX IF NOT EXISTS idx_payslips_status ON payslips(status);

CREATE INDEX IF NOT EXISTS idx_schedule_changes_staff ON schedule_change_requests(staff_id, status);
CREATE INDEX IF NOT EXISTS idx_schedule_changes_schedule ON schedule_change_requests(original_schedule_id);

-- 9. Add Foreign Key Constraints
ALTER TABLE staff_attendance ADD CONSTRAINT fk_staff_attendance_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE staff_attendance ADD CONSTRAINT fk_staff_attendance_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;

ALTER TABLE salary_components ADD CONSTRAINT fk_salary_components_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE salary_components ADD CONSTRAINT fk_salary_components_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;

ALTER TABLE payslips ADD CONSTRAINT fk_payslips_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE payslips ADD CONSTRAINT fk_payslips_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;
ALTER TABLE payslips ADD CONSTRAINT fk_payslips_generated_by FOREIGN KEY (generated_by_user_id) REFERENCES users(id);

ALTER TABLE schedule_change_requests ADD CONSTRAINT fk_schedule_changes_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE schedule_change_requests ADD CONSTRAINT fk_schedule_changes_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;
ALTER TABLE schedule_change_requests ADD CONSTRAINT fk_schedule_changes_schedule FOREIGN KEY (original_schedule_id) REFERENCES staff_schedules(id) ON DELETE CASCADE;
ALTER TABLE schedule_change_requests ADD CONSTRAINT fk_schedule_changes_approved_by FOREIGN KEY (approved_by_user_id) REFERENCES users(id);

-- 10. Add Validation Constraints
ALTER TABLE staff_attendance ADD CONSTRAINT chk_attendance_times CHECK (
  (check_in_time IS NULL AND check_out_time IS NULL) OR
  (check_in_time IS NOT NULL AND check_out_time IS NULL) OR
  (check_in_time IS NOT NULL AND check_out_time IS NOT NULL AND check_out_time > check_in_time)
);

ALTER TABLE salary_components ADD CONSTRAINT chk_salary_effective_dates CHECK (effective_to IS NULL OR effective_to > effective_from);

ALTER TABLE payslips ADD CONSTRAINT chk_payslip_period CHECK (pay_period_end >= pay_period_start);
ALTER TABLE payslips ADD CONSTRAINT chk_payslip_amounts CHECK (net_pay_cents >= 0 AND total_earnings_cents >= 0);
