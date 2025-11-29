import { SQLDatabase } from "encore.dev/storage/sqldb";

const eventStoreDB = new SQLDatabase("event_store", {
  migrations: "./event_store_migrations",
});

interface DomainEvent {
  aggregateId: string;
  eventType: string;
  eventVersion: number;
  eventData: any;
  metadata: any;
  timestamp: Date;
}

export class EventStore {
  async appendEvents(
    aggregateId: string,
    expectedVersion: number,
    events: DomainEvent[]
  ): Promise<void> {
    const tx = await eventStoreDB.begin();
    
    try {
      // Check current version (optimistic locking)
      const currentVersion = await tx.queryRow`
        SELECT COALESCE(MAX(version), 0) as version
        FROM events 
        WHERE aggregate_id = ${aggregateId}
      `;
      
      if (currentVersion.version !== expectedVersion) {
        throw new Error('Concurrency conflict');
      }
      
      // Insert events
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        await tx.exec`
          INSERT INTO events (
            aggregate_id, event_type, version, 
            event_data, metadata, timestamp
          ) VALUES (
            ${aggregateId}, 
            ${event.eventType}, 
            ${expectedVersion + i + 1},
            ${JSON.stringify(event.eventData)},
            ${JSON.stringify(event.metadata)},
            ${event.timestamp}
          )
        `;
      }
      
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }
  
  async loadEvents(
    aggregateId: string,
    fromVersion: number = 0
  ): Promise<DomainEvent[]> {
    const rows = await eventStoreDB.queryAll`
      SELECT event_type, version, event_data, metadata, timestamp
      FROM events
      WHERE aggregate_id = ${aggregateId} AND version > ${fromVersion}
      ORDER BY version ASC
    `;
    
    return rows.map(row => ({
      aggregateId,
      eventType: row.event_type,
      eventVersion: row.version,
      eventData: JSON.parse(row.event_data),
      metadata: JSON.parse(row.metadata),
      timestamp: row.timestamp,
    }));
  }

  async getEventStream(
    aggregateId: string,
    fromVersion: number = 0,
    limit: number = 100
  ): Promise<{
    events: DomainEvent[];
    hasMore: boolean;
    nextVersion: number;
  }> {
    const rows = await eventStoreDB.queryAll`
      SELECT event_type, version, event_data, metadata, timestamp
      FROM events
      WHERE aggregate_id = ${aggregateId} AND version > ${fromVersion}
      ORDER BY version ASC
      LIMIT ${limit + 1}
    `;
    
    const hasMore = rows.length > limit;
    const events = rows.slice(0, limit).map(row => ({
      aggregateId,
      eventType: row.event_type,
      eventVersion: row.version,
      eventData: JSON.parse(row.event_data),
      metadata: JSON.parse(row.metadata),
      timestamp: row.timestamp,
    }));
    
    const nextVersion = events.length > 0 ? events[events.length - 1].eventVersion : fromVersion;
    
    return {
      events,
      hasMore,
      nextVersion
    };
  }

  async getAggregateVersion(aggregateId: string): Promise<number> {
    const result = await eventStoreDB.queryRow`
      SELECT COALESCE(MAX(version), 0) as version
      FROM events 
      WHERE aggregate_id = ${aggregateId}
    `;
    
    return result?.version || 0;
  }

  async getEventsByType(
    eventType: string,
    fromTimestamp: Date,
    limit: number = 100
  ): Promise<DomainEvent[]> {
    const rows = await eventStoreDB.queryAll`
      SELECT aggregate_id, event_type, version, event_data, metadata, timestamp
      FROM events
      WHERE event_type = ${eventType} AND timestamp >= ${fromTimestamp}
      ORDER BY timestamp ASC
      LIMIT ${limit}
    `;
    
    return rows.map(row => ({
      aggregateId: row.aggregate_id,
      eventType: row.event_type,
      eventVersion: row.version,
      eventData: JSON.parse(row.event_data),
      metadata: JSON.parse(row.metadata),
      timestamp: row.timestamp,
    }));
  }
}

export const eventStore = new EventStore();
