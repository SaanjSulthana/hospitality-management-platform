// Snapshot Manager - Phase 3 Advanced Scaling
// Target: Snapshot management for event sourcing (1M+ organizations)

import { eventStoreDB } from "./event_store";
import { v4 as uuidv4 } from 'uuid';

// Snapshot Manager Interfaces
export interface Snapshot {
  snapshotId: string;
  aggregateType: string;
  aggregateId: string;
  orgId: number;
  version: number;
  payload: any;
  createdAt: Date;
  size: number;
  compressed: boolean;
}

export interface SnapshotConfig {
  maxEventsPerSnapshot: number;
  compressionThreshold: number;
  retentionDays: number;
  compressionEnabled: boolean;
  snapshotInterval: number; // milliseconds
}

export interface SnapshotStats {
  totalSnapshots: number;
  averageSnapshotSize: number;
  compressionRatio: number;
  oldestSnapshot: Date;
  newestSnapshot: Date;
  totalStorageUsed: number;
}

// Snapshot Manager Class
export class SnapshotManager {
  private serviceName = 'SnapshotManager';
  private version = '1.0.0';
  private config: SnapshotConfig = {
    maxEventsPerSnapshot: 100,
    compressionThreshold: 1024, // 1KB
    retentionDays: 365,
    compressionEnabled: true,
    snapshotInterval: 300000 // 5 minutes
  };
  private stats = {
    totalSnapshots: 0,
    averageSnapshotSize: 0,
    compressionRatio: 0,
    oldestSnapshot: new Date(),
    newestSnapshot: new Date(),
    totalStorageUsed: 0
  };

  constructor() {
    console.log(`[${this.serviceName}] Initialized v${this.version}`);
    this.startPeriodicSnapshots();
  }

  // Create Snapshot
  async createSnapshot(
    aggregateType: string, 
    aggregateId: string, 
    orgId: number,
    force: boolean = false
  ): Promise<Snapshot> {
    try {
      // Check if snapshot is needed
      if (!force && !(await this.shouldCreateSnapshot(aggregateType, aggregateId, orgId))) {
        console.log(`[${this.serviceName}] Snapshot not needed for ${aggregateType}:${aggregateId}`);
        return null;
      }

      // Get current state by replaying events
      const currentState = await this.getCurrentState(aggregateType, aggregateId, orgId);
      
      // Get latest version
      const latestVersion = await this.getLatestVersion(aggregateType, aggregateId, orgId);
      
      // Compress payload if needed
      const payload = this.config.compressionEnabled && JSON.stringify(currentState).length > this.config.compressionThreshold
        ? await this.compressPayload(currentState)
        : currentState;

      const compressed = this.config.compressionEnabled && JSON.stringify(currentState).length > this.config.compressionThreshold;

      // Create snapshot
      const snapshotId = uuidv4();
      const snapshot: Snapshot = {
        snapshotId,
        aggregateType,
        aggregateId,
        orgId,
        version: latestVersion,
        payload,
        createdAt: new Date(),
        size: JSON.stringify(payload).length,
        compressed
      };

      // Store snapshot
      await this.storeSnapshot(snapshot);

      // Update statistics
      this.updateStats(snapshot);

      console.log(`[${this.serviceName}] Snapshot created: ${snapshotId} for ${aggregateType}:${aggregateId}`);
      return snapshot;
    } catch (error) {
      console.error(`[${this.serviceName}] Error creating snapshot:`, error);
      throw error;
    }
  }

