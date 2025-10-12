/**
 * Migration Verification Script
 * Run this to verify that migrations were applied correctly
 * Usage: encore run && bun run backend/guest-checkin/verify-migration.ts
 */

import { guestCheckinDB } from "./db";

interface VerificationResult {
  check: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: VerificationResult[] = [];

async function verifyGuestCheckinsTable() {
  try {
    // Check table exists
    const tableExists = await guestCheckinDB.queryRow`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'guest_checkins'
    `;
    
    results.push({
      check: "guest_checkins table exists",
      passed: !!tableExists,
      details: tableExists ? "✓ Table found" : "✗ Table not found"
    });

    // Check new columns exist
    const columns = await guestCheckinDB.queryAll`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'guest_checkins'
      AND column_name IN ('data_source', 'data_verified', 'verified_by_user_id', 'verified_at')
    `;
    
    const expectedColumns = ['data_source', 'data_verified', 'verified_by_user_id', 'verified_at'];
    const foundColumns = columns.map((c: any) => c.column_name);
    const allColumnsExist = expectedColumns.every(col => foundColumns.includes(col));
    
    results.push({
      check: "guest_checkins new columns",
      passed: allColumnsExist,
      details: `Found ${foundColumns.length}/4 columns: ${foundColumns.join(', ')}`
    });

  } catch (error: any) {
    results.push({
      check: "guest_checkins table verification",
      passed: false,
      error: error.message
    });
  }
}

async function verifyGuestDocumentsTable() {
  try {
    // Check table exists
    const tableExists = await guestCheckinDB.queryRow`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'guest_documents'
    `;
    
    results.push({
      check: "guest_documents table exists",
      passed: !!tableExists,
      details: tableExists ? "✓ Table found" : "✗ Table not found"
    });

    if (!tableExists) return;

    // Check column count
    const columns = await guestCheckinDB.queryAll`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'guest_documents'
    `;
    
    results.push({
      check: "guest_documents columns count",
      passed: columns.length >= 24,
      details: `Found ${columns.length} columns (expected ≥24)`
    });

    // Check JSONB column
    const jsonbColumn = await guestCheckinDB.queryRow`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name = 'guest_documents'
      AND column_name = 'extracted_data'
    `;
    
    results.push({
      check: "extracted_data is JSONB",
      passed: jsonbColumn?.data_type === 'jsonb',
      details: `Type: ${jsonbColumn?.data_type}`
    });

    // Check indexes
    const indexes = await guestCheckinDB.queryAll`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'guest_documents'
    `;
    
    results.push({
      check: "guest_documents indexes",
      passed: indexes.length >= 8,
      details: `Found ${indexes.length} indexes (expected ≥8)`
    });

    // Check GIN index exists
    const ginIndex = await guestCheckinDB.queryRow`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'guest_documents'
      AND indexdef LIKE '%USING gin%'
    `;
    
    results.push({
      check: "GIN index on extracted_data",
      passed: !!ginIndex,
      details: ginIndex ? `✓ ${ginIndex.indexname}` : "✗ Not found"
    });

  } catch (error: any) {
    results.push({
      check: "guest_documents table verification",
      passed: false,
      error: error.message
    });
  }
}

async function verifyGuestAuditLogsTable() {
  try {
    // Check table exists
    const tableExists = await guestCheckinDB.queryRow`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'guest_audit_logs'
    `;
    
    results.push({
      check: "guest_audit_logs table exists",
      passed: !!tableExists,
      details: tableExists ? "✓ Table found" : "✗ Table not found"
    });

    if (!tableExists) return;

    // Check column count
    const columns = await guestCheckinDB.queryAll`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'guest_audit_logs'
    `;
    
    results.push({
      check: "guest_audit_logs columns count",
      passed: columns.length >= 18,
      details: `Found ${columns.length} columns (expected ≥18)`
    });

    // Check indexes
    const indexes = await guestCheckinDB.queryAll`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'guest_audit_logs'
    `;
    
    results.push({
      check: "guest_audit_logs indexes",
      passed: indexes.length >= 10,
      details: `Found ${indexes.length} indexes (expected ≥10)`
    });

    // Check composite index
    const compositeIndex = await guestCheckinDB.queryRow`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'guest_audit_logs'
      AND indexname = 'idx_guest_audit_logs_org_timestamp_action'
    `;
    
    results.push({
      check: "Composite index (org+timestamp+action)",
      passed: !!compositeIndex,
      details: compositeIndex ? "✓ Found" : "✗ Not found"
    });

    // Check partial index on failed logs
    const partialIndex = await guestCheckinDB.queryRow`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'guest_audit_logs'
      AND indexdef LIKE '%WHERE%success%'
    `;
    
    results.push({
      check: "Partial index on failed actions",
      passed: !!partialIndex,
      details: partialIndex ? "✓ Found" : "✗ Not found"
    });

  } catch (error: any) {
    results.push({
      check: "guest_audit_logs table verification",
      passed: false,
      error: error.message
    });
  }
}

async function verifyCheckConstraints() {
  try {
    // Verify document_type constraint
    const docTypeConstraint = await guestCheckinDB.queryAll`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'guest_documents'::regclass
      AND pg_get_constraintdef(oid) LIKE '%document_type%'
    `;
    
    results.push({
      check: "document_type CHECK constraint",
      passed: docTypeConstraint.length > 0,
      details: docTypeConstraint.length > 0 ? "✓ Found" : "✗ Not found"
    });

    // Verify action_type constraint
    const actionTypeConstraint = await guestCheckinDB.queryAll`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'guest_audit_logs'::regclass
      AND pg_get_constraintdef(oid) LIKE '%action_type%'
    `;
    
    results.push({
      check: "action_type CHECK constraint",
      passed: actionTypeConstraint.length > 0,
      details: actionTypeConstraint.length > 0 ? "✓ Found" : "✗ Not found"
    });

    // Verify overall_confidence range constraint
    const confidenceConstraint = await guestCheckinDB.queryAll`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'guest_documents'::regclass
      AND pg_get_constraintdef(oid) LIKE '%overall_confidence%'
    `;
    
    results.push({
      check: "overall_confidence range CHECK",
      passed: confidenceConstraint.length > 0,
      details: confidenceConstraint.length > 0 ? "✓ Found (0-100 range)" : "✗ Not found"
    });

  } catch (error: any) {
    results.push({
      check: "CHECK constraints verification",
      passed: false,
      error: error.message
    });
  }
}

async function main() {
  console.log("\n🔍 Migration Verification Script");
  console.log("==================================\n");

  await verifyGuestCheckinsTable();
  await verifyGuestDocumentsTable();
  await verifyGuestAuditLogsTable();
  await verifyCheckConstraints();

  console.log("\n📊 Verification Results:\n");
  
  let passedCount = 0;
  let failedCount = 0;

  results.forEach((result, index) => {
    const icon = result.passed ? "✅" : "❌";
    console.log(`${icon} ${result.check}`);
    
    if (result.details) {
      console.log(`   ${result.details}`);
    }
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    
    if (result.passed) {
      passedCount++;
    } else {
      failedCount++;
    }
    
    console.log("");
  });

  console.log("==================================");
  console.log(`✅ Passed: ${passedCount}`);
  console.log(`❌ Failed: ${failedCount}`);
  console.log(`📊 Total:  ${results.length}`);
  console.log("==================================\n");

  if (failedCount > 0) {
    console.log("❌ Migration verification FAILED");
    process.exit(1);
  } else {
    console.log("✅ All migrations verified successfully!");
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("Fatal error during verification:", error);
  process.exit(1);
});

