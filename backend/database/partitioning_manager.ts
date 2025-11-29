// Database Partitioning Manager for Phase 2 Architecture Scaling
// Target: Implement hash partitioning for linear scaling (100K-500K organizations)

import { reportsDB } from "../reports/db";
import { financeDB } from "../finance/db";
import { SQLDatabase } from "encore.dev/storage/sqldb";

interface PartitionConfig {
  tableName: string;
  partitionColumn: string;
  partitionCount: number;
  partitionType: 'hash' | 'range';
}

interface PartitionInfo {
  partitionName: string;
  partitionNumber: number;
  modulus?: number;
  remainder?: number;
  rangeStart?: string;
  rangeEnd?: string;
}

export class PartitioningManager {
  private partitions: Map<string, PartitionInfo[]> = new Map();
  private featureFlags: Map<string, boolean> = new Map();

  constructor() {
    this.initializePartitions();
    this.initializeFeatureFlags();
  }

  private initializePartitions() {
    // Daily Cash Balances - Hash partitioning by org_id
    this.partitions.set('daily_cash_balances', this.createHashPartitions('daily_cash_balances', 16));
    
    // Revenues - Range partitioning by occurred_at
    this.partitions.set('revenues', this.createRangePartitions('revenues', 12)); // Monthly partitions
    
    // Expenses - Range partitioning by occurred_at  
    this.partitions.set('expenses', this.createRangePartitions('expenses', 12)); // Monthly partitions
  }

  private initializeFeatureFlags() {
    // Feature flags for gradual migration
    // Set to true after partitioning migration is complete
    this.featureFlags.set('use_partitioned_tables', process.env.USE_PARTITIONED_TABLES === 'true' || false);
    this.featureFlags.set('enable_partition_routing', process.env.ENABLE_PARTITION_ROUTING === 'true' || false);
    this.featureFlags.set('enable_partition_maintenance', process.env.ENABLE_PARTITION_MAINTENANCE === 'true' || true);
  }

  private createHashPartitions(tableName: string, count: number): PartitionInfo[] {
    const partitions: PartitionInfo[] = [];
    for (let i = 0; i < count; i++) {
      partitions.push({
        partitionName: `${tableName}_${i}`,
        partitionNumber: i,
        modulus: count,
        remainder: i
      });
    }
    return partitions;
  }

  private createRangePartitions(tableName: string, count: number): PartitionInfo[] {
    const partitions: PartitionInfo[] = [];
    const currentDate = new Date();
    
    for (let i = 0; i < count; i++) {
      const startDate = new Date(currentDate);
      startDate.setMonth(startDate.getMonth() - (count - 1 - i));
      startDate.setDate(1);
      
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      
      partitions.push({
        partitionName: `${tableName}_${startDate.getFullYear()}_${String(startDate.getMonth() + 1).padStart(2, '0')}`,
        partitionNumber: i,
        rangeStart: startDate.toISOString().split('T')[0],
        rangeEnd: endDate.toISOString().split('T')[0]
      });
    }
    return partitions;
  }

  // Get partition for a specific org_id (hash partitioning)
  getPartitionForOrg(tableName: string, orgId: number): string {
    const partitions = this.partitions.get(tableName);
    if (!partitions || partitions.length === 0) {
      throw new Error(`No partitions found for table: ${tableName}`);
    }

    const partitionNumber = orgId % partitions.length;
    return partitions[partitionNumber].partitionName;
  }

  // Get partition for a specific date (range partitioning)
  getPartitionForDate(tableName: string, date: string): string {
    const partitions = this.partitions.get(tableName);
    if (!partitions || partitions.length === 0) {
      throw new Error(`No partitions found for table: ${tableName}`);
    }

    const targetDate = new Date(date);
    
    for (const partition of partitions) {
      if (partition.rangeStart && partition.rangeEnd) {
        const startDate = new Date(partition.rangeStart);
        const endDate = new Date(partition.rangeEnd);
        
        if (targetDate >= startDate && targetDate < endDate) {
          return partition.partitionName;
        }
      }
    }

    // Fallback to most recent partition
    return partitions[partitions.length - 1].partitionName;
  }

