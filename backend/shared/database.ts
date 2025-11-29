import { SQLDatabase } from "encore.dev/storage/sqldb";

// Shared database connection for cross-service access
// This allows reports service to access finance tables (revenues, expenses)
export const sharedDB = new SQLDatabase("shared", {
  migrations: "./migrations",
});
