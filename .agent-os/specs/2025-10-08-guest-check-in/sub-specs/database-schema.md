# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-10-08-guest-check-in/spec.md

## New Tables

### guest_checkins

Stores all guest check-in information with support for both Indian and foreign guests.

```sql
CREATE TABLE IF NOT EXISTS guest_checkins (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  property_id INTEGER NOT NULL,
  guest_type VARCHAR(20) NOT NULL CHECK (guest_type IN ('indian', 'foreign')),
  
  -- Personal Information
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address TEXT NOT NULL,
  
  -- Indian Guest ID Fields
  aadhar_number VARCHAR(12),
  pan_number VARCHAR(10),
  
  -- Foreign Guest ID Fields
  passport_number VARCHAR(50),
  country VARCHAR(100),
  visa_type VARCHAR(50),
  visa_expiry_date DATE,
  
  -- Booking Information
  check_in_date TIMESTAMP NOT NULL DEFAULT NOW(),
  expected_checkout_date DATE,
  actual_checkout_date TIMESTAMP,
  room_number VARCHAR(20),
  number_of_guests INTEGER DEFAULT 1,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'checked_in' CHECK (status IN ('checked_in', 'checked_out', 'cancelled')),
  
  -- Audit Fields
  created_by_user_id INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  checked_out_by_user_id INTEGER,
  
  -- Constraints
  CONSTRAINT fk_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  CONSTRAINT valid_guest_type_fields CHECK (
    (guest_type = 'indian' AND aadhar_number IS NOT NULL) OR
    (guest_type = 'foreign' AND passport_number IS NOT NULL)
  )
);

-- Indexes for performance
CREATE INDEX idx_guest_checkins_org_id ON guest_checkins(org_id);
CREATE INDEX idx_guest_checkins_property_id ON guest_checkins(property_id);
CREATE INDEX idx_guest_checkins_status ON guest_checkins(status);
CREATE INDEX idx_guest_checkins_check_in_date ON guest_checkins(check_in_date);
CREATE INDEX idx_guest_checkins_guest_type ON guest_checkins(guest_type);
CREATE INDEX idx_guest_checkins_email ON guest_checkins(email);
CREATE INDEX idx_guest_checkins_phone ON guest_checkins(phone);
```

## Rationale

### Guest Type Differentiation
The `guest_type` field allows for flexible handling of Indian and foreign guests while maintaining a single table structure. Conditional constraints ensure appropriate ID fields are populated based on guest type.

### Comprehensive ID Support
- **Indian Guests**: Aadhar (12 digits) and PAN (10 characters) support
- **Foreign Guests**: Passport, country, visa type, and visa expiry tracking

### Audit Trail
Complete audit trail with created_by, updated_at, and checked_out_by fields for compliance and tracking.

### Status Management
Three-state status system (checked_in, checked_out, cancelled) for complete lifecycle management.

### Performance Optimization
Strategic indexes on frequently queried fields (org_id, property_id, status, check_in_date, guest_type) ensure fast queries even with large datasets.

### Data Integrity
Foreign key constraints ensure referential integrity with properties table. Check constraints validate guest_type and status values.

## Migration Strategy

The migration will be created in the guest-checkin microservice migrations folder following the Encore.dev pattern:
- File: `backend/guest-checkin/migrations/1_create_guest_checkins.up.sql`
- Rollback: `backend/guest-checkin/migrations/1_create_guest_checkins.down.sql`