  // Route query to appropriate partition
  async routeQuery(tableName: string, query: string, params: any[]): Promise<any> {
    if (!this.featureFlags.get('use_partitioned_tables')) {
      // Use original table
      return await this.executeOnOriginalTable(tableName, query, params);
    }

    // Determine partition based on table type
    let partitionName: string;
    
    if (tableName === 'daily_cash_balances') {
      // Hash partitioning by org_id
      const orgId = this.extractOrgIdFromParams(params);
      partitionName = this.getPartitionForOrg(tableName, orgId);
    } else if (tableName === 'revenues' || tableName === 'expenses') {
      // Range partitioning by date
      const date = this.extractDateFromParams(params);
      partitionName = this.getPartitionForDate(tableName, date);
    } else {
      // No partitioning for this table
      return await this.executeOnOriginalTable(tableName, query, params);
    }

    // Execute on partitioned table
    const partitionedQuery = query.replace(new RegExp(`\\b${tableName}\\b`, 'g'), partitionName);
    return await this.executeOnPartitionedTable(partitionName, partitionedQuery, params);
  }

  private async executeOnOriginalTable(tableName: string, query: string, params: any[]): Promise<any> {
    // Execute on original table
    if (tableName.includes('daily_cash_balances') || tableName.includes('revenues') || tableName.includes('expenses')) {
      return await reportsDB.exec(query, params);
    } else {
      return await financeDB.exec(query, params);
    }
  }

  private async executeOnPartitionedTable(partitionName: string, query: string, params: any[]): Promise<any> {
    // Execute on partitioned table
    return await reportsDB.exec(query, params);
  }

  private extractOrgIdFromParams(params: any[]): number {
    // Extract org_id from query parameters
    // This is a simplified extraction - in production, you'd need more sophisticated parsing
    for (const param of params) {
      if (typeof param === 'number' && param > 0 && param < 1000000) {
        return param; // Assume first number is org_id
      }
    }
    throw new Error('Could not extract org_id from query parameters');
  }

  private extractDateFromParams(params: any[]): string {
    // Extract date from query parameters
    for (const param of params) {
      if (typeof param === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(param)) {
        return param;
      }
    }
    return new Date().toISOString().split('T')[0]; // Default to today
  }

  // Migration methods
  async migrateDataToPartitions(): Promise<void> {
    console.log('[PartitioningManager] Starting data migration to partitions...');
    
    try {
      // Migrate daily_cash_balances
      await this.migrateDailyCashBalances();
      
      // Migrate revenues
      await this.migrateRevenues();
      
      // Migrate expenses
      await this.migrateExpenses();
      
      console.log('[PartitioningManager] Data migration completed successfully');
    } catch (error) {
      console.error('[PartitioningManager] Data migration failed:', error);
      throw error;
    }
  }

  private async migrateDailyCashBalances(): Promise<void> {
    console.log('[PartitioningManager] Migrating daily_cash_balances...');
    
    const partitions = this.partitions.get('daily_cash_balances');
    if (!partitions) return;

    for (const partition of partitions) {
      await reportsDB.exec(`
        INSERT INTO ${partition.partitionName} 
        SELECT * FROM daily_cash_balances 
        WHERE org_id % ${partition.modulus} = ${partition.remainder}
      `);
      
      console.log(`[PartitioningManager] Migrated data to partition: ${partition.partitionName}`);
    }
  }

  private async migrateRevenues(): Promise<void> {
    console.log('[PartitioningManager] Migrating revenues...');
    
    const partitions = this.partitions.get('revenues');
    if (!partitions) return;

    for (const partition of partitions) {
      await reportsDB.exec(`
        INSERT INTO ${partition.partitionName} 
        SELECT * FROM revenues 
        WHERE occurred_at >= '${partition.rangeStart}' 
          AND occurred_at < '${partition.rangeEnd}'
      `);
      
      console.log(`[PartitioningManager] Migrated data to partition: ${partition.partitionName}`);
    }
  }

  private async migrateExpenses(): Promise<void> {
    console.log('[PartitioningManager] Migrating expenses...');
    
    const partitions = this.partitions.get('expenses');
    if (!partitions) return;

    for (const partition of partitions) {
      await reportsDB.exec(`
        INSERT INTO ${partition.partitionName} 
        SELECT * FROM expenses 
        WHERE occurred_at >= '${partition.rangeStart}' 
          AND occurred_at < '${partition.rangeEnd}'
      `);
      
      console.log(`[PartitioningManager] Migrated data to partition: ${partition.partitionName}`);
    }
  }

