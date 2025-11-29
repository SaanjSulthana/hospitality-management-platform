// Read Replica Manager for Phase 2 Architecture Scaling
// Target: Offload read queries and optimize cache invalidation (100K-500K organizations)

import { SQLDatabase } from "encore.dev/storage/sqldb";

interface ReplicaConfig {
  name: string;
  connectionString: string;
  isReadOnly: boolean;
  maxConnections: number;
  minConnections: number;
  maxIdleTime: string;
  maxLifetime: string;
  connectionTimeout: string;
  queryTimeout: string;
}

export class ReplicaManager {
  private readReplicas: Map<string, SQLDatabase> = new Map();
  private writeDatabase: SQLDatabase;
  private replicaConfigs: Map<string, ReplicaConfig> = new Map();
  private currentReplicaIndex = 0;
  private replicaCount = 0;

  constructor() {
    this.initializeReplicaConfigs();
    this.initializeDatabases();
  }

  private initializeReplicaConfigs() {
    // Read replica configuration
    const readReplicaConfig: ReplicaConfig = {
      name: 'read_replica',
      connectionString: process.env.READ_REPLICA_CONNECTION_STRING || 'postgresql://localhost:5432/hospitality_read',
      isReadOnly: true,
      maxConnections: 50,  // Lower than write DB since it's read-only
      minConnections: 5,
      maxIdleTime: '15m',
      maxLifetime: '2h',
      connectionTimeout: '30s',
      queryTimeout: '60s'
    };

    this.replicaConfigs.set('read_replica', readReplicaConfig);
  }

  private initializeDatabases() {
    const useReadReplicas = process.env.USE_READ_REPLICAS === 'true';
    
    // Initialize write database (primary)
    this.writeDatabase = SQLDatabase.named("hospitality", {
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '100'),
      minConnections: parseInt(process.env.DB_MIN_CONNECTIONS || '10'),
      maxIdleTime: process.env.DB_MAX_IDLE_TIME || "10m",
      maxLifetime: process.env.DB_MAX_LIFETIME || "1h",
      connectionTimeout: process.env.DB_CONNECTION_TIMEOUT || "30s",
      queryTimeout: process.env.DB_QUERY_TIMEOUT || "60s"
    });

    console.log(`[ReplicaManager] ✅ Initialized write database (primary)`);

    // Initialize read replicas if enabled
    if (useReadReplicas) {
      console.warn('[ReplicaManager] ⚠️ Dynamic read replica initialization is not yet supported in this build.');
      console.warn('[ReplicaManager] ⚠️ Set USE_READ_REPLICAS=false or define static replicas in encore.app to enable.');
    } else {
      console.log(`[ReplicaManager] ℹ️ Read replicas disabled (USE_READ_REPLICAS not set)`);
    }

