-- Database Data Inspection Script
-- Check all main tables for data

\echo '=== ORGANIZATIONS ==='
SELECT COUNT(*) as total_orgs FROM organizations;
SELECT id, name, created_at FROM organizations LIMIT 3;

\echo '=== USERS ==='
SELECT COUNT(*) as total_users FROM users;
SELECT id, email, role, display_name, created_at FROM users LIMIT 5;

\echo '=== PROPERTIES ==='
SELECT COUNT(*) as total_properties FROM properties;
SELECT id, name, type, status FROM properties LIMIT 5;

\echo '=== STAFF ==='
SELECT COUNT(*) as total_staff FROM staff;
SELECT id, user_id, property_id, department, status FROM staff LIMIT 5;

\echo '=== TASKS ==='
SELECT COUNT(*) as total_tasks FROM tasks;
SELECT id, title, type, priority, status, created_at FROM tasks LIMIT 5;

\echo '=== EXPENSES ==='
SELECT COUNT(*) as total_expenses FROM expenses;
SELECT id, category, amount_cents, status, payment_mode, created_at FROM expenses LIMIT 5;

\echo '=== REVENUES ==='
SELECT COUNT(*) as total_revenues FROM revenues;
SELECT id, source, amount_cents, status, payment_mode, created_at FROM revenues LIMIT 5;

\echo '=== NOTIFICATIONS ==='
SELECT COUNT(*) as total_notifications FROM notifications;
SELECT id, type, read_at, created_at FROM notifications LIMIT 5;

\echo '=== RECENT ACTIVITY (Last 7 days) ==='
SELECT 'tasks' as entity, COUNT(*) as count FROM tasks WHERE created_at >= NOW() - INTERVAL '7 days'
UNION ALL
SELECT 'expenses' as entity, COUNT(*) as count FROM expenses WHERE created_at >= NOW() - INTERVAL '7 days'
UNION ALL
SELECT 'revenues' as entity, COUNT(*) as count FROM revenues WHERE created_at >= NOW() - INTERVAL '7 days'
UNION ALL
SELECT 'notifications' as entity, COUNT(*) as count FROM notifications WHERE created_at >= NOW() - INTERVAL '7 days';
