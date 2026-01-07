-- Migration 100: Revert Fix Realtime Schema
-- No-op revert
DO $$
BEGIN
    RAISE NOTICE 'Reverting migration 100 - doing nothing to preserve data';
END $$;
