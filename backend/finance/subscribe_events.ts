import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { FinanceEventPayload } from "./events";
import { financeDB } from "./db";

export interface SubscribeEventsRequest {
  lastEventId?: string;
}

export interface SubscribeEventsResponse {
  events: FinanceEventPayload[];
  lastEventId: string;
}

// Shared handler for subscribing to finance events
async function subscribeFinanceEventsHandler(req: SubscribeEventsRequest): Promise<SubscribeEventsResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw new Error("Authentication required");
  }

  // Deprecation guard: this legacy endpoint is disabled in production environments.
    // Set ENABLE_LEGACY_FINANCE_EVENTS=1 locally if you need it for debug.
    const allowLegacy = process.env.ENABLE_LEGACY_FINANCE_EVENTS === '1';
    const env = process.env.NODE_ENV || 'development';
    if (!allowLegacy && env !== 'development') {
      // Emulate 410 Gone semantics by throwing a descriptive error.
      // Frontend should not be calling this anymore; use /finance/realtime/subscribe instead.
      console.warn('[LegacyFinanceSubscribe] Blocked request to deprecated endpoint. Enable with ENABLE_LEGACY_FINANCE_EVENTS=1 for local debugging.');
      throw new Error('410 Gone: /finance/events/subscribe is deprecated. Use /finance/realtime/subscribe.');
    }

    // Simple polling implementation that checks for recent changes
    // This provides the real-time feel while the pub/sub system processes events in the background
    const events: FinanceEventPayload[] = [];
    const lastEventTime = req.lastEventId ? new Date(req.lastEventId) : new Date(Date.now() - 30000); // 30 seconds ago if no lastEventId
    
    try {
      // Check for recent transactions that might indicate changes
      const recentTransactions = await financeDB.queryAll`
        SELECT COUNT(*) as count FROM (
          SELECT id, created_at FROM expenses WHERE org_id = ${authData.orgId} AND created_at > ${lastEventTime}
          UNION ALL
          SELECT id, created_at FROM revenues WHERE org_id = ${authData.orgId} AND created_at > ${lastEventTime}
        ) as recent_transactions
      `;
      
      // If there are recent transactions, create a synthetic event
      if (recentTransactions[0]?.count > 0) {
        events.push({
          orgId: authData.orgId,
          eventType: 'expense_added', // Generic event type for recent changes
          entityId: 0,
          userId: parseInt(authData.userID),
          timestamp: new Date(),
          metadata: { recentCount: recentTransactions[0].count }
        });
      }
    } catch (error) {
      console.error('Error checking for recent transactions:', error);
    }
    
    // Simulate a small delay to match real subscription behavior
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      events,
      lastEventId: events.length > 0 ? events[events.length - 1].timestamp.toISOString() : req.lastEventId || '',
    };
  }

// LEGACY: Long-polling endpoint for frontend to receive events (keep for backward compatibility)
export const subscribeFinanceEvents = api<SubscribeEventsRequest, SubscribeEventsResponse>(
  {
    auth: true,
    expose: true,
    method: "GET",
    path: "/finance/events/subscribe",
  },
  subscribeFinanceEventsHandler
);

// V1: Long-polling endpoint for frontend to receive events
export const subscribeFinanceEventsV1 = api<SubscribeEventsRequest, SubscribeEventsResponse>(
  {
    auth: true,
    expose: true,
    method: "GET",
    path: "/v1/finance/events/subscribe",
  },
  subscribeFinanceEventsHandler
);