  // Get Latest Snapshot
  async getLatestSnapshot(aggregateType: string, aggregateId: string, orgId: number): Promise<Snapshot | null> {
    try {
      const row = await eventStoreDB.queryRow`
        SELECT * FROM snapshots 
        WHERE aggregate_type = ${aggregateType} 
        AND aggregate_id = ${aggregateId} 
        AND org_id = ${orgId}
        ORDER BY version DESC
        LIMIT 1
      `;

      if (!row) return null;

      return {
        snapshotId: row.snapshot_id,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        orgId: row.org_id,
        version: row.version,
        payload: row.compressed ? await this.decompressPayload(row.payload) : JSON.parse(row.payload),
        createdAt: new Date(row.created_at),
        size: row.size,
        compressed: row.compressed
      };
    } catch (error) {
      console.error(`[${this.serviceName}] Error getting latest snapshot:`, error);
      throw error;
    }
  }

  // Get Snapshot by Version
  async getSnapshotByVersion(
    aggregateType: string, 
    aggregateId: string, 
    orgId: number, 
    version: number
  ): Promise<Snapshot | null> {
    try {
      const row = await eventStoreDB.queryRow`
        SELECT * FROM snapshots 
        WHERE aggregate_type = ${aggregateType} 
        AND aggregate_id = ${aggregateId} 
        AND org_id = ${orgId}
        AND version = ${version}
        LIMIT 1
      `;

      if (!row) return null;

      return {
        snapshotId: row.snapshot_id,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        orgId: row.org_id,
        version: row.version,
        payload: row.compressed ? await this.decompressPayload(row.payload) : JSON.parse(row.payload),
        createdAt: new Date(row.created_at),
        size: row.size,
        compressed: row.compressed
      };
    } catch (error) {
      console.error(`[${this.serviceName}] Error getting snapshot by version:`, error);
      throw error;
    }
  }

  // Restore from Snapshot
  async restoreFromSnapshot(
    aggregateType: string, 
    aggregateId: string, 
    orgId: number,
    targetVersion?: number
  ): Promise<any> {
    try {
      // Get latest snapshot
      const snapshot = targetVersion 
        ? await this.getSnapshotByVersion(aggregateType, aggregateId, orgId, targetVersion)
        : await this.getLatestSnapshot(aggregateType, aggregateId, orgId);

      if (!snapshot) {
        console.log(`[${this.serviceName}] No snapshot found for ${aggregateType}:${aggregateId}`);
        return null;
      }

      // Get events after snapshot
      const events = await this.getEventsAfterVersion(aggregateType, aggregateId, orgId, snapshot.version);
      
      // Replay events from snapshot state
      let currentState = snapshot.payload;
      for (const event of events) {
        currentState = await this.applyEvent(currentState, event);
      }

      console.log(`[${this.serviceName}] Restored from snapshot: ${snapshot.snapshotId} for ${aggregateType}:${aggregateId}`);
      return currentState;
    } catch (error) {
      console.error(`[${this.serviceName}] Error restoring from snapshot:`, error);
      throw error;
    }
  }

  // Check if Snapshot Should be Created
  private async shouldCreateSnapshot(aggregateType: string, aggregateId: string, orgId: number): Promise<boolean> {
    try {
      // Get event count since last snapshot
      const result = await eventStoreDB.queryRow`
        SELECT COUNT(*) as count FROM events 
        WHERE aggregate_type = ${aggregateType} 
        AND aggregate_id = ${aggregateId} 
        AND org_id = ${orgId}
        AND timestamp > (
          SELECT COALESCE(MAX(created_at), '1970-01-01') FROM snapshots 
          WHERE aggregate_type = ${aggregateType} 
          AND aggregate_id = ${aggregateId} 
          AND org_id = ${orgId}
        )
      `;

      return result.count >= this.config.maxEventsPerSnapshot;
    } catch (error) {
      console.error(`[${this.serviceName}] Error checking snapshot need:`, error);
      return false;
    }
  }

