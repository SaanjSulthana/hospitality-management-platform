-- Snapshots Table for Event Sourcing - Phase 3
-- Target: Store aggregate snapshots to optimize event replay performance

CREATE TABLE IF NOT EXISTS snapshots (
  id BIGSERIAL PRIMARY KEY,
  aggregate_type VARCHAR(255) NOT NULL,
  aggregate_id VARCHAR(255) NOT NULL,
  org_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  state JSONB NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(aggregate_type, aggregate_id)
);

-- Indexes for efficient snapshot retrieval
CREATE INDEX IF NOT EXISTS idx_snapshots_aggregate ON snapshots(aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_org ON snapshots(org_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON snapshots(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_version ON snapshots(aggregate_type, aggregate_id, version DESC);

-- Comments
COMMENT ON TABLE snapshots IS 'Aggregate snapshots for optimizing event replay - stores current state at specific versions';
COMMENT ON COLUMN snapshots.aggregate_type IS 'Type of aggregate (e.g., Revenue, Expense, DailyCashBalance)';
COMMENT ON COLUMN snapshots.aggregate_id IS 'Identifier for the aggregate instance';
COMMENT ON COLUMN snapshots.org_id IS 'Organization ID for multi-tenant queries';
COMMENT ON COLUMN snapshots.version IS 'Version number of the aggregate when snapshot was taken';
COMMENT ON COLUMN snapshots.state IS 'Full state of the aggregate at this version (JSONB)';

