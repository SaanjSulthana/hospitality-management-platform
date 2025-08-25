-- Organizations table
CREATE TABLE organizations (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  primary_domain TEXT,
  subdomain_prefix TEXT UNIQUE,
  theme_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table with simplified roles
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MANAGER')),
  display_name TEXT NOT NULL,
  created_by_user_id BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  UNIQUE(org_id, email)
);

-- Sessions table
CREATE TABLE sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Regions table
CREATE TABLE regions (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);

-- Properties table
CREATE TABLE properties (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  region_id BIGINT REFERENCES regions(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('hostel', 'hotel', 'resort', 'apartment')),
  address_json JSONB DEFAULT '{}',
  amenities_json JSONB DEFAULT '{}',
  capacity_json JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rooms table
CREATE TABLE rooms (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 1,
  attributes_json JSONB DEFAULT '{}'
);

-- Beds or units table
CREATE TABLE beds_or_units (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  room_id BIGINT REFERENCES rooms(id),
  property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'occupied', 'oo')) DEFAULT 'available',
  meta_json JSONB DEFAULT '{}'
);

-- Staff table
CREATE TABLE staff (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id BIGINT REFERENCES properties(id),
  department TEXT NOT NULL CHECK (department IN ('frontdesk', 'housekeeping', 'maintenance', 'fnb', 'admin')),
  schedule_json JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active'
);

-- Guests table
CREATE TABLE guests (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  primary_contact_json JSONB DEFAULT '{}',
  notes_text TEXT
);

-- Bookings table
CREATE TABLE bookings (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  guest_id BIGINT NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL,
  checkout_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled')) DEFAULT 'pending',
  price_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  channel TEXT NOT NULL CHECK (channel IN ('direct', 'ota')) DEFAULT 'direct',
  meta_json JSONB DEFAULT '{}'
);

-- Tasks table
CREATE TABLE tasks (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('maintenance', 'housekeeping', 'service')),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'med', 'high')) DEFAULT 'med',
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'blocked', 'done')) DEFAULT 'open',
  assignee_staff_id BIGINT REFERENCES staff(id),
  due_at TIMESTAMPTZ,
  created_by_user_id BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approvals table
CREATE TABLE approvals (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('leave', 'expense', 'task')),
  entity_id BIGINT NOT NULL,
  requested_by_user_id BIGINT NOT NULL REFERENCES users(id),
  approver_user_id BIGINT REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

-- Expenses table
CREATE TABLE expenses (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  receipt_url TEXT,
  created_by_user_id BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Revenues table
CREATE TABLE revenues (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('room', 'addon', 'other')),
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  occurred_at TIMESTAMPTZ NOT NULL,
  meta_json JSONB DEFAULT '{}'
);

-- Notifications table
CREATE TABLE notifications (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload_json JSONB DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User properties junction table
CREATE TABLE user_properties (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, property_id)
);

-- Signup tokens table
CREATE TABLE signup_tokens (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_org_id ON users(org_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_by ON users(created_by_user_id);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_regions_org_id ON regions(org_id);
CREATE INDEX idx_properties_org_id ON properties(org_id);
CREATE INDEX idx_properties_region_id ON properties(region_id);
CREATE INDEX idx_rooms_org_id ON rooms(org_id);
CREATE INDEX idx_rooms_property_id ON rooms(property_id);
CREATE INDEX idx_beds_or_units_org_id ON beds_or_units(org_id);
CREATE INDEX idx_beds_or_units_property_id ON beds_or_units(property_id);
CREATE INDEX idx_staff_org_id ON staff(org_id);
CREATE INDEX idx_staff_user_id ON staff(user_id);
CREATE INDEX idx_staff_property_id ON staff(property_id);
CREATE INDEX idx_guests_org_id ON guests(org_id);
CREATE INDEX idx_bookings_org_id ON bookings(org_id);
CREATE INDEX idx_bookings_property_id ON bookings(property_id);
CREATE INDEX idx_bookings_guest_id ON bookings(guest_id);
CREATE INDEX idx_bookings_dates ON bookings(checkin_date, checkout_date);
CREATE INDEX idx_tasks_org_id ON tasks(org_id);
CREATE INDEX idx_tasks_property_id ON tasks(property_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_staff_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_approvals_org_id ON approvals(org_id);
CREATE INDEX idx_expenses_org_id ON expenses(org_id);
CREATE INDEX idx_expenses_property_id ON expenses(property_id);
CREATE INDEX idx_revenues_org_id ON revenues(org_id);
CREATE INDEX idx_revenues_property_id ON revenues(property_id);
CREATE INDEX idx_notifications_org_id ON notifications(org_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_signup_tokens_token ON signup_tokens(token);
CREATE INDEX idx_signup_tokens_expires_at ON signup_tokens(expires_at);

-- Insert default organization and admin user
INSERT INTO organizations (name, subdomain_prefix, theme_json) 
VALUES ('Example Company', 'example', '{"primaryColor": "#3b82f6", "brandName": "Example Company"}');

-- Insert admin user with hashed password for "password123"
-- This will be updated by the seed script to ensure consistency
INSERT INTO users (org_id, email, password_hash, role, display_name) 
VALUES (
  1, 
  'admin@example.com', 
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdXig/pjLw3jm', 
  'ADMIN', 
  'System Administrator'
);
