-- Add composite index on sessions table for improved query performance
-- This index optimizes queries that filter by user_id, order by created_at, and filter by expires_at
-- Expected performance improvement: from 10-500ms (table scans) to ~5-10ms (index lookups)

CREATE INDEX IF NOT EXISTS idx_sessions_user_expires_created 
ON sessions (user_id, expires_at, created_at);