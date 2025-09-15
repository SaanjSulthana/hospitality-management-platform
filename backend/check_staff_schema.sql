-- Check staff table schema
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'staff' 
ORDER BY ordinal_position;

-- Check if specific columns exist
SELECT 
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staff' AND column_name = 'performance_rating'
    ) THEN 'EXISTS' ELSE 'MISSING' END as performance_rating_status,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staff' AND column_name = 'salary_type'
    ) THEN 'EXISTS' ELSE 'MISSING' END as salary_type_status,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staff' AND column_name = 'base_salary_cents'
    ) THEN 'EXISTS' ELSE 'MISSING' END as base_salary_cents_status;

