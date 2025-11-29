-- Create user_properties junction table in hospitality database for reports service
-- This table is needed for monthly/yearly reports that check user property access

CREATE TABLE IF NOT EXISTS user_properties (
  user_id BIGINT NOT NULL,
  property_id BIGINT NOT NULL,
  PRIMARY KEY (user_id, property_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_properties_user_id ON user_properties(user_id);
CREATE INDEX IF NOT EXISTS idx_user_properties_property_id ON user_properties(property_id);

-- Add comment
COMMENT ON TABLE user_properties IS 'User properties junction table for reports service - synced from auth database';

