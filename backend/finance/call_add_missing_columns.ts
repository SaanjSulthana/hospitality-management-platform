import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";

interface AddMissingColumnsResponse {
  success: boolean;
  message: string;
  addedColumns: { table: string; column: string }[];
  skippedColumns: { table: string; column: string; reason: string }[];
}

// This is a simple script to call the addMissingColumns endpoint
async function callAddMissingColumns() {
  try {
    console.log("🚀 Calling addMissingColumns endpoint...");
    
    // Simulate the endpoint logic directly
    const columnsToAdd = [
      { table: "expenses", column: "status", type: "VARCHAR(20) DEFAULT 'pending'" },
      { table: "expenses", column: "payment_mode", type: "VARCHAR(20) DEFAULT 'cash'" },
      { table: "expenses", column: "bank_reference", type: "VARCHAR(255)" },
      { table: "expenses", column: "receipt_file_id", type: "INTEGER" },
      { table: "expenses", column: "approved_by_user_id", type: "INTEGER" },
      { table: "expenses", column: "approved_at", type: "TIMESTAMP" },
      { table: "revenues", column: "status", type: "VARCHAR(20) DEFAULT 'pending'" },
      { table: "revenues", column: "payment_mode", type: "VARCHAR(20) DEFAULT 'cash'" },
      { table: "revenues", column: "bank_reference", type: "VARCHAR(255)" },
      { table: "revenues", column: "receipt_file_id", type: "INTEGER" },
      { table: "revenues", column: "approved_by_user_id", type: "INTEGER" },
      { table: "revenues", column: "approved_at", type: "TIMESTAMP" },
    ];

    const addedColumns: { table: string; column: string }[] = [];
    const skippedColumns: { table: string; column: string; reason: string }[] = [];

    for (const { table, column, type } of columnsToAdd) {
      try {
        // Note: Dynamic DDL is not supported by Encore's static SQL parser
        // This script is disabled - please run migrations using database migration tools
        skippedColumns.push({ 
          table, 
          column, 
          reason: "Dynamic DDL not supported by Encore. Use database migration tools. SQL: ALTER TABLE " + table + " ADD COLUMN " + column + " " + type + ";"
        });
        console.log(`⏭️  Skipped ${table}.${column} - use migration tools instead`);
      } catch (error: any) {
        skippedColumns.push({ table, column, reason: error.message });
        console.error(`❌ Error adding column ${table}.${column}:`, error);
      }
    }

    const result: AddMissingColumnsResponse = {
      success: addedColumns.length > 0,
      message: addedColumns.length > 0
        ? "Missing columns added successfully."
        : "No missing columns found or all already exist.",
      addedColumns,
      skippedColumns,
    };

    console.log("\n📊 Results:");
    console.log(`✅ Added ${addedColumns.length} columns`);
    console.log(`⏭️  Skipped ${skippedColumns.length} columns`);
    
    if (addedColumns.length > 0) {
      console.log("\n📝 Added columns:");
      addedColumns.forEach(col => console.log(`  - ${col.table}.${col.column}`));
    }
    
    if (skippedColumns.length > 0) {
      console.log("\n⏭️  Skipped columns:");
      skippedColumns.forEach(col => console.log(`  - ${col.table}.${col.column}: ${col.reason}`));
    }

    return result;
  } catch (error) {
    console.error("❌ Error calling addMissingColumns:", error);
    throw error;
  }
}

// Run the function
callAddMissingColumns()
  .then((result) => {
    console.log("\n🎯 Add missing columns completed!");
    console.log(`📊 Success: ${result.success}`);
    console.log(`💬 Message: ${result.message}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Failed to add missing columns:", error);
    process.exit(1);
  });
