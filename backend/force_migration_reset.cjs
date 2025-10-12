#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Force Resetting Finance Migrations...');

// Function to temporarily rename problematic migrations
function temporarilyDisableMigrations() {
  const migrationsDir = path.join(__dirname, 'finance', 'migrations');
  
  // List of migrations to temporarily disable (3 onwards)
  const migrationsToDisable = [
    '3_add_receipt_file_id.up.sql',
    '4_create_files_table.up.sql',
    '5_add_receipt_file_constraints.up.sql',
    '6_create_daily_approvals.up.sql',
    '7_add_revenue_status.up.sql',
    '8_add_payment_modes.up.sql',
    '9_create_deletion_requests.up.sql',
    '10_fix_expense_date_column.up.sql',
    '11_create_notifications.up.sql',
    '12_enhance_daily_balances.up.sql'
  ];
  
  console.log('📁 Temporarily disabling problematic migrations...');
  
  migrationsToDisable.forEach(migration => {
    const originalPath = path.join(migrationsDir, migration);
    const disabledPath = path.join(migrationsDir, migration + '.disabled');
    
    if (fs.existsSync(originalPath)) {
      fs.renameSync(originalPath, disabledPath);
      console.log(`✅ Disabled: ${migration}`);
    }
  });
}

// Function to re-enable migrations after base tables are created
function reEnableMigrations() {
  const migrationsDir = path.join(__dirname, 'finance', 'migrations');
  
  // Find all disabled migration files
  const files = fs.readdirSync(migrationsDir);
  const disabledFiles = files.filter(file => file.endsWith('.disabled'));
  
  console.log('📁 Re-enabling migrations...');
  
  disabledFiles.forEach(file => {
    const disabledPath = path.join(migrationsDir, file);
    const originalPath = path.join(migrationsDir, file.replace('.disabled', ''));
    
    fs.renameSync(disabledPath, originalPath);
    console.log(`✅ Re-enabled: ${file.replace('.disabled', '')}`);
  });
}

// Function to create a simple test script
function createTestScript() {
  const testScript = `#!/usr/bin/env node

console.log('🧪 Testing Finance Migrations...');

// Wait for base migrations to complete
setTimeout(() => {
  console.log('✅ Base migrations should be complete now');
  console.log('🔄 Re-enabling remaining migrations...');
  
  const fs = require('fs');
  const path = require('path');
  
  const migrationsDir = path.join(__dirname, 'finance', 'migrations');
  const files = fs.readdirSync(migrationsDir);
  const disabledFiles = files.filter(file => file.endsWith('.disabled'));
  
  disabledFiles.forEach(file => {
    const disabledPath = path.join(migrationsDir, file);
    const originalPath = path.join(migrationsDir, file.replace('.disabled', ''));
    
    fs.renameSync(disabledPath, originalPath);
    console.log(\`✅ Re-enabled: \${file.replace('.disabled', '')}\`);
  });
  
  console.log('🎉 All migrations re-enabled!');
}, 10000); // Wait 10 seconds
`;

  fs.writeFileSync(path.join(__dirname, 'test_migrations.cjs'), testScript);
  console.log('✅ Test script created');
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting Force Migration Reset...');
    
    // Step 1: Temporarily disable problematic migrations
    temporarilyDisableMigrations();
    
    // Step 2: Create test script
    createTestScript();
    
    console.log('✅ Force Migration Reset Complete!');
    console.log('');
    console.log('📋 What was done:');
    console.log('  - Temporarily disabled migrations 3-12');
    console.log('  - Only migrations 1 and 2 will run initially');
    console.log('  - Created test script to re-enable migrations later');
    console.log('');
    console.log('🔄 Next Steps:');
    console.log('  1. Run: npx encore run --watch');
    console.log('  2. Wait for base tables to be created');
    console.log('  3. Run: node test_migrations.cjs (in another terminal)');
    console.log('  4. Restart Encore to apply remaining migrations');
    
  } catch (error) {
    console.error('❌ Error during force reset:', error);
    process.exit(1);
  }
}

// Run the force reset
main();
