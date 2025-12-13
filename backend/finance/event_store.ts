import { financeDB } from "./db";
import { FinanceEventPayload } from "./events";
import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { getRealtimeBufferMetrics } from "./realtime_buffer";

export async function persistEvent(event: FinanceEventPayload): Promise<void> {
  await financeDB.exec`
    INSERT INTO finance_event_store (
      event_id, event_version, event_type,
      org_id, property_id, user_id,
      entity_id, entity_type, event_payload
    ) VALUES (
      ${event.eventId}, ${event.eventVersion}, ${event.eventType},
      ${event.orgId}, ${event.propertyId}, ${event.userId},
      ${event.entityId}, ${event.entityType}, ${JSON.stringify(event.metadata)}
    )
  `;
}

export interface EventHistoryRequest {
  entityType?: string;
  entityId?: number;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export interface EventHistoryResponse {
  events: any[];
  total: number;
}

// Shared handler for getting event history
async function getEventHistoryHandler(req: EventHistoryRequest): Promise<EventHistoryResponse> {
  const authData = getAuthData();
  if (!authData) throw APIError.unauthenticated("Authentication required");
  requireRole("ADMIN", "MANAGER")(authData);

  const { entityType, entityId, fromDate, toDate, limit = 100 } = req;
    
    // Build dynamic query with proper Encore pattern
    let query = `
      SELECT 
        event_id, event_version, event_type,
        org_id, property_id, user_id,
        entity_id, entity_type, event_payload,
        created_at
      FROM finance_event_store
      WHERE org_id = $1
    `;
    const params: any[] = [authData.orgId];
    let paramIndex = 2;
    
    if (entityType) {
      query += ` AND entity_type = $${paramIndex}`;
      params.push(entityType);
      paramIndex++;
    }
    
    if (entityId) {
      query += ` AND entity_id = $${paramIndex}`;
      params.push(entityId);
      paramIndex++;
    }
    
    if (fromDate) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(fromDate);
      paramIndex++;
    }
    
    if (toDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(toDate);
      paramIndex++;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);
    
    const events = await financeDB.rawQueryAll(query, ...params);
    
    return {
      events: events.map(e => ({
        ...e,
        event_payload: JSON.parse(e.event_payload)
      })),
      total: events.length
    };
  }

// LEGACY: Get event history (keep for backward compatibility)
export const getEventHistory = api<EventHistoryRequest, EventHistoryResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/events/history" },
  getEventHistoryHandler
);

// V1: Get event history
export const getEventHistoryV1 = api<EventHistoryRequest, EventHistoryResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/finance/events/history" },
  getEventHistoryHandler
);

// Response type for event metrics
interface EventMetricsResponse {
  metrics: Array<{ event_type: string; count: number; hour: string }>;
  realtime: {
    buffers: Array<{ orgId: number; size: number }>;
    totals: { orgs: number; totalDropped: number };
    publishedByType: Record<string, number>;
    deliveredByType: Record<string, number>;
    maxBufferSize: number;
    eventTtlMs: number;
  };
  timestamp: string;
}

// Shared handler for getting event metrics
async function getEventMetricsHandler(): Promise<EventMetricsResponse> {
  const authData = getAuthData();
  if (!authData) throw APIError.unauthenticated("Authentication required");
  requireRole("ADMIN")(authData);
  
  let metrics: Array<{ event_type: string; count: number; hour: string }> = [];
  
  try {
    const rows = await financeDB.queryAll`
      SELECT 
        event_type,
        COUNT(*)::int as count,
        DATE_TRUNC('hour', created_at)::text as hour
      FROM finance_event_store
      WHERE org_id = ${authData.orgId}
        AND created_at > NOW() - INTERVAL '24 hours'
      GROUP BY event_type, hour
      ORDER BY hour DESC
    `;
    
    // Ensure proper serialization
    metrics = rows.map((r: any) => ({
      event_type: String(r.event_type || ''),
      count: Number(r.count) || 0,
      hour: String(r.hour || ''),
    }));
  } catch (dbErr) {
    console.error('[EventMetrics] Database query error:', dbErr);
    // Return empty metrics on DB error rather than failing completely
  }

  // Augment with realtime buffer metrics for visibility
  const realtime = getRealtimeBufferMetrics();

  return { 
    metrics, 
    realtime, 
    timestamp: new Date().toISOString(),
  };
}

// LEGACY: Get event metrics (keep for backward compatibility)
export const getEventMetrics = api<void, EventMetricsResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/events/metrics" },
  getEventMetricsHandler
);

// V1: Get event metrics
export const getEventMetricsV1 = api<void, EventMetricsResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/finance/events/metrics" },
  getEventMetricsHandler
);

