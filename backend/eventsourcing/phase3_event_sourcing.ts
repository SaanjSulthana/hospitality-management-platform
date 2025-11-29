// 🚀 PHASE 3: EVENT SOURCING IMPLEMENTATION (Month 2)
// Target: Handle 1M+ organizations
// Implementation: Month 2

// ✅ FIX 1: Event Sourcing for Audit Trails
export class EventStore {
  private events = new Map<string, DomainEvent[]>();
  private snapshots = new Map<string, Snapshot>();
  private eventVersion = 0;

  async appendEvents(aggregateId: string, events: DomainEvent[]): Promise<void> {
    console.log(`[EventStore] Appending ${events.length} events for aggregate ${aggregateId}`);
    
    const existingEvents = this.events.get(aggregateId) || [];
    const currentVersion = existingEvents.length;
    
    // Check for concurrency conflicts
    if (events[0]?.version !== currentVersion) {
      throw new Error(`Concurrency conflict: expected version ${currentVersion}, got ${events[0]?.version}`);
    }
    
    // Append events with sequential versions
    events.forEach((event, index) => {
      event.version = currentVersion + index + 1;
      event.timestamp = new Date();
    });
    
    this.events.set(aggregateId, [...existingEvents, ...events]);
    this.eventVersion += events.length;
    
    console.log(`[EventStore] Successfully appended events for aggregate ${aggregateId}`);
  }

  async getEvents(aggregateId: string, fromVersion: number = 0): Promise<DomainEvent[]> {
    const events = this.events.get(aggregateId) || [];
    return events.filter(event => event.version > fromVersion);
  }

  async getSnapshot(aggregateId: string): Promise<Snapshot | null> {
    return this.snapshots.get(aggregateId) || null;
  }

  async createSnapshot(aggregateId: string, version: number, state: any): Promise<void> {
    console.log(`[EventStore] Creating snapshot for aggregate ${aggregateId} at version ${version}`);
    
    this.snapshots.set(aggregateId, {
      aggregateId,
      version,
      state,
      createdAt: new Date()
    });
  }

  async getAggregateState(aggregateId: string): Promise<any> {
    // Try to get snapshot first
    const snapshot = await this.getSnapshot(aggregateId);
    let fromVersion = 0;
    let state = {};
    
    if (snapshot) {
      state = snapshot.state;
      fromVersion = snapshot.version;
    }
    
    // Apply events after snapshot
    const events = await this.getEvents(aggregateId, fromVersion);
    
    // Replay events to get current state
    for (const event of events) {
      state = this.applyEvent(state, event);
    }
    
    return state;
  }

  private applyEvent(state: any, event: DomainEvent): any {
    // Apply event to state based on event type
    // 🔥 UPDATED: Use valid event types (revenue/expense specific)
    switch (event.eventType) {
      case 'transaction_created':
      case 'revenue_added':
      case 'expense_added':
        return { ...state, transaction: event.eventData };
      case 'transaction_approved':
      case 'revenue_approved':
      case 'expense_approved':
        return { ...state, status: 'approved', approvedAt: event.timestamp };
      case 'balance_updated':
      case 'cash_balance_updated':
        return { ...state, balance: event.eventData };
      default:
        return state;
    }
  }

  getStats() {
    return {
      totalEvents: this.eventVersion,
      totalAggregates: this.events.size,
      totalSnapshots: this.snapshots.size,
      avgEventsPerAggregate: this.eventVersion / this.events.size
    };
  }
}

interface DomainEvent {
  aggregateId: string;
  eventType: string;
  eventData: any;
  version: number;
  timestamp: Date;
}

interface Snapshot {
  aggregateId: string;
  version: number;
  state: any;
  createdAt: Date;
}

export const eventStore = new EventStore();

// ✅ FIX 2: Event Sourcing for Financial Transactions
export class FinancialEventSourcing {
  private eventStore: EventStore;
  private readModels = new Map<string, ReadModel>();

  constructor(eventStore: EventStore) {
    this.eventStore = eventStore;
  }

  async processTransactionEvent(event: DomainEvent): Promise<void> {
    console.log(`[FinancialEventSourcing] Processing transaction event: ${event.eventType}`);
    
    // Store event in event store
    await this.eventStore.appendEvents(event.aggregateId, [event]);
    
    // Update read models
    await this.updateReadModels(event);
    
    // Publish integration events
    await this.publishIntegrationEvents(event);
  }

  async processBalanceEvent(event: DomainEvent): Promise<void> {
    console.log(`[FinancialEventSourcing] Processing balance event: ${event.eventType}`);
    
    // Store event in event store
    await this.eventStore.appendEvents(event.aggregateId, [event]);
    
    // Update read models
    await this.updateReadModels(event);
    
    // Publish integration events
    await this.publishIntegrationEvents(event);
  }

