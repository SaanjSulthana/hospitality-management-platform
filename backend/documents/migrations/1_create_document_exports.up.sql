-- Create document_exports table
CREATE TABLE IF NOT EXISTS document_exports (
  id BIGSERIAL PRIMARY KEY,
  export_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  export_type TEXT NOT NULL CHECK (export_type IN (
    'daily-report', 'monthly-report', 'yearly-report',
    'staff-leave', 'staff-attendance', 'staff-salary'
  )),
  format TEXT NOT NULL CHECK (format IN ('pdf', 'xlsx')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'processing', 'ready', 'failed', 'expired'
  )),
  bucket_key TEXT,
  storage_location TEXT DEFAULT 'cloud' CHECK (storage_location IN ('local', 'cloud')),
  file_size_bytes BIGINT,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_document_exports_export_id ON document_exports(export_id);
CREATE INDEX IF NOT EXISTS idx_document_exports_org_user ON document_exports(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_document_exports_status ON document_exports(status) WHERE status IN ('queued', 'processing');
CREATE INDEX IF NOT EXISTS idx_document_exports_expires_at ON document_exports(expires_at) WHERE status = 'ready';
CREATE INDEX IF NOT EXISTS idx_document_exports_created_at ON document_exports(created_at DESC);

-- Compound index for user export lists
CREATE INDEX IF NOT EXISTS idx_document_exports_user_list ON document_exports(user_id, created_at DESC) WHERE status != 'expired';

-- Comments for documentation
COMMENT ON TABLE document_exports IS 'Tracks document export jobs with lifecycle management';
COMMENT ON COLUMN document_exports.export_id IS 'Public UUID for API access (not sequential ID)';
COMMENT ON COLUMN document_exports.metadata IS 'Request parameters for retry: {propertyId, date, filters, etc}';
COMMENT ON COLUMN document_exports.expires_at IS 'Auto-calculated as created_at + 24 hours';
COMMENT ON COLUMN document_exports.retry_count IS 'Number of retry attempts (max 3)';