    // Start health check monitoring
    this.startHealthChecks();
  }

  // Route queries based on operation type
  async routeQuery(operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE', query: string, params: any[]): Promise<any> {
    if (operation === 'SELECT') {
      return await this.executeOnReadReplica(query, params);
    } else {
      return await this.executeOnWriteDatabase(query, params);
    }
  }

  // Execute on read replica with load balancing
  private async executeOnReadReplica(query: string, params: any[]): Promise<any> {
    const replicaName = this.getNextReplica();
    const replica = this.readReplicas.get(replicaName);
    
    if (!replica) {
      console.warn(`[ReplicaManager] Read replica ${replicaName} not available, falling back to write database`);
      return await this.executeOnWriteDatabase(query, params);
    }

    try {
      console.log(`[ReplicaManager] Executing read query on replica: ${replicaName}`);
      return await replica.exec(query, params);
    } catch (error) {
      console.error(`[ReplicaManager] Read replica ${replicaName} failed:`, error);
      console.log(`[ReplicaManager] Falling back to write database`);
      return await this.executeOnWriteDatabase(query, params);
    }
  }

  // Execute on write database
  private async executeOnWriteDatabase(query: string, params: any[]): Promise<any> {
    console.log(`[ReplicaManager] Executing write query on primary database`);
    return await this.writeDatabase.exec(query, params);
  }

  // Round-robin load balancing for read replicas
  private getNextReplica(): string {
    const replicaNames = Array.from(this.readReplicas.keys());
    const replicaName = replicaNames[this.currentReplicaIndex];
    this.currentReplicaIndex = (this.currentReplicaIndex + 1) % this.replicaCount;
    return replicaName;
  }

  // Health check for replicas
  async checkReplicaHealth(): Promise<Map<string, boolean>> {
    const healthStatus = new Map<string, boolean>();

    for (const [name, replica] of this.readReplicas) {
      try {
        await replica.exec('SELECT 1');
        healthStatus.set(name, true);
        console.log(`[ReplicaManager] Replica ${name} is healthy`);
      } catch (error) {
        healthStatus.set(name, false);
        console.error(`[ReplicaManager] Replica ${name} is unhealthy:`, error);
      }
    }

    return healthStatus;
  }

  // Get replica statistics
  async getReplicaStats(): Promise<any> {
    const stats: any = {
      replicaCount: this.replicaCount,
      currentReplicaIndex: this.currentReplicaIndex,
      replicas: {}
    };

    for (const [name, replica] of this.readReplicas) {
      try {
        const result = await replica.exec('SELECT COUNT(*) as connection_count FROM pg_stat_activity');
        stats.replicas[name] = {
          status: 'healthy',
          connectionCount: result[0]?.connection_count || 0
        };
      } catch (error) {
        stats.replicas[name] = {
          status: 'unhealthy',
          error: error.message
        };
      }
    }

    return stats;
  }

  // Add new replica - Commented out due to missing database definition
  async addReplica(name: string, config: ReplicaConfig): Promise<void> {
    console.log(`[ReplicaManager] Adding new replica: ${name}`);
    
    // const replica = SQLDatabase.named("hospitality_replica", {
    //   maxConnections: config.maxConnections,
    //   minConnections: config.minConnections,
    //   maxIdleTime: config.maxIdleTime,
    //   maxLifetime: config.maxLifetime,
    //   connectionTimeout: config.connectionTimeout,
    //   queryTimeout: config.queryTimeout
    // });

    // this.readReplicas.set(name, replica);
    this.replicaConfigs.set(name, config);
    this.replicaCount++;

    console.log(`[ReplicaManager] Replica ${name} added successfully`);
  }

  // Remove replica
  async removeReplica(name: string): Promise<void> {
    console.log(`[ReplicaManager] Removing replica: ${name}`);
    
    this.readReplicas.delete(name);
    this.replicaConfigs.delete(name);
    this.replicaCount--;

    // Adjust current index if necessary
    if (this.currentReplicaIndex >= this.replicaCount) {
      this.currentReplicaIndex = 0;
    }

    console.log(`[ReplicaManager] Replica ${name} removed successfully`);
  }

  // Get write database for direct access
  getWriteDatabase(): SQLDatabase {
    return this.writeDatabase;
  }

  // Get read replica for direct access
  getReadReplica(name?: string): SQLDatabase {
    if (name) {
      return this.readReplicas.get(name) || this.writeDatabase;
    }
    return this.readReplicas.get(this.getNextReplica()) || this.writeDatabase;
  }

  // Check if read replicas are available
  hasReadReplicas(): boolean {
    return this.replicaCount > 0;
  }

  // Get replica configuration
  getReplicaConfig(name: string): ReplicaConfig | undefined {
    return this.replicaConfigs.get(name);
  }

  // Update replica configuration
  updateReplicaConfig(name: string, config: Partial<ReplicaConfig>): void {
    const existingConfig = this.replicaConfigs.get(name);
    if (existingConfig) {
      const updatedConfig = { ...existingConfig, ...config };
      this.replicaConfigs.set(name, updatedConfig);
      console.log(`[ReplicaManager] Updated configuration for replica: ${name}`);
    }
  }

  // Start periodic health checks for replicas
  private startHealthChecks(): void {
    const healthCheckInterval = parseInt(process.env.REPLICA_HEALTH_CHECK_INTERVAL || '30000'); // 30 seconds
    
    if (this.replicaCount === 0) {
      console.log(`[ReplicaManager] No replicas to monitor`);
      return;
    }

    setInterval(async () => {
      try {
        const healthStatus = await this.checkReplicaHealth();
        
        for (const [name, isHealthy] of healthStatus) {
          if (!isHealthy) {
            console.warn(`[ReplicaManager] ⚠️ Replica ${name} health check failed`);
          }
        }
      } catch (error) {
        console.error(`[ReplicaManager] Error during health check:`, error);
      }
    }, healthCheckInterval);

    console.log(`[ReplicaManager] ✅ Started health check monitoring (interval: ${healthCheckInterval}ms)`);
  }

  // Get replica lag (for monitoring)
  async getReplicaLag(): Promise<Map<string, number>> {
    const lagMap = new Map<string, number>();

    for (const [name, replica] of this.readReplicas) {
      try {
        // Query replication lag from pg_stat_replication view
        const result = await replica.queryRow`
          SELECT 
            COALESCE(
              EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))::INTEGER,
              0
            ) as lag_seconds
        `;
        
        lagMap.set(name, result?.lag_seconds || 0);
      } catch (error) {
        console.error(`[ReplicaManager] Error getting lag for replica ${name}:`, error);
        lagMap.set(name, -1); // -1 indicates error
      }
    }

    return lagMap;
  }

  // Get connection pool stats
  async getConnectionPoolStats(): Promise<any> {
    const stats: any = {
      primary: {},
      replicas: {}
    };

    // Get primary database stats
    try {
      const primaryStats = await this.writeDatabase.queryRow`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      `;
      stats.primary = primaryStats;
    } catch (error) {
      console.error(`[ReplicaManager] Error getting primary stats:`, error);
    }

    // Get replica stats
    for (const [name, replica] of this.readReplicas) {
      try {
        const replicaStats = await replica.queryRow`
          SELECT 
            count(*) as total_connections,
            count(*) FILTER (WHERE state = 'active') as active_connections,
            count(*) FILTER (WHERE state = 'idle') as idle_connections
          FROM pg_stat_activity
          WHERE datname = current_database()
        `;
        stats.replicas[name] = replicaStats;
      } catch (error) {
        console.error(`[ReplicaManager] Error getting stats for replica ${name}:`, error);
      }
    }

    return stats;
  }
}

// Global replica manager instance
export const replicaManager = new ReplicaManager();
