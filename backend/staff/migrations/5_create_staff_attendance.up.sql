-- Create staff_attendance table for tracking check-in/check-out
CREATE TABLE IF NOT EXISTS staff_attendance (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  check_in_time TIMESTAMP,
  check_out_time TIMESTAMP,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'half_day')) DEFAULT 'present',
  notes TEXT,
  location_latitude DECIMAL(10, 8),
  location_longitude DECIMAL(11, 8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, staff_id, attendance_date)
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_staff_attendance_org_staff_date ON staff_attendance(org_id, staff_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON staff_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_status ON staff_attendance(status);
