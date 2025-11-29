// Partition Metrics - Monitor partitioned table usage and performance
// Target: Track partition counts, query performance, and switchover readiness

import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const db = SQLDatabase.named("hospitality");

export interface PartitionMetrics {
  partitionedTablesEnabled: boolean;
  tables: {
    name: string;
    rowCount: number;
    partitionedRowCount: number;
    rowCountDelta: number;
    lastSyncStatus: 'synced' | 'out_of_sync' | 'unknown';
    partitionCount?: number;
  }[];
  switchoverReadiness: {
    ready: boolean;
    checks: {
      check: string;
      passed: boolean;
      message: string;
    }[];
  };
  timestamp: string;
}

export interface PartitionTableStats {
  tableName: string;
  legacyTable: {
    totalRows: number;
    lastModified?: string;
  };
  partitionedTable: {
    totalRows: number;
    partitionCount: number;
    partitions: {
      partitionName: string;
      rowCount: number;
    }[];
    lastModified?: string;
  };
  rowCountMatch: boolean;
  rowCountDelta: number;
}

// Shared handler for getting partition metrics
async function getPartitionMetricsHandler(): Promise<PartitionMetrics> {
    const usePartitionedTables = process.env.USE_PARTITIONED_TABLES === 'true';
    
    // Check revenue tables
    const revenueTables = await checkTableSync('revenues', 'revenues_partitioned');
    
    // Check expense tables
    const expenseTables = await checkTableSync('expenses', 'expenses_partitioned');
    
    // Get partition counts
    const revenuePartitionCount = await getPartitionCount('revenues_partitioned');
    const expensePartitionCount = await getPartitionCount('expenses_partitioned');
    
    const tables = [
      {
        name: 'revenues',
        rowCount: revenueTables.legacyCount,
        partitionedRowCount: revenueTables.partitionedCount,
        rowCountDelta: revenueTables.delta,
        lastSyncStatus: revenueTables.status,
        partitionCount: revenuePartitionCount
      },
      {
        name: 'expenses',
        rowCount: expenseTables.legacyCount,
        partitionedRowCount: expenseTables.partitionedCount,
        rowCountDelta: expenseTables.delta,
        lastSyncStatus: expenseTables.status,
        partitionCount: expensePartitionCount
      }
    ];
    
    // Check switchover readiness
    const readiness = await checkSwitchoverReadiness(tables);
    
    return {
      partitionedTablesEnabled: usePartitionedTables,
      tables,
      switchoverReadiness: readiness,
      timestamp: new Date().toISOString()
    };
}

// Get partition metrics

// LEGACY: Gets partition metrics (keep for backward compatibility)
export const getPartitionMetrics = api<{}, PartitionMetrics>(
  { auth: false, expose: true, method: "GET", path: "/monitoring/partitions/metrics" },
  getPartitionMetricsHandler
);

// V1: Gets partition metrics
export const getPartitionMetricsV1 = api<{}, PartitionMetrics>(
  { auth: false, expose: true, method: "GET", path: "/v1/system/monitoring/partitions/metrics" },
  getPartitionMetricsHandler
);

// Shared handler for getting detailed partition table stats
async function getPartitionTableStatsHandler({ tableName }: { tableName: string }): Promise<PartitionTableStats> {
    const partitionedTableName = `${tableName}_partitioned`;
    
    // Get legacy table stats
    const legacyStats = await db.queryRow(
      `SELECT 
        COUNT(*) as total_rows,
        MAX(updated_at) as last_modified
      FROM ${tableName}`
    );
    
    // Get partitioned table stats
    const partitionedStats = await db.queryRow(
      `SELECT 
        COUNT(*) as total_rows,
        MAX(updated_at) as last_modified
      FROM ${partitionedTableName}`
    );
    
    // Get partition list
    const partitions = await db.query(
      `SELECT 
        schemaname || '.' || tablename as partition_name,
        n_live_tup as row_count
      FROM pg_stat_user_tables
      WHERE tablename LIKE '${partitionedTableName}_%'
      ORDER BY tablename`
    );
    
    const rowCountMatch = Math.abs(legacyStats.total_rows - partitionedStats.total_rows) < 10;
    const rowCountDelta = legacyStats.total_rows - partitionedStats.total_rows;
    
    return {
      tableName,
      legacyTable: {
        totalRows: legacyStats.total_rows,
        lastModified: legacyStats.last_modified
      },
      partitionedTable: {
        totalRows: partitionedStats.total_rows,
        partitionCount: partitions.length,
        partitions: partitions.map(p => ({
          partitionName: p.partition_name,
          rowCount: p.row_count || 0
        })),
        lastModified: partitionedStats.last_modified
      },
      rowCountMatch,
      rowCountDelta
    };
}

// Get detailed partition table stats

// LEGACY: Gets detailed partition table stats (keep for backward compatibility)
export const getPartitionTableStats = api<{ tableName: string }, PartitionTableStats>(
  { auth: true, expose: true, method: "GET", path: "/monitoring/partitions/table-stats" },
  getPartitionTableStatsHandler
);

