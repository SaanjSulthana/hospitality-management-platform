-- Event Store for Event Sourcing Architecture - Phase 3
-- Target: Store all domain events for complete audit trail and event replay (1M+ organizations)

CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  event_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(255) NOT NULL,
  aggregate_type VARCHAR(255) NOT NULL,
  aggregate_id VARCHAR(255) NOT NULL,
  org_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  payload JSONB NOT NULL,
  metadata JSONB,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(aggregate_type, aggregate_id, version)
);

-- Primary indexes for efficient event querying
CREATE INDEX IF NOT EXISTS idx_events_aggregate ON events(aggregate_type, aggregate_id, version);
CREATE INDEX IF NOT EXISTS idx_events_org_timestamp ON events(org_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_type_timestamp ON events(event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_aggregate_id ON events(aggregate_id);
CREATE INDEX IF NOT EXISTS idx_events_event_id ON events(event_id);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_events_org_type ON events(org_id, event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_aggregate_version_timestamp ON events(aggregate_type, aggregate_id, version, timestamp);

-- Partial index for recent events (commonly accessed)
CREATE INDEX IF NOT EXISTS idx_events_recent ON events(org_id, timestamp DESC)
  WHERE timestamp > NOW() - INTERVAL '30 days';

-- Comments
COMMENT ON TABLE events IS 'Event store for event sourcing - stores all domain events for audit trails and event replay';
COMMENT ON COLUMN events.event_id IS 'Unique identifier for the event (UUID)';
COMMENT ON COLUMN events.aggregate_type IS 'Type of aggregate (e.g., Revenue, Expense, DailyCashBalance)';
COMMENT ON COLUMN events.aggregate_id IS 'Identifier for the aggregate instance';
COMMENT ON COLUMN events.org_id IS 'Organization ID for multi-tenant queries';
COMMENT ON COLUMN events.version IS 'Version number for the aggregate (for optimistic concurrency)';
COMMENT ON COLUMN events.payload IS 'Event payload data (JSONB for flexible schema)';
COMMENT ON COLUMN events.metadata IS 'Additional metadata (user, IP, etc.)';

