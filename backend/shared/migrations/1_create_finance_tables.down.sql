-- Rollback: Drop finance tables from shared database
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS revenues CASCADE;
