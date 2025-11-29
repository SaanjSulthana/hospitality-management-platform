// Event Store - Phase 3 Advanced Scaling
// Target: Event sourcing for audit trails and data recovery (1M+ organizations)

import { SQLDatabase } from "encore.dev/storage/sqldb";
import { v4 as uuidv4 } from 'uuid';
import { eventStoreDB } from "./db";

// Event Store Interfaces
export interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  orgId: number;
  timestamp: Date;
  payload: any;
  metadata?: any;
  version: number;
}

export interface EventStoreConfig {
  maxEventsPerSnapshot: number;
  snapshotInterval: number;
  retentionDays: number;
  compressionEnabled: boolean;
}

export interface EventStoreStats {
  totalEvents: number;
  eventsPerSecond: number;
  aggregateCount: number;
  snapshotCount: number;
  storageSize: number;
  averageEventSize: number;
}

// Event Store Database defined in db.ts
// Migrations handled by Encore's migration system

// Event Store Class
export class EventStore {
  private serviceName = 'EventStore';
  private version = '1.0.0';
  private config: EventStoreConfig = {
    maxEventsPerSnapshot: 100,
    snapshotInterval: 1000, // 1 second
    retentionDays: 365,
    compressionEnabled: true
  };
  private stats = {
    totalEvents: 0,
    eventsPerSecond: 0,
    aggregateCount: 0,
    snapshotCount: 0,
    storageSize: 0,
    averageEventSize: 0
  };
  private startTime = Date.now();

  constructor() {
    console.log(`[${this.serviceName}] Initialized v${this.version}`);
  }

  // Append Event
  async appendEvent(event: DomainEvent): Promise<void> {
    try {
      // Insert event into event store
      await eventStoreDB.exec`
        INSERT INTO events (
          event_id, event_type, aggregate_type, aggregate_id,
          org_id, timestamp, payload, metadata, version
        ) VALUES (
          ${event.eventId}, ${event.eventType}, ${event.aggregateType}, ${event.aggregateId},
          ${event.orgId}, ${event.timestamp}, ${JSON.stringify(event.payload)}, ${JSON.stringify(event.metadata || {})}, ${event.version}
        )
      `;

      // Update statistics
      this.updateStats(event);

      // Check if snapshot is needed
      await this.checkAndCreateSnapshot(event.aggregateType, event.aggregateId, event.orgId);

      console.log(`[${this.serviceName}] Event appended: ${event.eventId} for ${event.aggregateType}:${event.aggregateId}`);
    } catch (error) {
      console.error(`[${this.serviceName}] Error appending event:`, error);
      throw error;
    }
  }

  // Get Events for Aggregate
  async getEventsForAggregate(
    aggregateType: string, 
    aggregateId: string, 
    orgId: number,
    fromVersion?: number
  ): Promise<DomainEvent[]> {
    try {
      const query = fromVersion 
        ? `SELECT * FROM events 
           WHERE aggregate_type = '${aggregateType}' 
           AND aggregate_id = '${aggregateId}' 
           AND org_id = ${orgId}
           AND version >= ${fromVersion}
           ORDER BY version ASC`
        : `SELECT * FROM events 
           WHERE aggregate_type = '${aggregateType}' 
           AND aggregate_id = '${aggregateId}' 
           AND org_id = ${orgId}
           ORDER BY version ASC`;

      const rows = await eventStoreDB.queryAll(query);

      return rows.map(row => ({
        eventId: row.event_id,
        eventType: row.event_type,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        orgId: row.org_id,
        timestamp: new Date(row.timestamp),
        payload: JSON.parse(row.payload),
        metadata: JSON.parse(row.metadata),
        version: row.version
      }));
    } catch (error) {
      console.error(`[${this.serviceName}] Error getting events for aggregate:`, error);
      throw error;
    }
  }

