import { staffDB } from "./db";

// Fix staff management schema issues
export const fixStaffSchemaIssues = async () => {
  console.log("=== Starting Staff Schema Fix ===");
  
  try {
    // 1. Check if staff_attendance table exists and has required columns
    console.log("Checking staff_attendance table structure...");
    
    const tableCheck = await staffDB.rawQueryRow(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'staff_attendance' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    if (!tableCheck) {
      console.log("Creating staff_attendance table...");
      await staffDB.exec(`
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
        )
      `);
      
      // Create indexes
      await staffDB.exec(`
        CREATE INDEX IF NOT EXISTS idx_staff_attendance_org_staff_date 
        ON staff_attendance(org_id, staff_id, attendance_date)
      `);
      
      await staffDB.exec(`
        CREATE INDEX IF NOT EXISTS idx_staff_attendance_date 
        ON staff_attendance(attendance_date)
      `);
      
      await staffDB.exec(`
        CREATE INDEX IF NOT EXISTS idx_staff_attendance_status 
        ON staff_attendance(status)
      `);
      
      console.log("✅ Created staff_attendance table with all required columns");
    } else {
      // Check for missing columns
      const columns = await staffDB.rawQueryAll(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'staff_attendance' 
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `);
      
      const columnNames = columns.map(col => col.column_name);
      console.log("Existing columns:", columnNames);
      
      // Add missing columns
      if (!columnNames.includes('total_hours')) {
        console.log("Adding total_hours column...");
        await staffDB.exec(`
          ALTER TABLE staff_attendance 
          ADD COLUMN total_hours DECIMAL(4,2) DEFAULT 0.0
        `);
        console.log("✅ Added total_hours column");
      }
      
      if (!columnNames.includes('overtime_hours')) {
        console.log("Adding overtime_hours column...");
        await staffDB.exec(`
          ALTER TABLE staff_attendance 
          ADD COLUMN overtime_hours DECIMAL(4,2) DEFAULT 0.0
        `);
        console.log("✅ Added overtime_hours column");
      }
      
      if (!columnNames.includes('location_latitude')) {
        console.log("Adding location columns...");
        await staffDB.exec(`
          ALTER TABLE staff_attendance 
          ADD COLUMN location_latitude DECIMAL(10, 8)
        `);
        await staffDB.exec(`
          ALTER TABLE staff_attendance 
          ADD COLUMN location_longitude DECIMAL(11, 8)
        `);
        console.log("✅ Added location columns");
      }
      
      // Update status constraint to include 'sick'
      try {
        await staffDB.exec(`
          ALTER TABLE staff_attendance 
          DROP CONSTRAINT IF EXISTS staff_attendance_status_check
        `);
        await staffDB.exec(`
          ALTER TABLE staff_attendance 
          ADD CONSTRAINT staff_attendance_status_check 
          CHECK (status IN ('present', 'absent', 'late', 'half_day', 'leave', 'sick'))
        `);
        console.log("✅ Updated status constraint");
      } catch (error) {
        console.log("Status constraint update skipped:", error);
      }
    }
    
    // 2. Check and fix staff table structure
    console.log("Checking staff table structure...");
    
    const staffColumns = await staffDB.rawQueryAll(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'staff' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    const staffColumnNames = staffColumns.map(col => col.column_name);
    console.log("Staff table columns:", staffColumnNames);
    
    // Add missing staff columns if needed
    const requiredStaffColumns = [
      { name: 'attendance_tracking_enabled', type: 'BOOLEAN DEFAULT true' },
      { name: 'max_overtime_hours', type: 'DECIMAL(4,2) DEFAULT 0.0' },
      { name: 'is_full_time', type: 'BOOLEAN DEFAULT true' }
    ];
    
    for (const col of requiredStaffColumns) {
      if (!staffColumnNames.includes(col.name)) {
        console.log(`Adding ${col.name} column to staff table...`);
        await staffDB.exec(`
          ALTER TABLE staff 
          ADD COLUMN ${col.name} ${col.type}
        `);
        console.log(`✅ Added ${col.name} column`);
      }
    }
    
    // 3. Create or update views
    console.log("Creating/updating views...");
    
    await staffDB.exec(`
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
        s.hourly_rate_cents,
        s.performance_rating,
        s.attendance_tracking_enabled,
        s.is_full_time
      FROM staff s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN properties p ON s.property_id = p.id
    `);
    
    await staffDB.exec(`
      CREATE OR REPLACE VIEW staff_attendance_summary AS
      SELECT 
        sa.staff_id,
        u.display_name as staff_name,
        sa.attendance_date,
        sa.check_in_time,
        sa.check_out_time,
        sa.total_hours,
        sa.overtime_hours,
        sa.status,
        EXTRACT(EPOCH FROM (sa.check_out_time - sa.check_in_time))/3600 as calculated_hours
      FROM staff_attendance sa
      JOIN staff s ON sa.staff_id = s.id
      JOIN users u ON s.user_id = u.id
    `);
    
    console.log("✅ Created/updated views");
    
    // 4. Create utility functions
    console.log("Creating utility functions...");
    
    await staffDB.exec(`
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
      $$ LANGUAGE plpgsql
    `);
    
    await staffDB.exec(`
      CREATE OR REPLACE FUNCTION get_staff_leave_balance(staff_id_param BIGINT)
      RETURNS INTEGER AS $$
      BEGIN
        RETURN COALESCE(
          (SELECT leave_balance FROM staff WHERE id = staff_id_param), 0
        );
      END;
      $$ LANGUAGE plpgsql
    `);
    
    console.log("✅ Created utility functions");
    
    // 5. Verify the fix
    console.log("Verifying schema fix...");
    
    const verifyAttendance = await staffDB.rawQueryRow(`
      SELECT COUNT(*) as column_count
      FROM information_schema.columns 
      WHERE table_name = 'staff_attendance' 
      AND table_schema = 'public'
    `);
    
    const verifyStaff = await staffDB.rawQueryRow(`
      SELECT COUNT(*) as column_count
      FROM information_schema.columns 
      WHERE table_name = 'staff' 
      AND table_schema = 'public'
    `);
    
    console.log(`✅ Verification complete:`);
    console.log(`   - staff_attendance table has ${verifyAttendance?.column_count} columns`);
    console.log(`   - staff table has ${verifyStaff?.column_count} columns`);
    
    console.log("=== Staff Schema Fix Completed Successfully ===");
    return { success: true, message: "Schema fix completed successfully" };
    
  } catch (error) {
    console.error("❌ Schema fix failed:", error);
    throw error;
  }
};

// Note: This module is imported by the Encore service and should not run standalone
// The fixStaffSchemaIssues function will be called by the service when needed
