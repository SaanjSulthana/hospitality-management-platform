-- Create properties table in hospitality database for reports service
-- This table is needed for monthly/yearly reports that join with properties

CREATE TABLE IF NOT EXISTS properties (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL,
  region_id BIGINT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('hostel', 'hotel', 'resort', 'apartment')),
  address_json JSONB DEFAULT '{}',
  amenities_json JSONB DEFAULT '{}',
  capacity_json JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_properties_org_id ON properties(org_id);
CREATE INDEX IF NOT EXISTS idx_properties_region_id ON properties(region_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);

-- Add comment
COMMENT ON TABLE properties IS 'Properties table for reports service - synced from auth database';

