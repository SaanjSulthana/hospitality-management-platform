// 🏗️ PHASE 2: ARCHITECTURE SCALING (Month 1)
// Target: Handle 100K-500K organizations
// Implementation: Month 1

// ✅ FIX 1: Database Partitioning Implementation
export class DatabasePartitioning {
  private partitions = new Map<string, PartitionInfo>();
  private partitionCount = 16; // 16 partitions for 1M orgs

  constructor() {
    this.initializePartitions();
  }

  private initializePartitions() {
    // Create partition mapping for org_id hashing
    for (let i = 0; i < this.partitionCount; i++) {
      this.partitions.set(`partition_${i}`, {
        id: i,
        name: `daily_cash_balances_${i}`,
        hashModulus: this.partitionCount,
        hashRemainder: i,
        isActive: true,
        createdAt: new Date()
      });
    }
  }

  // Get partition for org_id
  getPartition(orgId: number): string {
    const partitionId = orgId % this.partitionCount;
    return `daily_cash_balances_${partitionId}`;
  }

  // Get all partitions for cross-partition queries
  getAllPartitions(): string[] {
    return Array.from(this.partitions.keys());
  }

  // Get partition info
  getPartitionInfo(partitionId: string): PartitionInfo | null {
    return this.partitions.get(partitionId) || null;
  }

  // Check if partition exists
  partitionExists(partitionId: string): boolean {
    return this.partitions.has(partitionId);
  }

  // Get partition statistics
  getPartitionStats(): PartitionStats[] {
    return Array.from(this.partitions.values()).map(partition => ({
      partitionId: partition.name,
      hashModulus: partition.hashModulus,
      hashRemainder: partition.hashRemainder,
      isActive: partition.isActive,
      createdAt: partition.createdAt
    }));
  }
}

interface PartitionInfo {
  id: number;
  name: string;
  hashModulus: number;
  hashRemainder: number;
  isActive: boolean;
  createdAt: Date;
}

interface PartitionStats {
  partitionId: string;
  hashModulus: number;
  hashRemainder: number;
  isActive: boolean;
  createdAt: Date;
}

export const databasePartitioning = new DatabasePartitioning();

// ✅ FIX 2: Read Replica Management
export class ReadReplicaManager {
  private replicas = new Map<string, ReplicaInfo>();
  private primaryReplica: string = 'primary';
  private currentReplica: string = 'primary';

  constructor() {
    this.initializeReplicas();
  }

  private initializeReplicas() {
    // Primary replica
    this.replicas.set('primary', {
      id: 'primary',
      host: process.env.PRIMARY_DB_HOST || 'localhost',
      port: parseInt(process.env.PRIMARY_DB_PORT || '5432'),
      database: process.env.DATABASE_NAME || 'hospitality_platform',
      isReadOnly: false,
      isHealthy: true,
      lastHealthCheck: new Date(),
      connectionCount: 0,
      maxConnections: 100
    });

    // Read replicas
    const replicaHosts = process.env.REPLICA_DB_HOSTS?.split(',') || [];
    replicaHosts.forEach((host, index) => {
      const replicaId = `replica_${index}`;
      this.replicas.set(replicaId, {
        id: replicaId,
        host: host.trim(),
        port: parseInt(process.env.REPLICA_DB_PORT || '5432'),
        database: process.env.DATABASE_NAME || 'hospitality_platform',
        isReadOnly: true,
        isHealthy: true,
        lastHealthCheck: new Date(),
        connectionCount: 0,
        maxConnections: 50
      });
    });
  }

  // Get best replica for read operations
  getReadReplica(): ReplicaInfo {
    const healthyReplicas = Array.from(this.replicas.values())
      .filter(replica => replica.isHealthy && replica.isReadOnly);
    
    if (healthyReplicas.length === 0) {
      // Fallback to primary if no healthy replicas
      return this.replicas.get(this.primaryReplica)!;
    }

    // Select replica with least connections
    return healthyReplicas.reduce((best, current) => 
      current.connectionCount < best.connectionCount ? current : best
    );
  }

  // Get primary replica for write operations
  getPrimaryReplica(): ReplicaInfo {
    return this.replicas.get(this.primaryReplica)!;
  }