  // Feature flag management
  enablePartitionedTables(): void {
    this.featureFlags.set('use_partitioned_tables', true);
    console.log('[PartitioningManager] Enabled partitioned tables');
  }

  disablePartitionedTables(): void {
    this.featureFlags.set('use_partitioned_tables', false);
    console.log('[PartitioningManager] Disabled partitioned tables');
  }

  enablePartitionRouting(): void {
    this.featureFlags.set('enable_partition_routing', true);
    console.log('[PartitioningManager] Enabled partition routing');
  }

  disablePartitionRouting(): void {
    this.featureFlags.set('enable_partition_routing', false);
    console.log('[PartitioningManager] Disabled partition routing');
  }

  // Validation methods
  async validateDataConsistency(): Promise<boolean> {
    console.log('[PartitioningManager] Validating data consistency...');
    
    try {
      // Compare row counts between original and partitioned tables
      const originalCount = await reportsDB.queryRow`SELECT COUNT(*) as count FROM daily_cash_balances`;
      const partitionedCount = await this.getPartitionedTableCount('daily_cash_balances');
      
      if (originalCount.count !== partitionedCount) {
        console.error(`[PartitioningManager] Data inconsistency detected: original=${originalCount.count}, partitioned=${partitionedCount}`);
        return false;
      }
      
      console.log('[PartitioningManager] Data consistency validated successfully');
      return true;
    } catch (error) {
      console.error('[PartitioningManager] Data validation failed:', error);
      return false;
    }
  }

  private async getPartitionedTableCount(tableName: string): Promise<number> {
    const partitions = this.partitions.get(tableName);
    if (!partitions) return 0;

    let totalCount = 0;
    for (const partition of partitions) {
      // Use dynamic SQL for partition names
      const query = `SELECT COUNT(*) as count FROM ${partition.partitionName}`;
      const result = await reportsDB.queryRow(query);
      totalCount += result.count;
    }
    return totalCount;
  }

  // Get partition statistics
  getPartitionStats(): any {
    const stats: any = {};
    
    for (const [tableName, partitions] of this.partitions) {
      stats[tableName] = {
        partitionCount: partitions.length,
        partitions: partitions.map(p => ({
          name: p.partitionName,
          number: p.partitionNumber,
          modulus: p.modulus,
          remainder: p.remainder,
          rangeStart: p.rangeStart,
          rangeEnd: p.rangeEnd
        }))
      };
    }
    
    return stats;
  }

  // Get feature flag status
  getFeatureFlags(): Map<string, boolean> {
    return new Map(this.featureFlags);
  }

  // Auto-create next month's partitions for range-partitioned tables
  async createNextMonthPartitions(): Promise<void> {
    console.log('[PartitioningManager] Creating next month partitions...');
    
    try {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      
      const monthAfter = new Date(nextMonth);
      monthAfter.setMonth(monthAfter.getMonth() + 1);
      
      const year = nextMonth.getFullYear();
      const month = String(nextMonth.getMonth() + 1).padStart(2, '0');
      
      const rangeStart = nextMonth.toISOString().split('T')[0];
      const rangeEnd = monthAfter.toISOString().split('T')[0];
      
      // Create revenues partition for next month
      const revenuesPartitionName = `revenues_${year}_${month}`;
      await this.createRangePartition('revenues_partitioned', revenuesPartitionName, rangeStart, rangeEnd);
      console.log(`[PartitioningManager] Created revenues partition: ${revenuesPartitionName}`);
      
      // Create expenses partition for next month
      const expensesPartitionName = `expenses_${year}_${month}`;
      await this.createRangePartition('expenses_partitioned', expensesPartitionName, rangeStart, rangeEnd);
      console.log(`[PartitioningManager] Created expenses partition: ${expensesPartitionName}`);
      
      console.log('[PartitioningManager] Next month partitions created successfully');
    } catch (error) {
      console.error('[PartitioningManager] Failed to create next month partitions:', error);
      throw error;
    }
  }

