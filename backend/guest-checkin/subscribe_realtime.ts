/**
 * Guest Check-In Realtime Subscribe Endpoint
 * 
 * Long-poll endpoint for real-time guest check-in updates
 * Returns immediately if events exist; otherwise waits up to 25s
 */

import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { subscribe } from './realtime_buffer';
import type { GuestEventPayload } from './guest-checkin-events';

interface SubscribeRequest {
  propertyId?: number;
}

interface SubscribeResponse {
  events: Array<{
    eventType: string;
    timestamp: string;
    entityId: number;
    entityType: string;
    metadata?: Record<string, unknown>;
  }>;
  lastEventId: string;
}

/**
 * Long-poll subscribe endpoint
 * Returns immediately if events exist; otherwise waits up to 25s
 */
export const subscribeGuestCheckinRealtime = api(
  { expose: true, method: "GET", path: "/v1/guest-checkin/realtime/subscribe-v3", auth: true },
  async (req: SubscribeRequest): Promise<SubscribeResponse> => {
    const startTime = Date.now();
    const auth = getAuthData();
    
    if (!auth) {
      throw APIError.unauthenticated("Authentication required");
    }
    
    const orgId = Number(auth.orgId);
    const { propertyId } = req;
    
    // Extract request context for logging
    const origin = (req as any).headers?.origin || 'unknown';
    const ua = (req as any).headers?.['user-agent'] || 'unknown';
    const uaTruncated = ua.substring(0, 50);
    
    console.log(
      `[GuestRealtimeSubscribe][started] orgId=${orgId} userId=${auth.userID} ` +
      `propertyId=${propertyId || 'all'} origin=${origin}`
    );
    
    try {
      // Subscribe (drains or waits)
      const events = await subscribe(orgId, propertyId);
      
      const durationMs = Date.now() - startTime;
      
      // Context-only completion log
      console.log(
        `[GuestRealtimeSubscribe][completed] orgId=${orgId} userId=${auth.userID} ` +
        `propertyId=${propertyId || 'all'} events=${events.length} durationMs=${durationMs} ` +
        `origin=${origin} ua="${uaTruncated}"`
      );
      
      // Convert events to response format
      const responseEvents = events.map(event => ({
        eventType: event.eventType,
        timestamp: event.timestamp.toISOString(),
        entityId: event.entityId,
        entityType: event.entityType,
        metadata: event.metadata as Record<string, unknown> | undefined,
      }));
      
      const lastEventId = events.length > 0 
        ? events[events.length - 1].timestamp.toISOString()
        : new Date().toISOString();
      
      return {
        events: responseEvents,
        lastEventId,
      };
      
    } catch (error) {
      const durationMs = Date.now() - startTime;
      
      console.error(
        `[GuestRealtimeSubscribe][failure] orgId=${orgId} userId=${auth.userID} ` +
        `propertyId=${propertyId || 'all'} durationMs=${durationMs} ` +
        `origin=${origin} ua="${uaTruncated}" error=${error}`
      );
      
      throw APIError.internal("Failed to subscribe to realtime events");
    }
  }
);

