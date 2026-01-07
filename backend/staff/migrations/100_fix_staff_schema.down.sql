-- Migration 100: Revert Fix Staff Schema
DO $$
BEGIN
    RAISE NOTICE 'Reverting migration 100 - doing nothing to preserve data';
END $$;