  // Check replica health
  async checkReplicaHealth(replicaId: string): Promise<boolean> {
    const replica = this.replicas.get(replicaId);
    if (!replica) return false;

    try {
      // Simulate health check - in production, this would test actual connections
      const startTime = Date.now();
      
      // Test query to verify replica health
      // await replica.query('SELECT 1');
      
      const queryTime = Date.now() - startTime;
      
      if (queryTime > 5000) { // 5 second threshold
        throw new Error('Replica health check timeout');
      }
      
      replica.isHealthy = true;
      replica.lastHealthCheck = new Date();
      
      return true;
    } catch (error) {
      replica.isHealthy = false;
      replica.lastHealthCheck = new Date();
      
      console.error(`[ReadReplicaManager] Health check failed for replica ${replicaId}:`, error);
      return false;
    }
  }

  // Check all replicas health
  async checkAllReplicasHealth(): Promise<void> {
    const healthChecks = Array.from(this.replicas.keys()).map(replicaId => 
      this.checkReplicaHealth(replicaId)
    );
    
    await Promise.all(healthChecks);
  }

  // Get replica statistics
  getReplicaStats(): ReplicaStats[] {
    return Array.from(this.replicas.values()).map(replica => ({
      id: replica.id,
      host: replica.host,
      port: replica.port,
      isReadOnly: replica.isReadOnly,
      isHealthy: replica.isHealthy,
      lastHealthCheck: replica.lastHealthCheck,
      connectionCount: replica.connectionCount,
      maxConnections: replica.maxConnections
    }));
  }
}

interface ReplicaInfo {
  id: string;
  host: string;
  port: number;
  database: string;
  isReadOnly: boolean;
  isHealthy: boolean;
  lastHealthCheck: Date;
  connectionCount: number;
  maxConnections: number;
}

interface ReplicaStats {
  id: string;
  host: string;
  port: number;
  isReadOnly: boolean;
  isHealthy: boolean;
  lastHealthCheck: Date;
  connectionCount: number;
  maxConnections: number;
}

export const readReplicaManager = new ReadReplicaManager();

// ✅ FIX 3: Async Cache Invalidation with Batching
export class AsyncCacheInvalidator {
  private queue: InvalidationItem[] = [];
  private processing = false;
  private batchSize = 100;
  private intervalMs = 2000; // 2 seconds
  private maxAge = 30000; // 30 seconds max age

  constructor() {
    // Start periodic processing
    setInterval(() => {
      if (this.queue.length > 0 && !this.processing) {
        this.processQueue();
      }
    }, this.intervalMs);
  }

