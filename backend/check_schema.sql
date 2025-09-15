-- Check if status column exists in revenues table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'revenues' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if status column exists in expenses table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'expenses' 
AND table_schema = 'public'
ORDER BY ordinal_position;

