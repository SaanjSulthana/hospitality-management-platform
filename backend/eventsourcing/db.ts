import { SQLDatabase } from "encore.dev/storage/sqldb";

// Event Store Database for event sourcing and audit trails
export const eventStoreDB = SQLDatabase.named("event_store", {
  maxConnections: 50,
  minConnections: 5,
  maxIdleTime: "15m",
  maxLifetime: "1h",
  connectionTimeout: "30s",
  queryTimeout: "60s"
});

// Read Models Database for materialized projections
export const readModelsDB = SQLDatabase.named("read_models", {
  maxConnections: 50,
  minConnections: 5,
  maxIdleTime: "15m",
  maxLifetime: "1h",
  connectionTimeout: "30s",
  queryTimeout: "60s"
});