  private async updateReadModels(event: DomainEvent): Promise<void> {
    // Update transaction read model
    if (event.eventType.startsWith('transaction_')) {
      await this.updateTransactionReadModel(event);
    }
    
    // Update balance read model
    if (event.eventType.startsWith('balance_')) {
      await this.updateBalanceReadModel(event);
    }
    
    // Update report read model
    await this.updateReportReadModel(event);
  }

  private async updateTransactionReadModel(event: DomainEvent): Promise<void> {
    const readModel = this.readModels.get('transactions') || {
      name: 'transactions',
      data: new Map(),
      lastUpdated: new Date()
    };
    
    // Update transaction data
    readModel.data.set(event.aggregateId, {
      ...readModel.data.get(event.aggregateId),
      ...event.eventData,
      lastEvent: event.eventType,
      lastUpdated: event.timestamp
    });
    
    readModel.lastUpdated = new Date();
    this.readModels.set('transactions', readModel);
  }

  private async updateBalanceReadModel(event: DomainEvent): Promise<void> {
    const readModel = this.readModels.get('balances') || {
      name: 'balances',
      data: new Map(),
      lastUpdated: new Date()
    };
    
    // Update balance data
    readModel.data.set(event.aggregateId, {
      ...readModel.data.get(event.aggregateId),
      ...event.eventData,
      lastEvent: event.eventType,
      lastUpdated: event.timestamp
    });
    
    readModel.lastUpdated = new Date();
    this.readModels.set('balances', readModel);
  }

  private async updateReportReadModel(event: DomainEvent): Promise<void> {
    const readModel = this.readModels.get('reports') || {
      name: 'reports',
      data: new Map(),
      lastUpdated: new Date()
    };
    
    // Update report data
    readModel.data.set(event.aggregateId, {
      ...readModel.data.get(event.aggregateId),
      ...event.eventData,
      lastEvent: event.eventType,
      lastUpdated: event.timestamp
    });
    
    readModel.lastUpdated = new Date();
    this.readModels.set('reports', readModel);
  }

  private async publishIntegrationEvents(event: DomainEvent): Promise<void> {
    console.log(`[FinancialEventSourcing] Publishing integration event: ${event.eventType}`);
    
    // Simulate integration event publishing
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  getReadModel(name: string): ReadModel | null {
    return this.readModels.get(name) || null;
  }

  getAllReadModels(): ReadModel[] {
    return Array.from(this.readModels.values());
  }
}

interface ReadModel {
  name: string;
  data: Map<string, any>;
  lastUpdated: Date;
}

export const financialEventSourcing = new FinancialEventSourcing(eventStore);

// ✅ FIX 3: Event Sourcing for Audit Trails
export class AuditTrailService {
  private auditEvents = new Map<string, AuditEvent[]>();
  private auditIndex = new Map<string, string[]>(); // Index by entity type and ID

  async recordAuditEvent(event: AuditEvent): Promise<void> {
    console.log(`[AuditTrailService] Recording audit event: ${event.eventType}`);
    
    // Store audit event
    const entityKey = `${event.entityType}:${event.entityId}`;
    const existingEvents = this.auditEvents.get(entityKey) || [];
    this.auditEvents.set(entityKey, [...existingEvents, event]);
    
    // Update index
    const indexKey = `${event.entityType}:${event.userId}`;
    const indexedEvents = this.auditIndex.get(indexKey) || [];
    this.auditIndex.set(indexKey, [...indexedEvents, entityKey]);
    
    console.log(`[AuditTrailService] Successfully recorded audit event for ${entityKey}`);
  }

  async getAuditTrail(entityType: string, entityId: string): Promise<AuditEvent[]> {
    const entityKey = `${entityType}:${entityId}`;
    return this.auditEvents.get(entityKey) || [];
  }