  // Get Current State
  private async getCurrentState(aggregateType: string, aggregateId: string, orgId: number): Promise<any> {
    try {
      // Get all events for aggregate
      const events = await eventStoreDB.queryAll`
        SELECT * FROM events 
        WHERE aggregate_type = ${aggregateType} 
        AND aggregate_id = ${aggregateId} 
        AND org_id = ${orgId}
        ORDER BY version ASC
      `;

      // Replay events to get current state
      let currentState = {};
      for (const event of events) {
        currentState = await this.applyEvent(currentState, {
          eventId: event.event_id,
          eventType: event.event_type,
          aggregateType: event.aggregate_type,
          aggregateId: event.aggregate_id,
          orgId: event.org_id,
          timestamp: new Date(event.timestamp),
          payload: JSON.parse(event.payload),
          metadata: JSON.parse(event.metadata),
          version: event.version
        });
      }

      return currentState;
    } catch (error) {
      console.error(`[${this.serviceName}] Error getting current state:`, error);
      throw error;
    }
  }

  // Get Latest Version
  private async getLatestVersion(aggregateType: string, aggregateId: string, orgId: number): Promise<number> {
    try {
      const result = await eventStoreDB.queryRow`
        SELECT MAX(version) as version FROM events 
        WHERE aggregate_type = ${aggregateType} 
        AND aggregate_id = ${aggregateId} 
        AND org_id = ${orgId}
      `;

      return result.version || 0;
    } catch (error) {
      console.error(`[${this.serviceName}] Error getting latest version:`, error);
      return 0;
    }
  }

  // Get Events After Version
  private async getEventsAfterVersion(
    aggregateType: string, 
    aggregateId: string, 
    orgId: number, 
    version: number
  ): Promise<any[]> {
    try {
      const events = await eventStoreDB.queryAll`
        SELECT * FROM events 
        WHERE aggregate_type = ${aggregateType} 
        AND aggregate_id = ${aggregateId} 
        AND org_id = ${orgId}
        AND version > ${version}
        ORDER BY version ASC
      `;

      return events.map(event => ({
        eventId: event.event_id,
        eventType: event.event_type,
        aggregateType: event.aggregate_type,
        aggregateId: event.aggregate_id,
        orgId: event.org_id,
        timestamp: new Date(event.timestamp),
        payload: JSON.parse(event.payload),
        metadata: JSON.parse(event.metadata),
        version: event.version
      }));
    } catch (error) {
      console.error(`[${this.serviceName}] Error getting events after version:`, error);
      return [];
    }
  }

  // Apply Event to State
  private async applyEvent(currentState: any, event: any): Promise<any> {
    // Simplified event application
    switch (event.eventType) {
      case 'revenue_added':
        return { ...currentState, revenue: (currentState.revenue || 0) + event.payload.amount };
      case 'expense_added':
        return { ...currentState, expense: (currentState.expense || 0) + event.payload.amount };
      case 'revenue_approved':
        return { ...currentState, approvedRevenue: (currentState.approvedRevenue || 0) + event.payload.amount };
      case 'expense_approved':
        return { ...currentState, approvedExpense: (currentState.approvedExpense || 0) + event.payload.amount };
      default:
        return currentState;
    }
  }

  // Store Snapshot
  private async storeSnapshot(snapshot: Snapshot): Promise<void> {
    try {
      await eventStoreDB.exec`
        INSERT INTO snapshots (
          snapshot_id, aggregate_type, aggregate_id, org_id,
          version, payload, size, compressed, created_at
        ) VALUES (
          ${snapshot.snapshotId}, ${snapshot.aggregateType}, ${snapshot.aggregateId}, ${snapshot.orgId},
          ${snapshot.version}, ${JSON.stringify(snapshot.payload)}, ${snapshot.size}, ${snapshot.compressed}, ${snapshot.createdAt}
        )
      `;
    } catch (error) {
      console.error(`[${this.serviceName}] Error storing snapshot:`, error);
      throw error;
    }
  }

  // Compress Payload
  private async compressPayload(payload: any): Promise<any> {
    // Simplified compression - in production, use actual compression library
    return {
      compressed: true,
      data: JSON.stringify(payload)
    };
  }

