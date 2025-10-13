#!/usr/bin/env node

import { fixStaffSchemaIssues } from "./fix_schema_issues";

async function main() {
  console.log("🚀 Starting Staff Schema Fix...");
  
  try {
    await fixStaffSchemaIssues();
    console.log("✅ Staff schema fix completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Staff schema fix failed:", error);
    process.exit(1);
  }
}

// Run if called directly (ES module equivalent)
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1].endsWith('run_schema_fix.ts')) {
  main();
}
