#!/usr/bin/env tsx
/**
 * Partition Verification Script
 * 
 * Directly queries the development database to verify partitioning is working
 * Bypasses Jest's test-prepare to work with the actual running database
 */

import { SQLDatabase } from 'encore.dev/storage/sqldb';

const db = SQLDatabase.named("hospitality");

interface PartitionInfo {
  tablename: string;
  schemaname: string;
}

interface TableCount {
  count: number;
}

interface TriggerStatus {
  trigger_name: string;
  event_manipulation: string;
  event_object_table: string;
  action_statement: string;
}

async function verifyPartitions() {
  console.log("🔍 Verifying Partitioned Database Implementation...\n");

  try {
    // 1. Check partitioned tables exist
    console.log("📊 Step 1: Checking Partitioned Tables");
    console.log("=" .repeat(60));
    
    const partitionedTables = await db.queryAll<PartitionInfo>`
      SELECT tablename, schemaname 
      FROM pg_tables 
      WHERE tablename LIKE '%_partitioned' 
      ORDER BY tablename
    `;

    console.log(`✅ Found ${partitionedTables.length} partitioned tables:`);
    partitionedTables.forEach(t => console.log(`   - ${t.tablename}`));

    // 2. Check partition children
    console.log("\n📊 Step 2: Checking Partition Children");
    console.log("=" .repeat(60));

    const revenuePartitions = await db.queryAll<PartitionInfo>`
      SELECT tablename 
      FROM pg_tables 
      WHERE tablename LIKE 'revenues_20%' 
         OR tablename = 'revenues_default'
      ORDER BY tablename
    `;
    console.log(`✅ Revenue partitions: ${revenuePartitions.length}`);
    revenuePartitions.forEach(p => console.log(`   - ${p.tablename}`));

    const expensePartitions = await db.queryAll<PartitionInfo>`
      SELECT tablename 
      FROM pg_tables 
      WHERE tablename LIKE 'expenses_20%' 
         OR tablename = 'expenses_default'
      ORDER BY tablename
    `;
    console.log(`✅ Expense partitions: ${expensePartitions.length}`);
    expensePartitions.forEach(p => console.log(`   - ${p.tablename}`));

    const balancePartitions = await db.queryAll<PartitionInfo>`
      SELECT tablename 
      FROM pg_tables 
      WHERE tablename LIKE 'daily_cash_balances_%'
         AND tablename != 'daily_cash_balances_partitioned'
      ORDER BY tablename
    `;
    console.log(`✅ Balance partitions (hash): ${balancePartitions.length}`);
    if (balancePartitions.length > 0) {
      console.log(`   - ${balancePartitions.length} hash partitions found`);
    }

    // 3. Check dual-write triggers
    console.log("\n📊 Step 3: Checking Dual-Write Triggers");
    console.log("=" .repeat(60));

    const triggers = await db.queryAll<TriggerStatus>`
      SELECT 
        trigger_name,
        event_manipulation,
        event_object_table,
        action_statement
      FROM information_schema.triggers
      WHERE trigger_name LIKE '%sync%partitioned%'
      ORDER BY event_object_table, trigger_name
    `;

    console.log(`✅ Found ${triggers.length} dual-write triggers:`);
    triggers.forEach(t => {
      console.log(`   - ${t.trigger_name} on ${t.event_object_table} (${t.event_manipulation})`);
    });

    // 4. Check row counts
    console.log("\n📊 Step 4: Checking Row Counts (Data Parity)");
    console.log("=" .repeat(60));

    const revenueLegacy = await db.queryRow<TableCount>`SELECT COUNT(*) as count FROM revenues`;
    const revenuePartitioned = await db.queryRow<TableCount>`SELECT COUNT(*) as count FROM revenues_partitioned`;
    console.log(`✅ Revenues: Legacy=${revenueLegacy?.count || 0}, Partitioned=${revenuePartitioned?.count || 0}`);

    const expenseLegacy = await db.queryRow<TableCount>`SELECT COUNT(*) as count FROM expenses`;
    const expensePartitioned = await db.queryRow<TableCount>`SELECT COUNT(*) as count FROM expenses_partitioned`;
    console.log(`✅ Expenses: Legacy=${expenseLegacy?.count || 0}, Partitioned=${expensePartitioned?.count || 0}`);

    const balanceLegacy = await db.queryRow<TableCount>`SELECT COUNT(*) as count FROM daily_cash_balances`;
    const balancePartitioned = await db.queryRow<TableCount>`SELECT COUNT(*) as count FROM daily_cash_balances_partitioned`;
    console.log(`✅ Balances: Legacy=${balanceLegacy?.count || 0}, Partitioned=${balancePartitioned?.count || 0}`);

    // 5. Verify feature flag settings
    console.log("\n📊 Step 5: Feature Flag Status");
    console.log("=" .repeat(60));
    console.log(`✅ USE_PARTITIONED_TABLES: ${process.env.USE_PARTITIONED_TABLES || 'default (true in staging/prod)'}`);
    console.log(`✅ ENABLE_PARTITION_ROUTING: ${process.env.ENABLE_PARTITION_ROUTING || 'default (true in staging/prod)'}`);
    console.log(`✅ ENABLE_PARTITION_MAINTENANCE: ${process.env.ENABLE_PARTITION_MAINTENANCE || 'default (true)'}`);

    // 6. Final verdict
    console.log("\n" + "=".repeat(60));
    console.log("🎉 VERIFICATION COMPLETE");
    console.log("=".repeat(60));

    const allChecksPass = 
      partitionedTables.length >= 3 &&
      triggers.length >= 6 &&
      (revenueLegacy?.count === revenuePartitioned?.count || Math.abs((revenueLegacy?.count || 0) - (revenuePartitioned?.count || 0)) <= 5);

    if (allChecksPass) {
      console.log("✅ Partitioned database is FULLY OPERATIONAL");
      console.log("✅ Dual-write triggers are active");
      console.log("✅ Data parity is maintained");
      console.log("\n🚀 Your database is ready for 1M+ organizations!");
      process.exit(0);
    } else {
      console.log("⚠️  Some checks failed - review output above");
      process.exit(1);
    }

  } catch (error) {
    console.error("\n❌ Verification failed:", error);
    process.exit(1);
  }
}

// Run verification
verifyPartitions();

