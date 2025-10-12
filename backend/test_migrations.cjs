#!/usr/bin/env node

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
    console.log(`✅ Re-enabled: ${file.replace('.disabled', '')}`);
  });
  
  console.log('🎉 All migrations re-enabled!');
}, 10000); // Wait 10 seconds
