-- =====================================================
-- VERIFICATION SCRIPT FOR STAFF DATABASE FIELDS
-- =====================================================
-- Run this to verify that all required fields exist

-- Check staff_attendance table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'staff_attendance' 
ORDER BY ordinal_position;

-- Check staff table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'staff' 
ORDER BY ordinal_position;

-- Verify required columns exist in staff_attendance
SELECT 
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staff_attendance' AND column_name = 'total_hours'
    ) THEN '✅ total_hours exists' ELSE '❌ total_hours missing' END as total_hours_check,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staff_attendance' AND column_name = 'overtime_hours'
    ) THEN '✅ overtime_hours exists' ELSE '❌ overtime_hours missing' END as overtime_hours_check;

-- Verify required columns exist in staff
SELECT 
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staff' AND column_name = 'performance_rating'
    ) THEN '✅ performance_rating exists' ELSE '❌ performance_rating missing' END as performance_rating_check,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staff' AND column_name = 'salary_type'
    ) THEN '✅ salary_type exists' ELSE '❌ salary_type missing' END as salary_type_check,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staff' AND column_name = 'base_salary_cents'
    ) THEN '✅ base_salary_cents exists' ELSE '❌ base_salary_cents missing' END as base_salary_cents_check;

-- Check constraint on staff_attendance status
SELECT 
    constraint_name, 
    check_clause
FROM information_schema.check_constraints 
WHERE table_name = 'staff_attendance' 
AND constraint_name LIKE '%status%';

-- Count records with new fields
SELECT 
    'staff_attendance' as table_name,
    COUNT(*) as total_records,
    COUNT(total_hours) as records_with_total_hours,
    COUNT(overtime_hours) as records_with_overtime_hours
FROM staff_attendance
UNION ALL
SELECT 
    'staff' as table_name,
    COUNT(*) as total_records,
    COUNT(performance_rating) as records_with_performance_rating,
    COUNT(salary_type) as records_with_salary_type
FROM staff;
