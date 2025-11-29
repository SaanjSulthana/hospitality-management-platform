// Events Service - Phase 3 Advanced Scaling
// Target: Centralized event processing microservice for 1M+ organizations
// 🔥 CRITICAL: Now enforces strict type safety for all events

import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeEvents, FinanceEventPayload } from "../../finance/events";
import { realtimeUpdates } from "../../finance/events";
import { 
  buildValidatedEvent, 
  EventBuilderInput, 
  eventValidationMonitor,
  VALID_EVENT_TYPES 
} from "../../finance/event_validator";

// Events Service Interfaces
export interface EventServiceRequest {
  eventType: string;  // Will be validated against VALID_EVENT_TYPES
  orgId: number;
  propertyId?: number;
  userId?: number;  // Optional, will use auth if not provided
  entityId?: string | number;
  entityType?: 'expense' | 'revenue' | 'daily_approval' | 'cash_balance';
  metadata?: Partial<FinanceEventPayload['metadata']>;
}

export interface EventServiceResponse {
  success: boolean;
  eventId: string;
  message: string;
  processingTime: number;
}

export interface EventSubscriptionRequest {
  eventTypes: string[];
  orgId: number;
  propertyId?: number;
  callbackUrl?: string;
}

export interface EventStats {
  totalEvents: number;
  eventsPerSecond: number;
  eventTypes: { [key: string]: number };
  processingTime: number;
  errors: number;
}

// Events Service Class
export class EventsService {
  private serviceName = 'EventsService';
  private version = '1.0.0';
  private dependencies: string[] = ['FinanceEvents', 'RealtimeUpdates', 'EventStore'];
  private eventStats = {
    totalEvents: 0,
    eventsPerSecond: 0,
    eventTypes: {} as { [key: string]: number },
    processingTime: 0,
    errors: 0
  };
  private startTime = Date.now();

  constructor() {
    console.log(`[${this.serviceName}] Initialized v${this.version}`);
  }

  // Publish Event
  async publishEvent(request: EventServiceRequest): Promise<EventServiceResponse> {
    const startTime = Date.now();

    try {
      // 🔥 CRITICAL: Get authenticated user
      const authData = getAuthData();
      if (!authData) {
        throw APIError.unauthenticated("Authentication required to publish events");
      }

      // 🔥 CRITICAL: Build and validate event using centralized validator
      const eventPayload = buildValidatedEvent(
        {
          eventType: request.eventType,
          orgId: request.orgId,
          propertyId: request.propertyId,
          userId: request.userId,
          entityId: request.entityId,
          entityType: request.entityType,
          metadata: request.metadata
        },
        parseInt(authData.userID)
      );

      // Publish to finance events topic with validated payload
      await financeEvents.publish(eventPayload);

      // Record validation success
      eventValidationMonitor.recordValidation(eventPayload.eventType, true);

      // Publish real-time update
      await realtimeUpdates.publish({
        orgId: eventPayload.orgId,
        propertyId: eventPayload.propertyId,
        updateType: this.getUpdateType(eventPayload.eventType),
        timestamp: new Date(),
        eventType: eventPayload.eventType,
        entityId: eventPayload.entityId
      });

      // Update statistics
      this.updateEventStats(eventPayload.eventType, Date.now() - startTime);

      const processingTime = Date.now() - startTime;
      console.log(
        `[${this.serviceName}] ✅ Event published: ${eventPayload.eventId} ` +
        `(${eventPayload.eventType}) in ${processingTime}ms`
      );

      return {
        success: true,
        eventId: eventPayload.eventId,
        message: 'Event published successfully',
        processingTime
      };
    } catch (error) {
      this.eventStats.errors++;
      
      // Record validation failure
      eventValidationMonitor.recordValidation(request.eventType, false, error.code || 'unknown');
      
      console.error(`[${this.serviceName}] ❌ Error publishing event:`, error);
      
      // Re-throw API errors directly (they have proper error codes)
      if (error.code) {
        throw error;
      }
      
      throw APIError.internal(`Failed to publish event: ${error.message}`);
    }
  }