// V1: Gets detailed partition table stats
export const getPartitionTableStatsV1 = api<{ tableName: string }, PartitionTableStats>(
  { auth: true, expose: true, method: "GET", path: "/v1/system/monitoring/partitions/table-stats" },
  getPartitionTableStatsHandler
);

// Helper: Check table sync status
async function checkTableSync(legacyTable: string, partitionedTable: string): Promise<{
  legacyCount: number;
  partitionedCount: number;
  delta: number;
  status: 'synced' | 'out_of_sync' | 'unknown';
}> {
  try {
    const legacyResult = await db.queryRow(
      `SELECT COUNT(*) as count FROM ${legacyTable}`
    );
    
    const partitionedResult = await db.queryRow(
      `SELECT COUNT(*) as count FROM ${partitionedTable}`
    );
    
    const legacyCount = parseInt(legacyResult.count) || 0;
    const partitionedCount = parseInt(partitionedResult.count) || 0;
    const delta = legacyCount - partitionedCount;
    
    // Consider synced if difference is less than 10 rows (accounting for concurrent writes)
    const status = Math.abs(delta) < 10 ? 'synced' : 'out_of_sync';
    
    return {
      legacyCount,
      partitionedCount,
      delta,
      status
    };
  } catch (error) {
    console.error(`Error checking sync for ${legacyTable}:`, error);
    return {
      legacyCount: 0,
      partitionedCount: 0,
      delta: 0,
      status: 'unknown'
    };
  }
}

// Helper: Get partition count
async function getPartitionCount(partitionedTable: string): Promise<number> {
  try {
    const result = await db.queryRow(
      `SELECT COUNT(*) as count
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename LIKE '${partitionedTable}_%'`
    );

    return parseInt(result?.count) || 0;
  } catch (error) {
    console.error(`Error getting partition count for ${partitionedTable}:`, error);
    return 0;
  }
}

// Helper: Check switchover readiness
async function checkSwitchoverReadiness(tables: any[]): Promise<{
  ready: boolean;
  checks: { check: string; passed: boolean; message: string; }[];
}> {
  const checks = [];
  
  // Check 1: All tables synced
  const allSynced = tables.every(t => t.lastSyncStatus === 'synced');
  checks.push({
    check: 'Row count parity',
    passed: allSynced,
    message: allSynced 
      ? 'All tables are synced (delta < 10 rows)' 
      : 'Some tables have significant row count differences'
  });
  
  // Check 2: Partitions exist
  const allHavePartitions = tables.every(t => (t.partitionCount || 0) > 0);
  checks.push({
    check: 'Partitions created',
    passed: allHavePartitions,
    message: allHavePartitions
      ? 'All partitioned tables have active partitions'
      : 'Some partitioned tables have no partitions'
  });
  
  // Check 3: Dual-write triggers active
  const triggersActive = await checkTriggersActive();
  checks.push({
    check: 'Dual-write triggers',
    passed: triggersActive,
    message: triggersActive
      ? 'Dual-write triggers are active'
      : 'Dual-write triggers may not be active'
  });
  
  // Check 4: Recent writes to partitioned tables
  const recentWrites = await checkRecentWrites();
  checks.push({
    check: 'Recent writes',
    passed: recentWrites,
    message: recentWrites
      ? 'Partitioned tables have recent writes (last 5 minutes)'
      : 'No recent writes to partitioned tables detected'
  });
  
  const ready = checks.every(c => c.passed);
  
  return { ready, checks };
}

// Helper: Check if dual-write triggers are active
async function checkTriggersActive(): Promise<boolean> {
  try {
    const triggers = await db.query`
      SELECT 
        tgname as trigger_name,
        tgenabled as enabled
      FROM pg_trigger
      WHERE tgname IN (
        'sync_to_partitioned_revenues',
        'sync_to_partitioned_expenses',
        'sync_to_partitioned_daily_cash_balances'
      )
    `;
    
    return triggers.length >= 2 && triggers.every(t => t.enabled === 'O');
  } catch (error) {
    console.error('Error checking triggers:', error);
    return false;
  }
}

// Helper: Check for recent writes to partitioned tables
async function checkRecentWrites(): Promise<boolean> {
  try {
    const revenueRecent = await db.queryRow`
      SELECT COUNT(*) as count
      FROM revenues_partitioned
      WHERE updated_at >= NOW() - INTERVAL '5 minutes'
    `;
    
    const expenseRecent = await db.queryRow`
      SELECT COUNT(*) as count
      FROM expenses_partitioned
      WHERE updated_at >= NOW() - INTERVAL '5 minutes'
    `;
    
    // Consider active if at least one table has recent writes
    return (parseInt(revenueRecent.count) + parseInt(expenseRecent.count)) > 0;
  } catch (error) {
    console.error('Error checking recent writes:', error);
    return false;
  }
}

console.log('[PartitionMetrics] ✅ Partition monitoring endpoints initialized');

