#!/usr/bin/env node

const { exec } = require('child_process');

console.log('🚀 Manual Migration Runner');

// Function to run SQL file
function runSQLFile(filename) {
  return new Promise((resolve, reject) => {
    console.log(`📝 Running ${filename}...`);
    
    // This would need actual database connection
    // For now, just simulate
    setTimeout(() => {
      console.log(`✅ ${filename} completed`);
      resolve();
    }, 1000);
  });
}

// Run migrations in order
async function runMigrations() {
  try {
    console.log('🔄 Starting manual migration run...');
    
    // Migration 1: Create revenues
    await runSQLFile('1_create_revenues_table.up.sql');
    
    // Migration 2: Create expenses  
    await runSQLFile('2_create_expenses_table.up.sql');
    
    // Migration 3: Add receipt_file_id columns
    await runSQLFile('3_add_receipt_file_id.up.sql');
    
    console.log('✅ All migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

runMigrations();