  async getAuditTrailByUser(userId: string, entityType?: string): Promise<AuditEvent[]> {
    const indexKey = entityType ? `${entityType}:${userId}` : `*:${userId}`;
    const indexedEvents = this.auditIndex.get(indexKey) || [];
    
    const allEvents: AuditEvent[] = [];
    for (const entityKey of indexedEvents) {
      const events = this.auditEvents.get(entityKey) || [];
      allEvents.push(...events);
    }
    
    return allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async getAuditTrailByDateRange(startDate: Date, endDate: Date): Promise<AuditEvent[]> {
    const allEvents: AuditEvent[] = [];
    
    for (const events of this.auditEvents.values()) {
      for (const event of events) {
        if (event.timestamp >= startDate && event.timestamp <= endDate) {
          allEvents.push(event);
        }
      }
    }
    
    return allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  getAuditStats() {
    const totalEvents = Array.from(this.auditEvents.values())
      .reduce((sum, events) => sum + events.length, 0);
    
    const uniqueEntities = this.auditEvents.size;
    const uniqueUsers = new Set(
      Array.from(this.auditEvents.values())
        .flat()
        .map(event => event.userId)
    ).size;
    
    return {
      totalEvents,
      uniqueEntities,
      uniqueUsers,
      avgEventsPerEntity: totalEvents / uniqueEntities
    };
  }
}

interface AuditEvent {
  eventType: string;
  entityType: string;
  entityId: string;
  userId: string;
  timestamp: Date;
  data: any;
  ipAddress?: string;
  userAgent?: string;
}

export const auditTrailService = new AuditTrailService();

// ✅ FIX 4: Event Sourcing Performance Monitoring
export class EventSourcingMonitor {
  private metrics = {
    eventsProcessed: 0,
    eventsStored: 0,
    readModelsUpdated: 0,
    snapshotsCreated: 0,
    auditEventsRecorded: 0,
    avgProcessingTime: 0,
    maxProcessingTime: 0
  };

  private processingTimes: number[] = [];

  recordEventProcessed(processingTime: number) {
    this.metrics.eventsProcessed++;
    this.processingTimes.push(processingTime);
    
    // Keep only last 1000 processing times
    if (this.processingTimes.length > 1000) {
      this.processingTimes.shift();
    }
    
    this.metrics.avgProcessingTime = this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
    this.metrics.maxProcessingTime = Math.max(this.metrics.maxProcessingTime, processingTime);
  }

  recordEventStored() {
    this.metrics.eventsStored++;
  }

  recordReadModelUpdated() {
    this.metrics.readModelsUpdated++;
  }

  recordSnapshotCreated() {
    this.metrics.snapshotsCreated++;
  }

  recordAuditEvent() {
    this.metrics.auditEventsRecorded++;
  }

  getMetrics() {
    return {
      ...this.metrics,
      eventsPerSecond: this.metrics.eventsProcessed / (Date.now() - this.getStartTime()) * 1000,
      readModelUpdateRate: this.metrics.readModelsUpdated / this.metrics.eventsProcessed,
      snapshotCreationRate: this.metrics.snapshotsCreated / this.metrics.eventsProcessed
    };
  }

  private getStartTime(): number {
    // In production, this would be the actual start time
    return Date.now() - 3600000; // 1 hour ago
  }

  checkAlerts() {
    const avgProcessingTime = this.metrics.avgProcessingTime;
    const eventsPerSecond = this.metrics.eventsProcessed / (Date.now() - this.getStartTime()) * 1000;
    
    if (avgProcessingTime > 1000) { // 1 second average
      console.warn(`[EventSourcingMonitor] High average processing time: ${avgProcessingTime.toFixed(2)}ms`);
    }
    
    if (eventsPerSecond > 100) { // 100 events per second
      console.warn(`[EventSourcingMonitor] High event processing rate: ${eventsPerSecond.toFixed(2)} events/sec`);
    }
  }
}

export const eventSourcingMonitor = new EventSourcingMonitor();

// ✅ FIX 5: Event Sourcing Health Check
export class EventSourcingHealthCheck {
  private healthStatus = {
    eventStore: 'healthy',
    readModels: 'healthy',
    auditTrail: 'healthy',
    lastCheck: new Date()
  };

  async checkHealth(): Promise<boolean> {
    try {
      // Check event store health
      const eventStoreStats = eventStore.getStats();
      if (eventStoreStats.totalEvents === 0) {
        this.healthStatus.eventStore = 'warning';
      } else {
        this.healthStatus.eventStore = 'healthy';
      }
      
      // Check read models health
      const readModels = financialEventSourcing.getAllReadModels();
      if (readModels.length === 0) {
        this.healthStatus.readModels = 'warning';
      } else {
        this.healthStatus.readModels = 'healthy';
      }
      
      // Check audit trail health
      const auditStats = auditTrailService.getAuditStats();
      if (auditStats.totalEvents === 0) {
        this.healthStatus.auditTrail = 'warning';
      } else {
        this.healthStatus.auditTrail = 'healthy';
      }
      
      this.healthStatus.lastCheck = new Date();
      
      return Object.values(this.healthStatus).every(status => status === 'healthy');
    } catch (error) {
      console.error('[EventSourcingHealthCheck] Health check failed:', error);
      return false;
    }
  }

  getHealthStatus() {
    return { ...this.healthStatus };
  }

  isHealthy(): boolean {
    return Object.values(this.healthStatus).every(status => status === 'healthy');
  }
}

export const eventSourcingHealthCheck = new EventSourcingHealthCheck();
