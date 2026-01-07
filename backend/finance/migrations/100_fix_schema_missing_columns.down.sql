-- Migration 100: Revert Fix Schema
-- This is a no-op revert because we don't want to remove columns that should be there.
-- If you really need to revert, you should manually drop columns, but that's destructive.

DO $$
BEGIN
    RAISE NOTICE 'Reverting migration 100 which added missing columns - doing nothing to preserve data';
END $$;
