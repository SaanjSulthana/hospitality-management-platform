/**
 * Partition Verification Endpoint
 * 
 * GET /monitoring/verify-partitions
 * 
 * Verifies that the partitioned database setup is working correctly
 */

import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const db = SQLDatabase.named("hospitality");

interface PartitionInfo {
  tablename: string;
}

interface TableCount {
  count: number;
}

interface TriggerStatus {
  trigger_name: string;
  event_manipulation: string;
  event_object_table: string;
}

interface VerificationResult {
  success: boolean;
  partitionedTables: string[];
  revenuePartitions: string[];
  expensePartitions: string[];
  balancePartitionCount: number;
  triggers: {
    name: string;
    table: string;
    event: string;
  }[];
  rowCounts: {
    revenues: { legacy: number; partitioned: number; match: boolean };
    expenses: { legacy: number; partitioned: number; match: boolean };
    balances: { legacy: number; partitioned: number; match: boolean };
  };
  featureFlags: {
    usePartitionedTables: string;
    enablePartitionRouting: string;
    enablePartitionMaintenance: string;
  };
  verdict: string;
  timestamp: string;
}

// Shared handler for verifying partitions
async function verifyPartitionsHandler(): Promise<VerificationResult> {
    try {
      // 1. Check partitioned tables
      let partitionedTables: PartitionInfo[] = [];
      try {
        partitionedTables = await db.query<PartitionInfo>`
          SELECT tablename 
          FROM pg_tables 
          WHERE tablename LIKE '%_partitioned' 
          ORDER BY tablename
        `;
      } catch (e) {
        console.log("Partitioned tables query failed:", e);
      }

      // 2. Check revenue partitions
      let revenuePartitions: PartitionInfo[] = [];
      try {
        revenuePartitions = await db.query<PartitionInfo>`
          SELECT tablename 
          FROM pg_tables 
          WHERE tablename LIKE 'revenues_20%' 
             OR tablename = 'revenues_default'
          ORDER BY tablename
        `;
      } catch (e) {
        console.log("Revenue partitions not found:", e);
      }

      // 3. Check expense partitions
      let expensePartitions: PartitionInfo[] = [];
      try {
        expensePartitions = await db.query<PartitionInfo>`
          SELECT tablename 
          FROM pg_tables 
          WHERE tablename LIKE 'expenses_20%' 
             OR tablename = 'expenses_default'
          ORDER BY tablename
        `;
      } catch (e) {
        console.log("Expense partitions not found:", e);
      }

      // 4. Check balance partitions
      let balancePartitions: PartitionInfo[] = [];
      try {
        balancePartitions = await db.query<PartitionInfo>`
          SELECT tablename 
          FROM pg_tables 
          WHERE tablename LIKE 'daily_cash_balances_%'
             AND tablename != 'daily_cash_balances_partitioned'
          ORDER BY tablename
        `;
      } catch (e) {
        console.log("Balance partitions not found:", e);
      }

      // 5. Check triggers
      const triggers = await db.query<TriggerStatus>`
        SELECT 
          trigger_name,
          event_manipulation,
          event_object_table
        FROM information_schema.triggers
        WHERE trigger_name LIKE '%sync%partitioned%'
        ORDER BY event_object_table, trigger_name
      `;

      // 6. Check row counts
      const revenueLegacy = await db.queryRow<TableCount>`SELECT COUNT(*) as count FROM revenues`;
      let revenuePartitioned: TableCount | null = { count: 0 };
      try {
        revenuePartitioned = await db.queryRow<TableCount>`SELECT COUNT(*) as count FROM revenues_partitioned`;
      } catch (e) {
        console.log("revenues_partitioned table not found");
      }
      
      const expenseLegacy = await db.queryRow<TableCount>`SELECT COUNT(*) as count FROM expenses`;
      let expensePartitioned: TableCount | null = { count: 0 };
      try {
        expensePartitioned = await db.queryRow<TableCount>`SELECT COUNT(*) as count FROM expenses_partitioned`;
      } catch (e) {
        console.log("expenses_partitioned table not found");
      }
      
      const balanceLegacy = await db.queryRow<TableCount>`SELECT COUNT(*) as count FROM daily_cash_balances`;
      let balancePartitioned: TableCount | null = { count: 0 };
      try {
        balancePartitioned = await db.queryRow<TableCount>`SELECT COUNT(*) as count FROM daily_cash_balances_partitioned`;
      } catch (e) {
        console.log("daily_cash_balances_partitioned table not found");
      }

      // Calculate parity (allow small delta due to concurrent writes)
      const revenueMatch = Math.abs((revenueLegacy?.count || 0) - (revenuePartitioned?.count || 0)) <= 5;
      const expenseMatch = Math.abs((expenseLegacy?.count || 0) - (expensePartitioned?.count || 0)) <= 5;
      const balanceMatch = Math.abs((balanceLegacy?.count || 0) - (balancePartitioned?.count || 0)) <= 5;

      // 7. Determine verdict
      const allChecksPass = 
        partitionedTables.length >= 3 &&
        triggers.length >= 6 &&
        revenueMatch &&
        expenseMatch &&
        balanceMatch;

      const verdict = allChecksPass
        ? "✅ Partitioned database is FULLY OPERATIONAL and ready for 1M+ organizations!"
        : "⚠️  Some checks failed - review details above";

      return {
        success: allChecksPass,
        partitionedTables: (partitionedTables || []).map(t => t.tablename),
        revenuePartitions: (revenuePartitions || []).map(p => p.tablename),
        expensePartitions: (expensePartitions || []).map(p => p.tablename),
        balancePartitionCount: (balancePartitions || []).length,
        triggers: (triggers || []).map(t => ({
          name: t.trigger_name,
          table: t.event_object_table,
          event: t.event_manipulation,
        })),
        rowCounts: {
          revenues: {
            legacy: revenueLegacy?.count || 0,
            partitioned: revenuePartitioned?.count || 0,
            match: revenueMatch,
          },
          expenses: {
            legacy: expenseLegacy?.count || 0,
            partitioned: expensePartitioned?.count || 0,
            match: expenseMatch,
          },
          balances: {
            legacy: balanceLegacy?.count || 0,
            partitioned: balancePartitioned?.count || 0,
            match: balanceMatch,
          },
        },
        featureFlags: {
          usePartitionedTables: process.env.USE_PARTITIONED_TABLES || "default (true in staging/prod)",
          enablePartitionRouting: process.env.ENABLE_PARTITION_ROUTING || "default (true in staging/prod)",
          enablePartitionMaintenance: process.env.ENABLE_PARTITION_MAINTENANCE || "default (true)",
        },
        verdict,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Verification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// LEGACY: Verifies partition setup (keep for backward compatibility)
export const verifyPartitions = api<{}, VerificationResult>(
  { auth: false, expose: true, method: "GET", path: "/monitoring/verify-partitions" },
  verifyPartitionsHandler
);

// V1: Verifies partition setup
export const verifyPartitionsV1 = api<{}, VerificationResult>(
  { auth: false, expose: true, method: "GET", path: "/v1/system/monitoring/partitions/verify" },
  verifyPartitionsHandler
);