  // Batch Publish Events
  async batchPublishEvents(events: EventServiceRequest[]): Promise<EventServiceResponse> {
    const startTime = Date.now();

    try {
      // 🔥 CRITICAL: Get authenticated user
      const authData = getAuthData();
      if (!authData) {
        throw APIError.unauthenticated("Authentication required to publish events");
      }

      // Validate batch size for 1M org scale
      if (events.length > 1000) {
        throw APIError.invalidArgument(
          `Batch size too large: ${events.length}. Maximum: 1000 events per batch.`
        );
      }

      const eventIds: string[] = [];
      const validatedPayloads: FinanceEventPayload[] = [];

      // 🔥 CRITICAL: Validate all events first before publishing any
      for (const event of events) {
        try {
          const eventPayload = buildValidatedEvent(
            {
              eventType: event.eventType,
              orgId: event.orgId,
              propertyId: event.propertyId,
              userId: event.userId,
              entityId: event.entityId,
              entityType: event.entityType,
              metadata: event.metadata
            },
            parseInt(authData.userID)
          );
          
          validatedPayloads.push(eventPayload);
          eventIds.push(eventPayload.eventId);
          eventValidationMonitor.recordValidation(eventPayload.eventType, true);
        } catch (error) {
          eventValidationMonitor.recordValidation(event.eventType, false, error.code || 'unknown');
          throw APIError.invalidArgument(
            `Event validation failed for event type '${event.eventType}': ${error.message}`
          );
        }
      }

      // Publish all validated events in parallel
      const publishPromises = validatedPayloads.map(async (eventPayload) => {
        await financeEvents.publish(eventPayload);
      });

      await Promise.all(publishPromises);

      const processingTime = Date.now() - startTime;
      console.log(
        `[${this.serviceName}] ✅ Batch published ${events.length} events in ${processingTime}ms`
      );

      return {
        success: true,
        eventId: eventIds.join(','),
        message: `Batch published ${events.length} events successfully`,
        processingTime
      };
    } catch (error) {
      this.eventStats.errors++;
      console.error(`[${this.serviceName}] ❌ Error batch publishing events:`, error);
      
      // Re-throw API errors directly
      if (error.code) {
        throw error;
      }
      
      throw APIError.internal(`Failed to batch publish events: ${error.message}`);
    }
  }

  // Get Event Statistics
  async getEventStats(): Promise<EventStats> {
    const elapsed = (Date.now() - this.startTime) / 1000;
    this.eventStats.eventsPerSecond = this.eventStats.totalEvents / elapsed;

    return {
      totalEvents: this.eventStats.totalEvents,
      eventsPerSecond: this.eventStats.eventsPerSecond,
      eventTypes: { ...this.eventStats.eventTypes },
      processingTime: this.eventStats.processingTime,
      errors: this.eventStats.errors
    };
  }

  // Get Service Health
  async getHealth(): Promise<{
    service: string;
    version: string;
    status: 'healthy' | 'unhealthy';
    dependencies: any[];
    timestamp: string;
  }> {
    const dependencies = await this.checkDependencies();
    const healthy = dependencies.every(dep => dep.status === 'healthy');

    return {
      service: this.serviceName,
      version: this.version,
      status: healthy ? 'healthy' : 'unhealthy',
      dependencies,
      timestamp: new Date().toISOString()
    };
  }

  // Update Event Statistics
  private updateEventStats(eventType: string, processingTime: number): void {
    this.eventStats.totalEvents++;
    this.eventStats.eventTypes[eventType] = (this.eventStats.eventTypes[eventType] || 0) + 1;
    this.eventStats.processingTime = (this.eventStats.processingTime + processingTime) / 2;
  }

  // Get Update Type from Event Type
  private getUpdateType(eventType: string): string {
    if (eventType.includes('revenue') || eventType.includes('expense')) {
      return 'transaction';
    } else if (eventType.includes('approval') || eventType.includes('rejected')) {
      return 'approval';
    } else if (eventType.includes('deleted')) {
      return 'deletion';
    } else if (eventType.includes('balance')) {
      return 'balance';
    } else {
      return 'general';
    }
  }

  // Check Dependencies
  private async checkDependencies(): Promise<any[]> {
    const dependencies = [];

    // Check Finance Events
    try {
      // Simulate finance events check
      dependencies.push({
        name: 'FinanceEvents',
        status: 'healthy',
        responseTime: Date.now()
      });
    } catch (error) {
      dependencies.push({
        name: 'FinanceEvents',
        status: 'unhealthy',
        error: error.message
      });
    }

    // Check Realtime Updates
    try {
      // Simulate realtime updates check
      dependencies.push({
        name: 'RealtimeUpdates',
        status: 'healthy',
        responseTime: Date.now()
      });
    } catch (error) {
      dependencies.push({
        name: 'RealtimeUpdates',
        status: 'unhealthy',
        error: error.message
      });
    }

    // Check Event Store
    try {
      // Simulate event store check
      dependencies.push({
        name: 'EventStore',
        status: 'healthy',
        responseTime: Date.now()
      });
    } catch (error) {
      dependencies.push({
        name: 'EventStore',
        status: 'unhealthy',
        error: error.message
      });
    }

    return dependencies;
  }
}

// Global events service instance
export const eventsService = new EventsService();

// API Endpoints
export const publishEvent = api<EventServiceRequest, EventServiceResponse>(
  { auth: true, expose: true, method: "POST", path: "/events/publish" },
  async (req) => {
    return await eventsService.publishEvent(req);
  }
);

export const batchPublishEvents = api<{events: EventServiceRequest[]}, EventServiceResponse>(
  { auth: true, expose: true, method: "POST", path: "/events/batch-publish" },
  async (req) => {
    return await eventsService.batchPublishEvents(req.events);
  }
);

export const getEventStats = api<{}, EventStats>(
  { auth: true, expose: true, method: "GET", path: "/events/stats" },
  async () => {
    return await eventsService.getEventStats();
  }
);

export const getEventsHealth = api<{}, { status: string; timestamp: string; uptime: number }>(
  { auth: false, expose: true, method: "GET", path: "/events/health" },
  async () => {
    return await eventsService.getHealth();
  }
);
