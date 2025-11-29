-- Event Store for Event Sourcing Architecture
-- Target: Store all domain events for complete audit trail and event replay

CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  aggregate_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(255) NOT NULL,
  version INTEGER NOT NULL,
  event_data JSONB NOT NULL,
  metadata JSONB,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(aggregate_id, version)
);

-- Indexes for efficient querying
CREATE INDEX idx_events_aggregate_id ON events(aggregate_id);
CREATE INDEX idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_aggregate_version ON events(aggregate_id, version);

-- Composite index for event stream queries
CREATE INDEX idx_events_aggregate_version_timestamp ON events(aggregate_id, version, timestamp);

-- Index for event type queries
CREATE INDEX idx_events_type_timestamp ON events(event_type, timestamp);

-- Partition by month for better performance with large datasets
-- This will be implemented in a future migration for 1M+ organizations
