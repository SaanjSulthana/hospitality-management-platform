-- Read Models Table for Event Sourcing - Phase 3
-- Target: Store materialized projections for fast query performance (1M+ organizations)

CREATE TABLE IF NOT EXISTS read_models (
  id BIGSERIAL PRIMARY KEY,
  model_id VARCHAR(255) UNIQUE NOT NULL,
  model_type VARCHAR(255) NOT NULL,
  org_id INTEGER NOT NULL,
  data JSONB NOT NULL,
  version INTEGER NOT NULL,
  last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
  size INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(model_type, org_id)
);

-- Indexes for efficient read model querying
CREATE INDEX IF NOT EXISTS idx_read_models_type_org ON read_models(model_type, org_id);
CREATE INDEX IF NOT EXISTS idx_read_models_org ON read_models(org_id);
CREATE INDEX IF NOT EXISTS idx_read_models_type ON read_models(model_type);
CREATE INDEX IF NOT EXISTS idx_read_models_updated ON read_models(last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_read_models_version ON read_models(model_type, org_id, version DESC);

-- GIN index for JSONB data queries
CREATE INDEX IF NOT EXISTS idx_read_models_data_gin ON read_models USING GIN (data);

-- Partial index for recent models (commonly accessed)
CREATE INDEX IF NOT EXISTS idx_read_models_recent ON read_models(org_id, model_type)
  WHERE last_updated > NOW() - INTERVAL '7 days';

-- Comments
COMMENT ON TABLE read_models IS 'Materialized read models for event sourcing - optimized projections for fast queries';
COMMENT ON COLUMN read_models.model_id IS 'Unique identifier for the read model (type_orgId_version)';
COMMENT ON COLUMN read_models.model_type IS 'Type of read model (e.g., AccountBalance, RevenueReport)';
COMMENT ON COLUMN read_models.org_id IS 'Organization ID for multi-tenant queries';
COMMENT ON COLUMN read_models.data IS 'Materialized projection data (JSONB for flexible schema)';
COMMENT ON COLUMN read_models.version IS 'Version number of the projection (from events)';
COMMENT ON COLUMN read_models.size IS 'Size of the data in bytes';

