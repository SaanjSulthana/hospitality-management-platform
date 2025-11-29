import { SQLDatabase } from "encore.dev/storage/sqldb";
import { EMERGENCY_DB_CONFIG } from "../database/connection_pool_config";

export const reportsDB = SQLDatabase.named("hospitality", {
  // Connection pool configuration for emergency scaling
  maxConnections: EMERGENCY_DB_CONFIG.maxConnections,
  minConnections: EMERGENCY_DB_CONFIG.minConnections,
  maxIdleTime: EMERGENCY_DB_CONFIG.maxIdleTime,
  maxLifetime: EMERGENCY_DB_CONFIG.maxLifetime,
  connectionTimeout: EMERGENCY_DB_CONFIG.connectionTimeout,
  queryTimeout: EMERGENCY_DB_CONFIG.queryTimeout
});
