-- Check if tables exist and create test user
\dt

-- Check if organizations exist
SELECT * FROM organizations LIMIT 5;

-- Check if users exist
SELECT * FROM users LIMIT 5;

-- Create test user if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@example.com') THEN
    INSERT INTO users (org_id, email, password_hash, role, display_name) 
    VALUES (
      (SELECT id FROM organizations WHERE subdomain_prefix = 'example' LIMIT 1),
      'admin@example.com', 
      '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdXig/pjLw3jm', 
      'ADMIN', 
      'System Administrator'
    );
    RAISE NOTICE 'Test user created successfully';
  ELSE
    RAISE NOTICE 'Test user already exists';
  END IF;
END $$;

-- Also create alternative test user
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'info@hostelexp.in') THEN
    INSERT INTO users (org_id, email, password_hash, role, display_name) 
    VALUES (
      (SELECT id FROM organizations WHERE subdomain_prefix = 'example' LIMIT 1),
      'info@hostelexp.in', 
      '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdXig/pjLw3jm', 
      'ADMIN', 
      'Hostel Admin'
    );
    RAISE NOTICE 'Alternative test user created successfully';
  ELSE
    RAISE NOTICE 'Alternative test user already exists';
  END IF;
END $$;

-- Show final user list
SELECT id, email, role, display_name FROM users;
