# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-09-05-enhanced-staff-management/spec.md

## Schema Changes (Encore Framework)

### Migration Strategy
- **Use Encore Database Shell**: `cd backend && encore db shell hospitality`
- **Create Migration Files**: Add to `backend/staff/migrations/` directory
- **Follow Naming Convention**: `[timestamp]_[description].up.sql` and `[timestamp]_[description].down.sql`
- **Test Migrations**: Always test with Encore database shell, not Docker

### New Tables

#### 1. Staff Attendance Table
```sql
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
```

#### 2. Salary Components Table
```sql
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
```

#### 3. Payslips Table
```sql
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
```

#### 4. Schedule Change Requests Table
```sql
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
```

### Table Modifications

#### 1. Enhanced Staff Table
```sql
-- Add new columns to existing staff table
ALTER TABLE staff ADD COLUMN IF NOT EXISTS salary_type TEXT CHECK (salary_type IN ('hourly', 'monthly', 'daily')) DEFAULT 'hourly';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS base_salary_cents BIGINT DEFAULT 0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS overtime_rate_cents BIGINT DEFAULT 0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS attendance_tracking_enabled BOOLEAN DEFAULT true;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS max_overtime_hours DECIMAL(4,2) DEFAULT 0.0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS leave_balance INTEGER DEFAULT 0;
```

#### 2. Enhanced Staff Schedules Table
```sql
-- Add new columns to existing staff_schedules table
ALTER TABLE staff_schedules ADD COLUMN IF NOT EXISTS actual_start_time TIMESTAMPTZ;
ALTER TABLE staff_schedules ADD COLUMN IF NOT EXISTS actual_end_time TIMESTAMPTZ;
ALTER TABLE staff_schedules ADD COLUMN IF NOT EXISTS actual_hours DECIMAL(4,2) DEFAULT 0.0;
ALTER TABLE staff_schedules ADD COLUMN IF NOT EXISTS completion_notes TEXT;
ALTER TABLE staff_schedules ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false;
```

#### 3. Enhanced Leave Requests Table
```sql
-- Add new columns to existing leave_requests table
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS leave_balance_before INTEGER;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS leave_balance_after INTEGER;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN DEFAULT false;
```

## Indexes and Constraints

### Performance Indexes
```sql
-- Attendance indexes
CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff_date ON staff_attendance(staff_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_org_date ON staff_attendance(org_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_status ON staff_attendance(status);

-- Salary components indexes
CREATE INDEX IF NOT EXISTS idx_salary_components_staff ON salary_components(staff_id, is_active);
CREATE INDEX IF NOT EXISTS idx_salary_components_effective ON salary_components(effective_from, effective_to);

-- Payslips indexes
CREATE INDEX IF NOT EXISTS idx_payslips_staff_period ON payslips(staff_id, pay_period_start, pay_period_end);
CREATE INDEX IF NOT EXISTS idx_payslips_status ON payslips(status);

-- Schedule change requests indexes
CREATE INDEX IF NOT EXISTS idx_schedule_changes_staff ON schedule_change_requests(staff_id, status);
CREATE INDEX IF NOT EXISTS idx_schedule_changes_schedule ON schedule_change_requests(original_schedule_id);
```

### Foreign Key Constraints
```sql
-- Add foreign key constraints for new tables
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
```

## Data Integrity Rules

### Business Rules
1. **Attendance Tracking**: Staff can only have one attendance record per day
2. **Salary Components**: Only one active salary component per staff member at a time
3. **Payslips**: Cannot generate duplicate payslips for the same period
4. **Schedule Changes**: Cannot request changes for past schedules
5. **Leave Balance**: Leave balance cannot go negative

### Validation Constraints
```sql
-- Attendance validation
ALTER TABLE staff_attendance ADD CONSTRAINT chk_attendance_times CHECK (
  (check_in_time IS NULL AND check_out_time IS NULL) OR
  (check_in_time IS NOT NULL AND check_out_time IS NULL) OR
  (check_in_time IS NOT NULL AND check_out_time IS NOT NULL AND check_out_time > check_in_time)
);

-- Salary validation
ALTER TABLE salary_components ADD CONSTRAINT chk_salary_effective_dates CHECK (effective_to IS NULL OR effective_to > effective_from);

-- Payslip validation
ALTER TABLE payslips ADD CONSTRAINT chk_payslip_period CHECK (pay_period_end >= pay_period_start);
ALTER TABLE payslips ADD CONSTRAINT chk_payslip_amounts CHECK (net_pay_cents >= 0 AND total_earnings_cents >= 0);
```

## Encore Database Compliance

### Required Patterns
- **Database Connection**: Use `encore db shell hospitality` (NEVER Docker direct connection)
- **Organization Isolation**: All tables MUST include `org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- **Parameterized Queries**: Use template literals with `${variable}` syntax
- **Transaction Management**: Use `await db.begin()`, `tx.commit()`, `tx.rollback()`
- **Error Handling**: Wrap database operations in try-catch with proper error conversion

### Database Query Examples
```typescript
// ✅ Correct - Encore pattern
const result = await staffDB.queryRow`
  SELECT * FROM staff_attendance 
  WHERE org_id = ${authData.orgId} 
  AND staff_id = ${staffId} 
  AND attendance_date = ${date}
`;

// ❌ Wrong - String concatenation
const result = await staffDB.queryRow(
  `SELECT * FROM staff_attendance WHERE org_id = ${orgId} AND staff_id = ${staffId}`
);
```

## Migration Strategy

### Encore Migration Steps
1. **Create migration files** in `backend/staff/migrations/` directory
2. **Test with Encore shell**: `cd backend && encore db shell hospitality`
3. **Verify data isolation**: Check `org_id` constraints work properly
4. **Update application code** to use new schema with proper patterns
5. **Test with real data** in Encore context (not Docker)
6. **Deploy with rollback** migration files ready

### Rollback Plan
1. **Backup with Encore**: Use Encore database shell for data backup
2. **Create rollback migrations**: `.down.sql` files for each migration
3. **Test rollback in Encore**: Use `encore db shell hospitality` for testing
4. **Monitor with Encore**: Check application logs and database performance
5. **Execute rollback**: Use Encore migration system if issues arise

## Performance Considerations

### Query Optimization
- **Composite indexes** for common query patterns
- **Partial indexes** for filtered queries
- **Covering indexes** for frequently accessed columns
- **Partitioning** for large tables (attendance, payslips)

### Data Archiving
- **Archive old attendance records** (older than 2 years)
- **Archive completed payslips** (older than 7 years)
- **Archive old schedule changes** (older than 1 year)
- **Implement data retention policies**

### Monitoring
- **Query performance monitoring** for new tables
- **Index usage analysis** to optimize performance
- **Database size monitoring** for growth planning
- **Connection pool monitoring** for capacity planning