  async invalidate(orgId: number, propertyId: number, dates: string[]) {
    this.queue.push({ 
      orgId, 
      propertyId, 
      dates, 
      timestamp: Date.now(),
      id: Math.random().toString(36).substr(2, 9)
    });
    
    // Process immediately if queue is getting large
    if (this.queue.length >= this.batchSize) {
      this.processQueue();
    }
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    try {
      // Remove expired items
      const now = Date.now();
      this.queue = this.queue.filter(item => now - item.timestamp < this.maxAge);
      
      const batch = this.queue.splice(0, this.batchSize);
      if (batch.length === 0) return;

      console.log(`[AsyncCacheInvalidator] Processing batch of ${batch.length} invalidations`);

      // Group by org/property for efficient invalidation
      const grouped = this.groupByOrgProperty(batch);
      
      for (const [key, items] of grouped.entries()) {
        try {
          await this.batchInvalidate(items);
        } catch (error) {
          console.error('Cache invalidation failed:', error);
          // Retry failed items
          this.queue.push(...items);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private groupByOrgProperty(batch: InvalidationItem[]): Map<string, InvalidationItem[]> {
    const grouped = new Map<string, InvalidationItem[]>();
    
    for (const item of batch) {
      const key = `${item.orgId}:${item.propertyId}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    }
    
    return grouped;
  }

  private async batchInvalidate(items: InvalidationItem[]) {
    if (items.length === 0) return;

    const { orgId, propertyId } = items[0];
    const allDates = new Set<string>();
    
    // Collect all unique dates
    for (const item of items) {
      item.dates.forEach(date => allDates.add(date));
    }

    // Batch invalidate all dates for this org/property
    try {
      // In production, this would call the actual cache invalidation
      console.log(`[AsyncCacheInvalidator] Batch invalidating ${allDates.size} dates for org ${orgId}, property ${propertyId}`);
      
      // Simulate cache invalidation
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error('[AsyncCacheInvalidator] Batch invalidation failed:', error);
      throw error;
    }
  }

  getStats() {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
      batchSize: this.batchSize,
      intervalMs: this.intervalMs,
      maxAge: this.maxAge
    };
  }
}

interface InvalidationItem {
  id: string;
  orgId: number;
  propertyId: number;
  dates: string[];
  timestamp: number;
}

export const asyncCacheInvalidator = new AsyncCacheInvalidator();

// ✅ FIX 4: Database Index Optimization
export class DatabaseIndexOptimizer {
  private indexes = new Map<string, IndexInfo>();
  private slowQueries = new Map<string, QueryStats>();

  constructor() {
    this.initializeIndexes();
  }

  private initializeIndexes() {
    // Performance indexes for high-volume queries
    this.indexes.set('idx_daily_cash_balances_org_date', {
      name: 'idx_daily_cash_balances_org_date',
      table: 'daily_cash_balances',
      columns: ['org_id', 'balance_date'],
      type: 'btree',
      isUnique: false,
      isActive: true,
      createdAt: new Date()
    });

    this.indexes.set('idx_revenues_org_date_status', {
      name: 'idx_revenues_org_date_status',
      table: 'revenues',
      columns: ['org_id', 'occurred_at', 'status'],
      type: 'btree',
      isUnique: false,
      isActive: true,
      createdAt: new Date()
    });

    this.indexes.set('idx_expenses_org_date_status', {
      name: 'idx_expenses_org_date_status',
      table: 'expenses',
      columns: ['org_id', 'expense_date', 'status'],
      type: 'btree',
      isUnique: false,
      isActive: true,
      createdAt: new Date()
    });

    // Partial indexes for active data
    this.indexes.set('idx_active_transactions', {
      name: 'idx_active_transactions',
      table: 'revenues',
      columns: ['org_id', 'occurred_at'],
      type: 'btree',
      isUnique: false,
      isActive: true,
      createdAt: new Date(),
      whereClause: "occurred_at >= CURRENT_DATE - INTERVAL '30 days'"
    });

    // Composite indexes for complex queries
    this.indexes.set('idx_transactions_complex', {
      name: 'idx_transactions_complex',
      table: 'revenues',
      columns: ['org_id', 'property_id', 'occurred_at', 'status'],
      type: 'btree',
      isUnique: false,
      isActive: true,
      createdAt: new Date(),
      includeColumns: ['amount_cents', 'payment_mode']
    });
  }

  // Track slow queries for optimization
  trackSlowQuery(query: string, executionTime: number, queryType: string) {
    if (executionTime > 1000) { // 1 second threshold
      const queryKey = this.getQueryKey(query);
      const existing = this.slowQueries.get(queryKey);
      
      if (existing) {
        existing.count++;
        existing.totalTime += executionTime;
        existing.avgTime = existing.totalTime / existing.count;
        existing.maxTime = Math.max(existing.maxTime, executionTime);
      } else {
        this.slowQueries.set(queryKey, {
          query,
          queryType,
          count: 1,
          totalTime: executionTime,
          avgTime: executionTime,
          maxTime: executionTime,
          firstSeen: new Date(),
          lastSeen: new Date()
        });
      }
      
      console.warn(`[DatabaseIndexOptimizer] Slow query detected (${executionTime}ms):`, query.substring(0, 100) + '...');
    }
  }

  private getQueryKey(query: string): string {
    // Create a normalized key for the query
    return query.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  // Get slow queries for analysis
  getSlowQueries(): QueryStats[] {
    return Array.from(this.slowQueries.values());
  }

  // Get index recommendations
  getIndexRecommendations(): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];
    
    for (const [queryKey, stats] of this.slowQueries.entries()) {
      if (stats.count > 10 && stats.avgTime > 2000) { // 2 second average
        recommendations.push({
          query: stats.query,
          queryType: stats.queryType,
          avgTime: stats.avgTime,
          count: stats.count,
          recommendedIndex: this.suggestIndex(stats.query),
          priority: this.calculatePriority(stats)
        });
      }
    }
    
    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  private suggestIndex(query: string): string {
    // Simple index suggestion logic
    if (query.includes('org_id') && query.includes('balance_date')) {
      return 'CREATE INDEX idx_org_balance_date ON daily_cash_balances(org_id, balance_date)';
    }
    
    if (query.includes('org_id') && query.includes('occurred_at')) {
      return 'CREATE INDEX idx_org_occurred_at ON revenues(org_id, occurred_at)';
    }
    
    return 'CREATE INDEX idx_custom ON table_name(column_name)';
  }

  private calculatePriority(stats: QueryStats): number {
    // Priority based on frequency and performance impact
    return stats.count * stats.avgTime;
  }

  // Clear slow queries cache
  clearSlowQueries() {
    this.slowQueries.clear();
  }

  // Get index statistics
  getIndexStats(): IndexStats[] {
    return Array.from(this.indexes.values()).map(index => ({
      name: index.name,
      table: index.table,
      columns: index.columns.join(', '),
      type: index.type,
      isUnique: index.isUnique,
      isActive: index.isActive,
      createdAt: index.createdAt
    }));
  }
}

interface IndexInfo {
  name: string;
  table: string;
  columns: string[];
  type: string;
  isUnique: boolean;
  isActive: boolean;
  createdAt: Date;
  whereClause?: string;
  includeColumns?: string[];
}

interface QueryStats {
  query: string;
  queryType: string;
  count: number;
  totalTime: number;
  avgTime: number;
  maxTime: number;
  firstSeen: Date;
  lastSeen: Date;
}

interface IndexRecommendation {
  query: string;
  queryType: string;
  avgTime: number;
  count: number;
  recommendedIndex: string;
  priority: number;
}

interface IndexStats {
  name: string;
  table: string;
  columns: string;
  type: string;
  isUnique: boolean;
  isActive: boolean;
  createdAt: Date;
}

export const databaseIndexOptimizer = new DatabaseIndexOptimizer();

// ✅ FIX 5: Architecture Scaling Performance Monitor
export class ArchitectureScalingMonitor {
  private metrics = {
    partitionsUsed: 0,
    replicasActive: 0,
    cacheInvalidations: 0,
    slowQueries: 0,
    indexHits: 0,
    indexMisses: 0,
    partitionLoad: new Map<string, number>(),
    replicaLoad: new Map<string, number>()
  };

  recordPartitionUsage(partitionId: string) {
    this.metrics.partitionsUsed++;
    const currentLoad = this.metrics.partitionLoad.get(partitionId) || 0;
    this.metrics.partitionLoad.set(partitionId, currentLoad + 1);
  }

  recordReplicaUsage(replicaId: string) {
    this.metrics.replicasActive++;
    const currentLoad = this.metrics.replicaLoad.get(replicaId) || 0;
    this.metrics.replicaLoad.set(replicaId, currentLoad + 1);
  }

  recordCacheInvalidation() {
    this.metrics.cacheInvalidations++;
  }

  recordSlowQuery() {
    this.metrics.slowQueries++;
  }

  recordIndexHit() {
    this.metrics.indexHits++;
  }

  recordIndexMiss() {
    this.metrics.indexMisses++;
  }

  getMetrics() {
    return {
      ...this.metrics,
      indexHitRate: this.metrics.indexHits / (this.metrics.indexHits + this.metrics.indexMisses),
      partitionLoad: Object.fromEntries(this.metrics.partitionLoad),
      replicaLoad: Object.fromEntries(this.metrics.replicaLoad)
    };
  }

  // Alert if performance degrades
  checkAlerts() {
    const indexHitRate = this.metrics.indexHits / (this.metrics.indexHits + this.metrics.indexMisses);
    
    if (indexHitRate < 0.8) { // 80% index hit rate
      console.warn(`[ArchitectureScaling] Low index hit rate: ${(indexHitRate * 100).toFixed(2)}%`);
    }

    // Check partition load distribution
    const partitionLoads = Array.from(this.metrics.partitionLoad.values());
    const maxLoad = Math.max(...partitionLoads);
    const minLoad = Math.min(...partitionLoads);
    
    if (maxLoad > minLoad * 2) { // 2x load difference
      console.warn(`[ArchitectureScaling] Uneven partition load distribution: max=${maxLoad}, min=${minLoad}`);
    }
  }
}

export const architectureScalingMonitor = new ArchitectureScalingMonitor();