  // Create a range partition
  private async createRangePartition(
    parentTable: string,
    partitionName: string,
    rangeStart: string,
    rangeEnd: string
  ): Promise<void> {
    // Check if partition already exists
    const checkQuery = `
      SELECT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = '${partitionName}'
      ) as exists
    `;
    const result = await reportsDB.queryRow(checkQuery);
    
    if (result.exists) {
      console.log(`[PartitioningManager] Partition ${partitionName} already exists, skipping`);
      return;
    }
    
    // Create the partition
    const createQuery = `
      CREATE TABLE IF NOT EXISTS ${partitionName} 
      PARTITION OF ${parentTable}
      FOR VALUES FROM ('${rangeStart}') TO ('${rangeEnd}')
    `;
    
    await reportsDB.exec(createQuery);
    console.log(`[PartitioningManager] Created partition: ${partitionName} (${rangeStart} to ${rangeEnd})`);
  }

  // Create partitions for the next N months (useful for bulk creation)
  async createPartitionsForNextMonths(months: number): Promise<void> {
    console.log(`[PartitioningManager] Creating partitions for next ${months} months...`);
    
    for (let i = 1; i <= months; i++) {
      const futureMonth = new Date();
      futureMonth.setMonth(futureMonth.getMonth() + i);
      futureMonth.setDate(1);
      
      const monthAfter = new Date(futureMonth);
      monthAfter.setMonth(monthAfter.getMonth() + 1);
      
      const year = futureMonth.getFullYear();
      const month = String(futureMonth.getMonth() + 1).padStart(2, '0');
      
      const rangeStart = futureMonth.toISOString().split('T')[0];
      const rangeEnd = monthAfter.toISOString().split('T')[0];
      
      // Create revenues partition
      const revenuesPartitionName = `revenues_${year}_${month}`;
      await this.createRangePartition('revenues_partitioned', revenuesPartitionName, rangeStart, rangeEnd);
      
      // Create expenses partition
      const expensesPartitionName = `expenses_${year}_${month}`;
      await this.createRangePartition('expenses_partitioned', expensesPartitionName, rangeStart, rangeEnd);
    }
    
    console.log(`[PartitioningManager] Created partitions for next ${months} months successfully`);
  }

  // Check if current month partition exists
  async checkCurrentMonthPartitions(): Promise<boolean> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    const revenuesPartitionName = `revenues_${year}_${month}`;
    const expensesPartitionName = `expenses_${year}_${month}`;
    
    const revenuesCheck = await reportsDB.queryRow(`
      SELECT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = '${revenuesPartitionName}'
      ) as exists
    `);
    
    const expensesCheck = await reportsDB.queryRow(`
      SELECT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = '${expensesPartitionName}'
      ) as exists
    `);
    
    return revenuesCheck.exists && expensesCheck.exists;
  }

  // Maintenance: Drop old partitions (older than retention period)
  async dropOldPartitions(retentionMonths: number = 24): Promise<void> {
    console.log(`[PartitioningManager] Dropping partitions older than ${retentionMonths} months...`);
    
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);
    cutoffDate.setDate(1);
    
    // Find and drop old revenues partitions
    const revenuesPartitions = await reportsDB.query(`
      SELECT tablename FROM pg_tables 
      WHERE tablename LIKE 'revenues_2%'
      ORDER BY tablename
    `);
    
    for (const row of revenuesPartitions) {
      const partitionDate = this.parsePartitionDate(row.tablename);
      if (partitionDate && partitionDate < cutoffDate) {
        await reportsDB.exec(`DROP TABLE IF EXISTS ${row.tablename}`);
        console.log(`[PartitioningManager] Dropped old partition: ${row.tablename}`);
      }
    }
    
    // Find and drop old expenses partitions
    const expensesPartitions = await reportsDB.query(`
      SELECT tablename FROM pg_tables 
      WHERE tablename LIKE 'expenses_2%'
      ORDER BY tablename
    `);
    
    for (const row of expensesPartitions) {
      const partitionDate = this.parsePartitionDate(row.tablename);
      if (partitionDate && partitionDate < cutoffDate) {
        await reportsDB.exec(`DROP TABLE IF EXISTS ${row.tablename}`);
        console.log(`[PartitioningManager] Dropped old partition: ${row.tablename}`);
      }
    }
    
    console.log('[PartitioningManager] Old partitions dropped successfully');
  }

  // Parse partition date from partition name (e.g., revenues_2025_01)
  private parsePartitionDate(partitionName: string): Date | null {
    const match = partitionName.match(/_(\d{4})_(\d{2})$/);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]) - 1; // JavaScript months are 0-indexed
      return new Date(year, month, 1);
    }
    return null;
  }
}

// Global partitioning manager instance
export const partitioningManager = new PartitioningManager();
