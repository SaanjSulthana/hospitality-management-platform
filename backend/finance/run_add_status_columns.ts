import { SQLDatabase } from "encore.dev/storage/sqldb";
import { readFileSync } from "fs";
import { join } from "path";

// Create a database connection
const db = new SQLDatabase("finance", {
  migrations: "./migrations",
});

async function addStatusColumns() {
  try {
    console.log("🚀 Starting to add status columns...");
    
    // Read the SQL file
    const sqlPath = join(__dirname, "add_status_columns.sql");
    const sql = readFileSync(sqlPath, "utf8");
    
    // Split the SQL into individual statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`\n🔧 Executing statement ${i + 1}/${statements.length}:`);
        console.log(statement.substring(0, 100) + (statement.length > 100 ? '...' : ''));
        
        try {
          await db.exec(statement);
          console.log("✅ Statement executed successfully");
        } catch (error: any) {
          console.log(`⚠️  Statement failed (this might be expected): ${error.message}`);
        }
      }
    }
    
    console.log("\n🎉 Status columns addition completed!");
    
    // Verify the changes
    console.log("\n📊 Verifying changes...");
    const result = await db.queryAll`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name IN ('revenues', 'expenses') 
        AND column_name IN ('status', 'payment_mode', 'bank_reference', 'receipt_file_id', 'approved_by_user_id', 'approved_at')
      ORDER BY table_name, column_name
    `;
    
    console.log("\n📋 Current column status:");
    result.forEach(row => {
      console.log(`  ${row.table_name}.${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default || 'none'})`);
    });
    
    // Check if both tables have status columns
    const statusColumns = result.filter(row => row.column_name === 'status');
    if (statusColumns.length === 2) {
      console.log("\n✅ SUCCESS: Both revenues and expenses tables now have status columns!");
    } else {
      console.log(`\n⚠️  WARNING: Only ${statusColumns.length} status columns found. Expected 2.`);
    }
    
  } catch (error) {
    console.error("❌ Error adding status columns:", error);
    throw error;
  }
}

// Run the function
addStatusColumns()
  .then(() => {
    console.log("\n🎯 Status columns implementation completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Failed to implement status columns:", error);
    process.exit(1);
  });
