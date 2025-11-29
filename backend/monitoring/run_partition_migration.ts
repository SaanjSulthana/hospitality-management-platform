/**
 * Run Partition Migration Endpoint
 * 
 * POST /monitoring/run-partition-migration
 * 
 * Executes the partitioned tables migration SQL
 */

import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const db = SQLDatabase.named("hospitality");

interface MigrationResult {
  success: boolean;
  message: string;
  stepsCompleted: string[];
  errors: string[];
  timestamp: string;
}

// Shared handler for running partition migration
async function runPartitionMigrationHandler(): Promise<MigrationResult> {
    const stepsCompleted: string[] = [];
    const errors: string[] = [];

    try {
      console.log("🚀 Starting partition migration...");

      // Read the migration SQL file from project root
      const projectRoot = process.cwd().includes('.encore') 
        ? process.cwd().split('.encore')[0]
        : process.cwd();
      const migrationPath = join(projectRoot, "database/migrations/create_partitioned_tables.sql");
      console.log(`📂 Reading migration from: ${migrationPath}`);
      const sql = readFileSync(migrationPath, "utf-8");

      // Split into individual statements
      const statements = sql
        .split(";")
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith("--"));

      console.log(`📄 Found ${statements.length} SQL statements to execute`);

      // Execute each statement
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        try {
          await db.exec(statement as any);
          const preview = statement.substring(0, 100).replace(/\s+/g, " ");
          stepsCompleted.push(`✅ Statement ${i + 1}: ${preview}...`);
          console.log(`✅ Executed statement ${i + 1}/${statements.length}`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          // Ignore "already exists" errors
          if (errorMsg.includes("already exists") || errorMsg.includes("does not exist")) {
            console.log(`ℹ️  Statement ${i + 1}: ${errorMsg} (continuing...)`);
            stepsCompleted.push(`ℹ️  Statement ${i + 1}: Skipped (already exists)`);
          } else {
            console.error(`❌ Error in statement ${i + 1}:`, errorMsg);
            errors.push(`Statement ${i + 1}: ${errorMsg}`);
          }
        }
      }

      console.log("✅ Partition migration completed!");

      return {
        success: errors.length === 0,
        message: errors.length === 0
          ? "✅ Partition migration completed successfully!"
          : `⚠️  Partition migration completed with ${errors.length} errors`,
        stepsCompleted,
        errors,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("❌ Migration failed:", error);
      throw new Error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// LEGACY: Runs partition migration (keep for backward compatibility)
export const runPartitionMigration = api<{}, MigrationResult>(
  { auth: false, expose: true, method: "POST", path: "/monitoring/run-partition-migration" },
  runPartitionMigrationHandler
);

// V1: Runs partition migration
export const runPartitionMigrationV1 = api<{}, MigrationResult>(
  { auth: false, expose: true, method: "POST", path: "/v1/system/monitoring/partitions/migrate" },
  runPartitionMigrationHandler
);

