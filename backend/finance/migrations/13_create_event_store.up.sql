-- Create event store table for audit trail
-- Migration 13 (12 is already taken by enhance_daily_balances)
CREATE TABLE IF NOT EXISTS finance_event_store (
  id SERIAL PRIMARY KEY,
  event_id UUID NOT NULL UNIQUE,
  event_version VARCHAR(10) NOT NULL DEFAULT 'v1',
  event_type VARCHAR(50) NOT NULL,
  
  org_id INTEGER NOT NULL,
  property_id INTEGER,
  user_id INTEGER NOT NULL,
  
  entity_id INTEGER NOT NULL,
  entity_type VARCHAR(30) NOT NULL,
  event_payload JSONB NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  correlation_id UUID
  
  -- Note: Foreign key constraints removed as org_id and user_id reference 
  -- tables in the auth service database, which is not accessible from finance service
);

CREATE INDEX idx_event_store_org_property ON finance_event_store(org_id, property_id);
CREATE INDEX idx_event_store_entity ON finance_event_store(entity_type, entity_id);
CREATE INDEX idx_event_store_type ON finance_event_store(event_type);
CREATE INDEX idx_event_store_timestamp ON finance_event_store(created_at DESC);

