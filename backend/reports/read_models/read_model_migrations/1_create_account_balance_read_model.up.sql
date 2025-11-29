-- Read Model for Account Balance Projection
-- Target: Fast read access to current account balances

CREATE TABLE account_balance_read_model (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  property_id INTEGER NOT NULL,
  current_balance BIGINT NOT NULL DEFAULT 0,
  last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, property_id)
);

-- Indexes for efficient querying
CREATE INDEX idx_account_balance_org_property ON account_balance_read_model(org_id, property_id);
CREATE INDEX idx_account_balance_last_updated ON account_balance_read_model(last_updated DESC);

-- Composite index for organization-level queries
CREATE INDEX idx_account_balance_org_updated ON account_balance_read_model(org_id, last_updated DESC);
