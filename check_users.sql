-- Check if organizations exist
SELECT 'Organizations:' as info;
SELECT id, name, subdomain_prefix FROM organizations;

-- Check if users exist
SELECT 'Users:' as info;
SELECT id, email, role, display_name, org_id FROM users;

-- Check if admin user exists
SELECT 'Admin User:' as info;
SELECT id, email, role, display_name FROM users WHERE email = 'admin@example.com';

-- Count total users
SELECT 'User Count:' as info;
SELECT COUNT(*) as total_users FROM users;