  // Decompress Payload
  private async decompressPayload(compressedPayload: any): Promise<any> {
    // Simplified decompression - in production, use actual decompression library
    if (compressedPayload.compressed) {
      return JSON.parse(compressedPayload.data);
    }
    return compressedPayload;
  }

  // Update Statistics
  private updateStats(snapshot: Snapshot): void {
    this.stats.totalSnapshots++;
    this.stats.averageSnapshotSize = (this.stats.averageSnapshotSize + snapshot.size) / 2;
    this.stats.totalStorageUsed += snapshot.size;
    
    if (snapshot.createdAt < this.stats.oldestSnapshot) {
      this.stats.oldestSnapshot = snapshot.createdAt;
    }
    if (snapshot.createdAt > this.stats.newestSnapshot) {
      this.stats.newestSnapshot = snapshot.createdAt;
    }
  }

  // Start Periodic Snapshots
  private startPeriodicSnapshots(): void {
    setInterval(async () => {
      try {
        await this.createPeriodicSnapshots();
      } catch (error) {
        console.error(`[${this.serviceName}] Error in periodic snapshots:`, error);
      }
    }, this.config.snapshotInterval);
  }

  // Create Periodic Snapshots
  private async createPeriodicSnapshots(): Promise<void> {
    try {
      // Get aggregates that need snapshots
      const aggregates = await eventStoreDB.queryAll`
        SELECT DISTINCT aggregate_type, aggregate_id, org_id
        FROM events
        WHERE timestamp > NOW() - INTERVAL '1 hour'
        GROUP BY aggregate_type, aggregate_id, org_id
        HAVING COUNT(*) >= ${this.config.maxEventsPerSnapshot}
      `;

      for (const aggregate of aggregates) {
        await this.createSnapshot(
          aggregate.aggregate_type,
          aggregate.aggregate_id,
          aggregate.org_id
        );
      }

      console.log(`[${this.serviceName}] Created ${aggregates.length} periodic snapshots`);
    } catch (error) {
      console.error(`[${this.serviceName}] Error creating periodic snapshots:`, error);
    }
  }

  // Get Snapshot Statistics
  async getStats(): Promise<SnapshotStats> {
    try {
      const result = await eventStoreDB.queryRow`
        SELECT 
          COUNT(*) as totalSnapshots,
          AVG(size) as averageSnapshotSize,
          SUM(size) as totalStorageUsed,
          MIN(created_at) as oldestSnapshot,
          MAX(created_at) as newestSnapshot
        FROM snapshots
      `;

      return {
        totalSnapshots: result.totalSnapshots,
        averageSnapshotSize: result.averageSnapshotSize,
        compressionRatio: this.stats.compressionRatio,
        oldestSnapshot: new Date(result.oldestSnapshot),
        newestSnapshot: new Date(result.newestSnapshot),
        totalStorageUsed: result.totalStorageUsed
      };
    } catch (error) {
      console.error(`[${this.serviceName}] Error getting stats:`, error);
      return this.stats;
    }
  }

  // Cleanup Old Snapshots
  async cleanupOldSnapshots(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      await eventStoreDB.exec`
        DELETE FROM snapshots 
        WHERE created_at < ${cutoffDate}
      `;

      console.log(`[${this.serviceName}] Cleaned up snapshots older than ${this.config.retentionDays} days`);
    } catch (error) {
      console.error(`[${this.serviceName}] Error cleaning up old snapshots:`, error);
      throw error;
    }
  }

  // Get Service Health
  async getHealth(): Promise<{
    service: string;
    version: string;
    status: 'healthy' | 'unhealthy';
    stats: SnapshotStats;
    timestamp: string;
  }> {
    try {
      const stats = await this.getStats();
      
      return {
        service: this.serviceName,
        version: this.version,
        status: 'healthy',
        stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        service: this.serviceName,
        version: this.version,
        status: 'unhealthy',
        stats: this.stats,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Global snapshot manager instance
export const snapshotManager = new SnapshotManager();
