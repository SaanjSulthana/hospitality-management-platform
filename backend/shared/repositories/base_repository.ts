// Base Repository with Partition Routing and Replica Support
// Provides shared logic for routing queries to partitioned or legacy tables
// and read/write routing to replicas

import { SQLDatabase } from "encore.dev/storage/sqldb";
import { DatabaseConfig } from "../../config/runtime";
import { replicaRouter } from "../../database/replica_router";

export interface PartitionRoutingOptions {
  tableName: string;
  orgId?: number;
  date?: string;
  usePartitioned?: boolean;
}

export interface QueryOptions {
  preferReplica?: boolean;  // Whether to prefer read replica for this query
  orgId?: number;           // Organization ID for routing
}

export class BaseRepository {
  protected db: SQLDatabase;
  protected useReplicas: boolean;

  constructor(db: SQLDatabase) {
    this.db = db;
    this.useReplicas = process.env.USE_READ_REPLICAS === 'true';
  }

  /**
   * Get database connection for read operations
   * Routes to replica if available and preferred
   */
  protected getReadConnection(options: QueryOptions = {}): SQLDatabase {
    if (!this.useReplicas) {
      return this.db;
    }

    const { preferReplica = true, orgId = 0 } = options;
    return replicaRouter.getReadConnection(orgId, preferReplica);
  }

  /**
   * Get database connection for write operations
   * Always routes to primary
   */
  protected getWriteConnection(orgId?: number): SQLDatabase {
    if (!this.useReplicas) {
      return this.db;
    }

    return replicaRouter.getWriteConnection(orgId);
  }

  /**
   * Determine the target table name based on partition settings
   */
  protected getTableName(options: PartitionRoutingOptions): string {
    const { tableName, usePartitioned } = options;

    // Check if partitioned tables should be used
    const shouldUsePartitioned = usePartitioned ?? DatabaseConfig.usePartitionedTables;

    if (!shouldUsePartitioned) {
      return tableName;
    }

    // Return partitioned table name
    return `${tableName}_partitioned`;
  }

  /**
   * Check if we should use partitioned tables
   */
  protected shouldUsePartitionedTables(override?: boolean): boolean {
    return override ?? DatabaseConfig.usePartitionedTables;
  }

  /**
   * Log partition routing decision for debugging
   */
  protected logPartitionRouting(
    tableName: string,
    targetTable: string,
    operation: string
  ): void {
    if (process.env.LOG_PARTITION_ROUTING === 'true') {
      console.log(`[PartitionRouting] ${operation} - ${tableName} -> ${targetTable}`);
    }
  }
}

/**
 * Partition-aware query builder
 */
export class PartitionAwareQueryBuilder {
  private tableName: string;
  private targetTable: string;
  private conditions: string[] = [];
  private params: any[] = [];

  constructor(tableName: string, usePartitioned: boolean = DatabaseConfig.usePartitionedTables) {
    this.tableName = tableName;
    this.targetTable = usePartitioned ? `${tableName}_partitioned` : tableName;
  }

  where(condition: string, ...params: any[]): this {
    this.conditions.push(condition);
    this.params.push(...params);
    return this;
  }

  buildSelect(columns: string = '*'): { query: string; params: any[] } {
    const whereClause = this.conditions.length > 0
      ? `WHERE ${this.conditions.join(' AND ')}`
      : '';

    return {
      query: `SELECT ${columns} FROM ${this.targetTable} ${whereClause}`,
      params: this.params
    };
  }

  buildInsert(columns: string[], values: any[]): { query: string; params: any[] } {
    const columnList = columns.join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    return {
      query: `INSERT INTO ${this.targetTable} (${columnList}) VALUES (${placeholders})`,
      params: values
    };
  }

  buildUpdate(updates: Record<string, any>): { query: string; params: any[] } {
    const updateEntries = Object.entries(updates);
    const setClause = updateEntries
      .map((_, i) => `${updateEntries[i][0]} = $${i + 1}`)
      .join(', ');

    const whereClause = this.conditions.length > 0
      ? `WHERE ${this.conditions.join(' AND ')}`
      : '';

    const updateParams = updateEntries.map(([_, value]) => value);

    return {
      query: `UPDATE ${this.targetTable} SET ${setClause} ${whereClause}`,
      params: [...updateParams, ...this.params]
    };
  }

  buildDelete(): { query: string; params: any[] } {
    const whereClause = this.conditions.length > 0
      ? `WHERE ${this.conditions.join(' AND ')}`
      : '';

    return {
      query: `DELETE FROM ${this.targetTable} ${whereClause}`,
      params: this.params
    };
  }

  getTargetTable(): string {
    return this.targetTable;
  }
}

