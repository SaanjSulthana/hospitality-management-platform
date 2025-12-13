-- Remove the composite index on sessions table
-- This reverses the performance optimization added in the UP migration

DROP INDEX IF EXISTS idx_sessions_user_expires_created;