-- Rollback event store table
DROP INDEX IF EXISTS idx_event_store_timestamp;
DROP INDEX IF EXISTS idx_event_store_type;
DROP INDEX IF EXISTS idx_event_store_entity;
DROP INDEX IF EXISTS idx_event_store_org_property;

DROP TABLE IF EXISTS finance_event_store;