  // Get Events by Type
  async getEventsByType(
    eventType: string, 
    orgId: number,
    limit: number = 100,
    offset: number = 0
  ): Promise<DomainEvent[]> {
    try {
      const rows = await eventStoreDB.queryAll`
        SELECT * FROM events 
        WHERE event_type = ${eventType} 
        AND org_id = ${orgId}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      return rows.map(row => ({
        eventId: row.event_id,
        eventType: row.event_type,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        orgId: row.org_id,
        timestamp: new Date(row.timestamp),
        payload: JSON.parse(row.payload),
        metadata: JSON.parse(row.metadata),
        version: row.version
      }));
    } catch (error) {
      console.error(`[${this.serviceName}] Error getting events by type:`, error);
      throw error;
    }
  }

  // Create Snapshot
  async createSnapshot(aggregateType: string, aggregateId: string, orgId: number): Promise<void> {
    try {
      // Get all events for aggregate
      const events = await this.getEventsForAggregate(aggregateType, aggregateId, orgId);
      
      if (events.length === 0) {
        console.log(`[${this.serviceName}] No events found for snapshot: ${aggregateType}:${aggregateId}`);
        return;
      }

      // Create snapshot
      const snapshotId = uuidv4();
      const latestEvent = events[events.length - 1];
      
      await eventStoreDB.exec`
        INSERT INTO snapshots (
          snapshot_id, aggregate_type, aggregate_id, org_id,
          version, payload, created_at
        ) VALUES (
          ${snapshotId}, ${aggregateType}, ${aggregateId}, ${orgId},
          ${latestEvent.version}, ${JSON.stringify(latestEvent.payload)}, NOW()
        )
      `;

      this.stats.snapshotCount++;
      console.log(`[${this.serviceName}] Snapshot created: ${snapshotId} for ${aggregateType}:${aggregateId}`);
    } catch (error) {
      console.error(`[${this.serviceName}] Error creating snapshot:`, error);
      throw error;
    }
  }

  // Get Latest Snapshot
  async getLatestSnapshot(aggregateType: string, aggregateId: string, orgId: number): Promise<any> {
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
        payload: JSON.parse(row.payload),
        createdAt: new Date(row.created_at)
      };
    } catch (error) {
      console.error(`[${this.serviceName}] Error getting latest snapshot:`, error);
      throw error;
    }
  }

  // Replay Events
  async replayEvents(
    aggregateType: string, 
    aggregateId: string, 
    orgId: number,
    fromVersion?: number
  ): Promise<any> {
    try {
      // Get latest snapshot if available
      const snapshot = await this.getLatestSnapshot(aggregateType, aggregateId, orgId);
      
      let events: DomainEvent[];
      let currentState: any = {};

      if (snapshot && (!fromVersion || snapshot.version >= fromVersion)) {
        // Start from snapshot
        currentState = snapshot.payload;
        events = await this.getEventsForAggregate(aggregateType, aggregateId, orgId, snapshot.version + 1);
      } else {
        // Start from beginning
        events = await this.getEventsForAggregate(aggregateType, aggregateId, orgId, fromVersion);
      }

      // Replay events
      for (const event of events) {
        currentState = await this.applyEvent(currentState, event);
      }

      console.log(`[${this.serviceName}] Replayed ${events.length} events for ${aggregateType}:${aggregateId}`);
      return currentState;
    } catch (error) {
      console.error(`[${this.serviceName}] Error replaying events:`, error);
      throw error;
    }
  }

  // Apply Event to State
  private async applyEvent(currentState: any, event: DomainEvent): Promise<any> {
    // This is a simplified event application
    // In a real implementation, you would have specific event handlers
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

  // Check and Create Snapshot
  private async checkAndCreateSnapshot(aggregateType: string, aggregateId: string, orgId: number): Promise<void> {
    try {
      // Get event count for aggregate
      const result = await eventStoreDB.queryRow`
        SELECT COUNT(*) as count FROM events 
        WHERE aggregate_type = ${aggregateType} 
        AND aggregate_id = ${aggregateId} 
        AND org_id = ${orgId}
      `;

      const eventCount = result.count;
      
      if (eventCount % this.config.maxEventsPerSnapshot === 0) {
        await this.createSnapshot(aggregateType, aggregateId, orgId);
      }
    } catch (error) {
      console.error(`[${this.serviceName}] Error checking snapshot:`, error);
    }
  }

  // Update Statistics
  private updateStats(event: DomainEvent): void {
    this.stats.totalEvents++;
    
    const elapsed = (Date.now() - this.startTime) / 1000;
    this.stats.eventsPerSecond = this.stats.totalEvents / elapsed;
    
    this.stats.averageEventSize = (this.stats.averageEventSize + JSON.stringify(event).length) / 2;
  }

  // Get Event Store Statistics
  async getStats(): Promise<EventStoreStats> {
    try {
      const result = await eventStoreDB.queryRow`
        SELECT 
          COUNT(*) as totalEvents,
          COUNT(DISTINCT CONCAT(aggregate_type, ':', aggregate_id)) as aggregateCount
        FROM events
      `;

      const snapshotResult = await eventStoreDB.queryRow`
        SELECT COUNT(*) as snapshotCount FROM snapshots
      `;

      return {
        totalEvents: result.totalEvents,
        eventsPerSecond: this.stats.eventsPerSecond,
        aggregateCount: result.aggregateCount,
        snapshotCount: snapshotResult.snapshotCount,
        storageSize: this.stats.storageSize,
        averageEventSize: this.stats.averageEventSize
      };
    } catch (error) {
      console.error(`[${this.serviceName}] Error getting stats:`, error);
      return this.stats;
    }
  }

  // Cleanup Old Events
  async cleanupOldEvents(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      await eventStoreDB.exec`
        DELETE FROM events 
        WHERE timestamp < ${cutoffDate}
      `;

      console.log(`[${this.serviceName}] Cleaned up events older than ${this.config.retentionDays} days`);
    } catch (error) {
      console.error(`[${this.serviceName}] Error cleaning up old events:`, error);
      throw error;
    }
  }

  // Get Service Health
  async getHealth(): Promise<{
    service: string;
    version: string;
    status: 'healthy' | 'unhealthy';
    stats: EventStoreStats;
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

// Global event store instance
export const eventStore = new EventStore();
