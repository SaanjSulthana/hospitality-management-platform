<!-- e30156a9-9a24-47e2-846c-5460d32e382e 30b25a07-a98f-4048-849d-e2999d6f72e8 -->
# Comprehensive Encore Pub/Sub Implementation - Correct Patterns

## 🚨 Critical Status & Priority Actions

**Current Event System Status:**
- ✅ **Expenses** have events BUT use **OLD schema** (missing `eventId`, `propertyId`, `affectedReportDates`)
- ❌ **Revenues** missing events for `update`/`delete`/`approve` operations
- ❌ **No cache invalidation metadata** in ANY existing events
- ❌ **Cash balances** have no event publishing

**Priority Actions (MUST DO FIRST):**
1. 🔴 **CRITICAL:** Update all 4 existing expense event publishers to NEW schema (Section 3.0)
2. 🔴 **CRITICAL:** Add missing revenue event publishers with NEW schema (Sections 3.1-3.3)
3. 🟡 **HIGH:** Add cash balance event publishers (Section 3.4)
4. 🟢 **MEDIUM:** Deploy event infrastructure and cache (Sections 1-2, 4-5)

## Research Summary: Encore Patterns in Codebase

**Pub/Sub:** `new Topic<T>("name", {deliveryGuarantee})` + `new Subscription(topic, "name", {handler})`

**DB Queries:** Template literals for static, `rawQueryAll(sql, ...params)` for dynamic with `$1, $2...`

**APIs:** `export const fn = api<Req,Res>({auth, expose, method, path}, handler)`

## 1. Enhanced Event Infrastructure

### 1.1 Update `backend/finance/events.ts`

**Current:** Basic payload, missing event types for revenue ops

**Enhanced:**

```typescript
import { Topic } from "encore.dev/pubsub";

export interface FinanceEventPayload {
  eventId: string; // UUID
  eventVersion: 'v1';
  eventType: 
    | 'expense_added' | 'expense_updated' | 'expense_deleted' 
    | 'expense_approved' | 'expense_rejected'
    | 'revenue_added' | 'revenue_updated' | 'revenue_deleted'
    | 'revenue_approved' | 'revenue_rejected'
    | 'daily_approval_granted' | 'cash_balance_updated';
  
  orgId: number;
  propertyId: number;
  userId: number;
  timestamp: Date;
  entityId: number;
  entityType: 'expense' | 'revenue' | 'daily_approval' | 'cash_balance';
  
  metadata: {
    previousStatus?: string;
    newStatus?: string;
    amountCents?: number;
    currency?: string;
    transactionDate?: string;
    paymentMode?: 'cash' | 'bank';
    category?: string;
    affectedReportDates?: string[]; // For cache invalidation
  };
}

export const financeEvents = new Topic<FinanceEventPayload>("finance-events", {
  deliveryGuarantee: "at-least-once",
});

export interface RealtimeUpdatePayload {
  orgId: number;
  propertyId: number;
  updateType: 'transaction' | 'approval' | 'balance';
  timestamp: Date;
}

export const realtimeUpdates = new Topic<RealtimeUpdatePayload>("realtime-updates", {
  deliveryGuarantee: "at-least-once",
});
```

### 1.2 Update `backend/finance/finance_events_handler.ts`

**Current:** Just logs events

**Enhanced with event persistence:**

```typescript
import { Subscription } from "encore.dev/pubsub";
import { financeEvents, FinanceEventPayload } from "./events";
import { persistEvent } from "./event_store";

export const financeEventsHandler = new Subscription(
  financeEvents,
  "finance-events-handler",
  {
    handler: async (event: FinanceEventPayload) => {
      console.log('[Finance] Event received:', {
        eventId: event.eventId,
        eventType: event.eventType,
        orgId: event.orgId
      });
      
      try {
        // Persist to event store for audit trail
        await persistEvent(event);
        
        console.log('[Finance] Event persisted:', event.eventId);
      } catch (error) {
        console.error('[Finance] Error persisting event:', error);
        // Let Encore retry
        throw error;
      }
    },
    ackDeadline: "30s",
    maxConcurrency: 20
  }
);
```

## 2. Event Sourcing & Audit Trail

### 2.1 Migration: `backend/finance/migrations/13_create_event_store.up.sql`

**⚠️ IMPORTANT:** Migration number is **13** because **12 already exists** (`12_enhance_daily_balances.up.sql`)

```sql
CREATE TABLE IF NOT EXISTS finance_event_store (
  id SERIAL PRIMARY KEY,
  event_id UUID NOT NULL UNIQUE,
  event_version VARCHAR(10) NOT NULL DEFAULT 'v1',
  event_type VARCHAR(50) NOT NULL,
  
  org_id INTEGER NOT NULL,
  property_id INTEGER,
  user_id INTEGER NOT NULL,
  
  entity_id INTEGER NOT NULL,
  entity_type VARCHAR(30) NOT NULL,
  event_payload JSONB NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  correlation_id UUID,
  
  CONSTRAINT fk_event_store_org FOREIGN KEY (org_id) REFERENCES organizations(id),
  CONSTRAINT fk_event_store_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_event_store_org_property ON finance_event_store(org_id, property_id);
CREATE INDEX idx_event_store_entity ON finance_event_store(entity_type, entity_id);
CREATE INDEX idx_event_store_type ON finance_event_store(event_type);
CREATE INDEX idx_event_store_timestamp ON finance_event_store(created_at DESC);
```

### 2.2 Create `backend/finance/event_store.ts`

```typescript
import { financeDB } from "./db";
import { FinanceEventPayload } from "./events";
import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";

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

export const getEventHistory = api<EventHistoryRequest, EventHistoryResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/events/history" },
  async (req) => {
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
);
```

## 3. 🔴 CRITICAL: Complete Event Publishing Coverage

**⚠️ CRITICAL DISCOVERY:** Expense operations already publish events but use **OLD schema** (missing eventId, propertyId, affectedReportDates). They MUST be upgraded to match the new schema for cache invalidation to work.

### 3.0 🔴 UPDATE All Existing Expense Events to NEW Schema

**This is MANDATORY before cache invalidation will work!**

**Files that MUST be updated:**

1. `backend/finance/add_expense.ts` (around line 196)
2. `backend/finance/update_expense.ts` (around line 307)
3. `backend/finance/delete_expense.ts` (around line 172)
4. `backend/finance/approve_expense_by_id.ts` (around line 198)

**Current OLD format (BROKEN - no cache invalidation):**

```typescript
await financeEvents.publish({
  orgId: authData.orgId,
  eventType: 'expense_added',
  entityId: expenseRow.id,
  userId: authData.userID,
  timestamp: new Date(),
});
```

**NEW format (REQUIRED for cache invalidation):**

```typescript
import { v4 as uuidv4 } from 'uuid';

// At the top of file, add import:
// import { financeEvents } from "./events";

// Replace OLD publish with this:
await financeEvents.publish({
  eventId: uuidv4(),
  eventVersion: 'v1',
  eventType: 'expense_added', // or 'expense_updated', 'expense_deleted', etc.
  orgId: authData.orgId,
  propertyId: expenseRow.property_id,
  userId: parseInt(authData.userID),
  timestamp: new Date(),
  entityId: expenseRow.id,
  entityType: 'expense',
  metadata: {
    amountCents: expenseRow.amount_cents,
    currency: expenseRow.currency,
    transactionDate: expenseRow.expense_date.toISOString().split('T')[0],
    paymentMode: expenseRow.payment_mode,
    category: expenseRow.category,
    affectedReportDates: [expenseRow.expense_date.toISOString().split('T')[0]]
  }
});
```

**Specific updates needed for each file:**

#### 3.0.1 `backend/finance/add_expense.ts` (line ~196)

```typescript
// After successful expense insert
await financeEvents.publish({
  eventId: uuidv4(),
  eventVersion: 'v1',
  eventType: 'expense_added',
  orgId: authData.orgId,
  propertyId: expenseRow.property_id,
  userId: parseInt(authData.userID),
  timestamp: new Date(),
  entityId: expenseRow.id,
  entityType: 'expense',
  metadata: {
    amountCents: expenseRow.amount_cents,
    currency: expenseRow.currency,
    transactionDate: expenseRow.expense_date.toISOString().split('T')[0],
    paymentMode: expenseRow.payment_mode,
    category: expenseRow.category,
    affectedReportDates: [expenseRow.expense_date.toISOString().split('T')[0]]
  }
});
```

#### 3.0.2 `backend/finance/update_expense.ts` (line ~307)

```typescript
// After successful expense update
await financeEvents.publish({
  eventId: uuidv4(),
  eventVersion: 'v1',
  eventType: 'expense_updated',
  orgId: authData.orgId,
  propertyId: updatedExpense.property_id,
  userId: parseInt(authData.userID),
  timestamp: new Date(),
  entityId: updatedExpense.id,
  entityType: 'expense',
  metadata: {
    amountCents: updatedExpense.amount_cents,
    currency: updatedExpense.currency,
    transactionDate: updatedExpense.expense_date.toISOString().split('T')[0],
    paymentMode: updatedExpense.payment_mode,
    category: updatedExpense.category,
    affectedReportDates: [
      // Include both old and new dates if changed
      originalExpense.expense_date.toISOString().split('T')[0],
      updatedExpense.expense_date.toISOString().split('T')[0]
    ].filter((v, i, a) => a.indexOf(v) === i) // deduplicate
  }
});
```

#### 3.0.3 `backend/finance/delete_expense.ts` (line ~172)

```typescript
// Store expense info BEFORE deletion
const expenseForEvent = { ...expenseRow };

// ... deletion logic ...

// After successful deletion
await financeEvents.publish({
  eventId: uuidv4(),
  eventVersion: 'v1',
  eventType: 'expense_deleted',
  orgId: authData.orgId,
  propertyId: expenseForEvent.property_id,
  userId: parseInt(authData.userID),
  timestamp: new Date(),
  entityId: id,
  entityType: 'expense',
  metadata: {
    transactionDate: expenseForEvent.expense_date?.toISOString().split('T')[0],
    affectedReportDates: [expenseForEvent.expense_date?.toISOString().split('T')[0]].filter(Boolean)
  }
});
```

#### 3.0.4 `backend/finance/approve_expense_by_id.ts` (line ~198)

```typescript
// After successful approval/rejection
await financeEvents.publish({
  eventId: uuidv4(),
  eventVersion: 'v1',
  eventType: approved ? 'expense_approved' : 'expense_rejected',
  orgId: authData.orgId,
  propertyId: expenseRow.property_id,
  userId: parseInt(authData.userID),
  timestamp: new Date(),
  entityId: id,
  entityType: 'expense',
  metadata: {
    previousStatus: 'pending',
    newStatus: approved ? 'approved' : 'rejected',
    amountCents: expenseRow.amount_cents,
    transactionDate: expenseRow.expense_date?.toISOString().split('T')[0],
    affectedReportDates: [expenseRow.expense_date?.toISOString().split('T')[0]].filter(Boolean)
  }
});
```

### 3.1 🔴 Add Missing Revenue Events: `backend/finance/update_revenue.ts`

Find where revenue is updated (around line 260), add:

```typescript
import { financeEvents } from "./events";
import { v4 as uuidv4 } from 'uuid';

// After successful update
await financeEvents.publish({
  eventId: uuidv4(),
  eventVersion: 'v1',
  eventType: 'revenue_updated',
  orgId: authData.orgId,
  propertyId: updatedRevenue.property_id,
  userId: parseInt(authData.userID),
  timestamp: new Date(),
  entityId: updatedRevenue.id,
  entityType: 'revenue',
  metadata: {
    amountCents: updatedRevenue.amount_cents,
    currency: updatedRevenue.currency,
    transactionDate: updatedRevenue.occurred_at.toISOString().split('T')[0],
    paymentMode: updatedRevenue.payment_mode,
    category: updatedRevenue.source,
    affectedReportDates: [
      // Include both old and new dates if changed
      originalRevenue.occurred_at.toISOString().split('T')[0],
      updatedRevenue.occurred_at.toISOString().split('T')[0]
    ].filter((v, i, a) => a.indexOf(v) === i) // deduplicate
  }
});
```

### 3.2 🔴 Add Missing Revenue Events: `backend/finance/delete_revenue.ts`

After deletion (around line 160):

```typescript
import { financeEvents } from "./events";
import { v4 as uuidv4 } from 'uuid';

// Store revenue info before deletion
const revenueForEvent = { ...revenueRow };

// ... deletion logic ...

await financeEvents.publish({
  eventId: uuidv4(),
  eventVersion: 'v1',
  eventType: 'revenue_deleted',
  orgId: authData.orgId,
  propertyId: revenueForEvent.property_id,
  userId: parseInt(authData.userID),
  timestamp: new Date(),
  entityId: id,
  entityType: 'revenue',
  metadata: {
    transactionDate: revenueForEvent.occurred_at?.toISOString().split('T')[0],
    affectedReportDates: [revenueForEvent.occurred_at?.toISOString().split('T')[0]].filter(Boolean)
  }
});
```

### 3.3 🔴 Add Missing Revenue Events: `backend/finance/approve_revenue_by_id.ts`

After approval (around line 180):

```typescript
import { financeEvents } from "./events";
import { v4 as uuidv4 } from 'uuid';

await financeEvents.publish({
  eventId: uuidv4(),
  eventVersion: 'v1',
  eventType: approved ? 'revenue_approved' : 'revenue_rejected',
  orgId: authData.orgId,
  propertyId: revenueRow.property_id,
  userId: parseInt(authData.userID),
  timestamp: new Date(),
  entityId: id,
  entityType: 'revenue',
  metadata: {
    previousStatus: 'pending',
    newStatus: approved ? 'approved' : 'rejected',
    amountCents: revenueRow.amount_cents,
    transactionDate: revenueRow.occurred_at?.toISOString().split('T')[0],
    affectedReportDates: [revenueRow.occurred_at?.toISOString().split('T')[0]].filter(Boolean)
  }
});
```

### 3.4 🟡 Add Cash Balance Events: `backend/reports/daily_reports.ts`

In cash balance update functions (multiple locations):

```typescript
import { financeEvents } from "../finance/events";
import { v4 as uuidv4 } from 'uuid';

// After cash balance update
await financeEvents.publish({
  eventId: uuidv4(),
  eventVersion: 'v1',
  eventType: 'cash_balance_updated',
  orgId: authData.orgId,
  propertyId: propertyId,
  userId: parseInt(authData.userID),
  timestamp: new Date(),
  entityId: balanceId || 0,
  entityType: 'cash_balance',
  metadata: {
    transactionDate: date,
    affectedReportDates: [date]
  }
});
```

## 4. Reports Cache Manager

Create `backend/reports/cache_manager.ts`:

```typescript
interface CacheEntry {
  data: any;
  lastUpdated: Date;
  orgId: number;
  propertyId?: number;
}

class ReportsCacheManager {
  private dailyCache: Map<string, CacheEntry> = new Map();
  private monthlyCache: Map<string, CacheEntry> = new Map();
  private summaryCache: Map<string, CacheEntry> = new Map(); // NEW: for summary endpoints
  private maxEntries = 1000;
  private ttlMs = 5 * 60 * 1000; // 5min

  private getCacheKey(orgId: number, propertyId: number | undefined, date: string, type: string): string {
    return `${type}:${orgId}:${propertyId || 'all'}:${date}`;
  }

  getDailyReport(orgId: number, propertyId: number | undefined, date: string): any | null {
    const key = this.getCacheKey(orgId, propertyId, date, 'daily');
    const entry = this.dailyCache.get(key);
    
    if (!entry || Date.now() - entry.lastUpdated.getTime() > this.ttlMs || entry.orgId !== orgId) {
      return null;
    }
    
    return entry.data;
  }

  setDailyReport(orgId: number, propertyId: number | undefined, date: string, data: any): void {
    const key = this.getCacheKey(orgId, propertyId, date, 'daily');
    
    if (this.dailyCache.size >= this.maxEntries) {
      const firstKey = this.dailyCache.keys().next().value;
      this.dailyCache.delete(firstKey);
    }
    
    this.dailyCache.set(key, { data, lastUpdated: new Date(), orgId, propertyId });
  }

  getMonthlyReport(orgId: number, propertyId: number | undefined, month: string): any | null {
    const key = this.getCacheKey(orgId, propertyId, month, 'monthly');
    const entry = this.monthlyCache.get(key);
    
    if (!entry || Date.now() - entry.lastUpdated.getTime() > 24*60*60*1000 || entry.orgId !== orgId) {
      return null;
    }
    
    return entry.data;
  }

  setMonthlyReport(orgId: number, propertyId: number | undefined, month: string, data: any): void {
    const key = this.getCacheKey(orgId, propertyId, month, 'monthly');
    
    if (this.monthlyCache.size >= this.maxEntries) {
      const firstKey = this.monthlyCache.keys().next().value;
      this.monthlyCache.delete(firstKey);
    }
    
    this.monthlyCache.set(key, { data, lastUpdated: new Date(), orgId, propertyId });
  }

  // NEW: Summary cache methods
  getSummary(orgId: number, propertyId: number | undefined, summaryType: string): any | null {
    const key = this.getCacheKey(orgId, propertyId, summaryType, 'summary');
    const entry = this.summaryCache.get(key);
    
    if (!entry || Date.now() - entry.lastUpdated.getTime() > this.ttlMs || entry.orgId !== orgId) {
      return null;
    }
    
    return entry.data;
  }

  setSummary(orgId: number, propertyId: number | undefined, summaryType: string, data: any): void {
    const key = this.getCacheKey(orgId, propertyId, summaryType, 'summary');
    
    if (this.summaryCache.size >= this.maxEntries) {
      const firstKey = this.summaryCache.keys().next().value;
      this.summaryCache.delete(firstKey);
    }
    
    this.summaryCache.set(key, { data, lastUpdated: new Date(), orgId, propertyId });
  }

  invalidateByDates(orgId: number, propertyId: number, dates: string[]): void {
    dates.forEach(date => {
      // Invalidate daily reports
      const dailyKey = this.getCacheKey(orgId, propertyId, date, 'daily');
      this.dailyCache.delete(dailyKey);
      
      // Invalidate monthly reports
      const month = date.substring(0, 7);
      const monthlyKey = this.getCacheKey(orgId, propertyId, month, 'monthly');
      this.monthlyCache.delete(monthlyKey);
      
      // Invalidate summary caches (they aggregate across dates)
      this.invalidateSummaries(orgId, propertyId);
      
      // Also invalidate aggregate keys (all properties)
      this.dailyCache.delete(this.getCacheKey(orgId, undefined, date, 'daily'));
      this.monthlyCache.delete(this.getCacheKey(orgId, undefined, month, 'monthly'));
      this.invalidateSummaries(orgId, undefined);
    });
  }

  private invalidateSummaries(orgId: number, propertyId: number | undefined): void {
    // Clear all summary types for this org/property
    const prefixes = [
      this.getCacheKey(orgId, propertyId, '', 'summary'),
      this.getCacheKey(orgId, propertyId, '', 'summary')
    ];
    
    for (const [key, entry] of this.summaryCache.entries()) {
      if (entry.orgId === orgId && 
          (propertyId === undefined || entry.propertyId === propertyId)) {
        this.summaryCache.delete(key);
      }
    }
  }

  clearOrgCache(orgId: number): void {
    for (const [key, entry] of this.dailyCache.entries()) {
      if (entry.orgId === orgId) this.dailyCache.delete(key);
    }
    for (const [key, entry] of this.monthlyCache.entries()) {
      if (entry.orgId === orgId) this.monthlyCache.delete(key);
    }
    for (const [key, entry] of this.summaryCache.entries()) {
      if (entry.orgId === orgId) this.summaryCache.delete(key);
    }
  }

  getStats() {
    return {
      dailyCacheSize: this.dailyCache.size,
      monthlyCacheSize: this.monthlyCache.size,
      summaryCacheSize: this.summaryCache.size,
      maxEntries: this.maxEntries,
      ttlMs: this.ttlMs
    };
  }
}

export const reportsCache = new ReportsCacheManager();
```

## 5. Reports Event Subscription

Create `backend/reports/finance_events_subscriber.ts`:

```typescript
import { Subscription } from "encore.dev/pubsub";
import { financeEvents, FinanceEventPayload, realtimeUpdates } from "../finance/events";
import { reportsCache } from "./cache_manager";

export const financeEventsSubscriber = new Subscription(
  financeEvents,
  "reports-finance-subscriber",
  {
    handler: async (event: FinanceEventPayload) => {
      console.log('[Reports] Finance event:', event.eventType, event.eventId);
      
      try {
        // Invalidate cache if event has affected dates
        if (event.metadata.affectedReportDates?.length) {
          reportsCache.invalidateByDates(
            event.orgId,
            event.propertyId,
            event.metadata.affectedReportDates
          );
          
          console.log('[Reports] Cache invalidated for dates:', event.metadata.affectedReportDates);
        }
        
        // Publish real-time update notification
        await realtimeUpdates.publish({
          orgId: event.orgId,
          propertyId: event.propertyId,
          updateType: event.entityType === 'cash_balance' ? 'balance' : 
                      event.eventType.includes('approval') ? 'approval' : 'transaction',
          timestamp: new Date()
        });
        
      } catch (error) {
        console.error('[Reports] Error processing event:', error);
        throw error; // Encore will retry
      }
    },
    ackDeadline: "30s",
    maxConcurrency: 20
  }
);
```

## 6. Real-Time Updates

Create `backend/reports/realtime_sse.ts`:

```typescript
import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";

export interface RealtimeUpdatesRequest {
  lastUpdateTime?: string;
}

export interface RealtimeUpdatesResponse {
  updates: any[];
  nextPollTime: string;
}

// Polling endpoint (frontend polls every 3-5s)
export const pollRealtimeUpdates = api<RealtimeUpdatesRequest, RealtimeUpdatesResponse>(
  { auth: true, expose: true, method: "GET", path: "/reports/realtime/poll" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) throw new Error("Authentication required");

    // Cache invalidation happens immediately via subscriptions
    // This endpoint tells frontend to refetch reports
    
    return {
      updates: [],
      nextPollTime: new Date(Date.now() + 3000).toISOString()
    };
  }
);
```

## 7. Integrate Caching into Report Endpoints

### 7.1 Update `backend/reports/daily_reports.ts`

```typescript
import { reportsCache } from "./cache_manager";

// In getDailyReport function
const cached = reportsCache.getDailyReport(authData.orgId, propertyId, date);
if (cached) {
  console.log('[Reports] Cache hit for daily report:', date);
  return cached;
}

// ... fetch from DB ...

const reportData = { /* assembled report data */ };

reportsCache.setDailyReport(authData.orgId, propertyId, date, reportData);
console.log('[Reports] Cache set for daily report:', date);

return reportData;
```

### 7.2 Update `backend/reports/monthly_yearly_reports.ts`

```typescript
import { reportsCache } from "./cache_manager";

// In getMonthlyYearlyReport
const monthKey = startDate?.substring(0, 7) || new Date().toISOString().substring(0, 7);
const cached = reportsCache.getMonthlyReport(authData.orgId, propertyId, monthKey);
if (cached) {
  console.log('[Reports] Cache hit for monthly report:', monthKey);
  return cached;
}

// ... fetch from DB ...

const reportData = { /* assembled report data */ };

reportsCache.setMonthlyReport(authData.orgId, propertyId, monthKey, reportData);
console.log('[Reports] Cache set for monthly report:', monthKey);

return reportData;
```

### 7.3 🆕 Add Caching to Summary Endpoints

If you have summary endpoints like `getSummaryReport` or aggregate endpoints, add:

```typescript
import { reportsCache } from "./cache_manager";

// In summary endpoint
const summaryType = `${reportType}-${period}`; // e.g., "revenue-monthly"
const cached = reportsCache.getSummary(authData.orgId, propertyId, summaryType);
if (cached) {
  console.log('[Reports] Cache hit for summary:', summaryType);
  return cached;
}

// ... fetch from DB ...

const summaryData = { /* assembled summary data */ };

reportsCache.setSummary(authData.orgId, propertyId, summaryType, summaryData);
console.log('[Reports] Cache set for summary:', summaryType);

return summaryData;
```

## 8. Event Monitoring

Add to `backend/finance/event_store.ts`:

```typescript
export const getEventMetrics = api(
  { auth: true, expose: true, method: "GET", path: "/finance/events/metrics" },
  async () => {
    const authData = getAuthData();
    if (!authData) throw APIError.unauthenticated("Authentication required");
    requireRole("ADMIN")(authData);
    
    const metrics = await financeDB.queryAll`
      SELECT 
        event_type,
        COUNT(*) as count,
        DATE_TRUNC('hour', created_at) as hour
      FROM finance_event_store
      WHERE org_id = ${authData.orgId}
        AND created_at > NOW() - INTERVAL '24 hours'
      GROUP BY event_type, hour
      ORDER BY hour DESC
    `;
    
    return { metrics, timestamp: new Date() };
  }
);
```

Create `backend/reports/cache_metrics.ts`:

```typescript
import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { reportsCache } from "./cache_manager";

export const getCacheMetrics = api(
  { auth: true, expose: true, method: "GET", path: "/reports/cache/metrics" },
  async () => {
    const authData = getAuthData();
    if (!authData) throw APIError.unauthenticated("Authentication required");
    requireRole("ADMIN")(authData);
    
    return { ...reportsCache.getStats(), timestamp: new Date() };
  }
);

export const clearCache = api(
  { auth: true, expose: true, method: "POST", path: "/reports/cache/clear" },
  async () => {
    const authData = getAuthData();
    if (!authData) throw APIError.unauthenticated("Authentication required");
    requireRole("ADMIN")(authData);
    
    reportsCache.clearOrgCache(authData.orgId);
    return { success: true, timestamp: new Date() };
  }
);
```

## 9. Deployment Strategy

### Phase 1: Event Schema Migration (CRITICAL FIRST)
**Priority: 🔴 CRITICAL - Must complete before cache will work**

1. Deploy migration 13 (event store table)
2. Update `backend/finance/events.ts` with new schema
3. Update `backend/finance/finance_events_handler.ts` to persist events
4. Create `backend/finance/event_store.ts`
5. **🔴 UPDATE all 4 expense files to NEW event schema** (Section 3.0)
6. Test: Verify existing expense operations publish with new schema

**Validation:**
- Add an expense and check logs for `eventId`, `propertyId`, `affectedReportDates`
- Query `finance_event_store` table to verify events are persisting

### Phase 2: Revenue Event Publishing (CRITICAL)
**Priority: 🔴 CRITICAL - Required for complete coverage**

1. Add event publishing to `update_revenue.ts` (Section 3.1)
2. Add event publishing to `delete_revenue.ts` (Section 3.2)
3. Add event publishing to `approve_revenue_by_id.ts` (Section 3.3)
4. Test: Verify all revenue operations publish events with new schema

**Validation:**
- Update/delete/approve revenues and check event store
- Verify `affectedReportDates` are populated

### Phase 3: Cash Balance Events (HIGH)
**Priority: 🟡 HIGH - Needed for complete invalidation**

1. Add event publishing to cash balance updates in `daily_reports.ts` (Section 3.4)
2. Test: Verify balance updates publish events

### Phase 4: Cache & Subscription (MEDIUM)
**Priority: 🟢 MEDIUM - Only after events are fixed**

1. Deploy `backend/reports/cache_manager.ts`
2. Deploy `backend/reports/finance_events_subscriber.ts`
3. Test: Verify cache invalidation works on events
4. Monitor logs for successful invalidations

**Validation:**
- Add expense, check logs for cache invalidation
- Query report endpoint twice - second should be cache hit

### Phase 5: Cache Integration (MEDIUM)
**Priority: 🟢 MEDIUM**

1. Update `daily_reports.ts` with cache (Section 7.1)
2. Update `monthly_yearly_reports.ts` with cache (Section 7.2)
3. Add cache to summary endpoints (Section 7.3)
4. Test: Measure cache hit rates

**Validation:**
- Check logs for "Cache hit" messages
- Use cache metrics endpoint to verify hit rates

### Phase 6: Real-Time & Monitoring (LOW)
**Priority: 🟢 LOW - Nice to have**

1. Deploy `realtime_sse.ts` polling endpoint
2. Deploy cache and event metrics endpoints
3. Set up monitoring dashboards

## File Changes Summary

### 🔴 CRITICAL: Files to MODIFY (7 files)

**Must update FIRST for cache invalidation to work:**

1. `backend/finance/events.ts` - Add new event schema
2. `backend/finance/finance_events_handler.ts` - Add persistence
3. **`backend/finance/add_expense.ts`** - UPDATE to new schema
4. **`backend/finance/update_expense.ts`** - UPDATE to new schema
5. **`backend/finance/delete_expense.ts`** - UPDATE to new schema
6. **`backend/finance/approve_expense_by_id.ts`** - UPDATE to new schema

**Add missing event publishers:**

7. `backend/finance/update_revenue.ts` - ADD event publishing
8. `backend/finance/delete_revenue.ts` - ADD event publishing
9. `backend/finance/approve_revenue_by_id.ts` - ADD event publishing
10. `backend/reports/daily_reports.ts` - ADD cash balance events + cache integration

### 🟢 NEW Files to CREATE (8 files)

1. `backend/finance/migrations/13_create_event_store.up.sql` - Event store table
2. `backend/finance/event_store.ts` - Event persistence & history API
3. `backend/reports/cache_manager.ts` - Cache with summary support
4. `backend/reports/finance_events_subscriber.ts` - Cache invalidation
5. `backend/reports/realtime_sse.ts` - Real-time polling
6. `backend/reports/cache_metrics.ts` - Cache metrics & admin
7. `backend/reports/monthly_yearly_reports.ts` - Cache integration (if not exists)
8. Tests (multiple files as needed)

### 📦 Dependencies

```bash
npm install uuid @types/uuid
```

## Benefits

- **Performance**: 10-100x faster via caching
- **Audit Trail**: Complete event history with versioning
- **Real-Time**: 3-5s update latency via polling
- **Scalability**: Org-scoped isolation prevents cross-contamination
- **Future-Ready**: Event versioning enables schema evolution
- **Consistency**: Cache auto-invalidates on every financial change

## Validation Checklist

After deployment, verify:

- [ ] All expense operations publish events with new schema (eventId, propertyId, affectedReportDates)
- [ ] All revenue operations publish events with new schema
- [ ] Cash balance updates publish events
- [ ] Events persist to `finance_event_store` table
- [ ] Cache invalidates on financial changes
- [ ] Report endpoints return cached data on second call
- [ ] Cache metrics show > 70% hit rate
- [ ] Event history API returns complete audit trail
- [ ] Real-time polling endpoint responds < 100ms

## To-dos (Updated Priority Order)

### 🔴 Phase 1: CRITICAL - Event Schema Migration (DO FIRST)
- [ ] Create migration 13 for event store table
- [ ] Update `events.ts` with enhanced schema including cache metadata
- [ ] Update `finance_events_handler.ts` to persist events
- [ ] Create `event_store.ts` with persistence and history API
- [ ] **UPDATE `add_expense.ts` to new event schema with affectedReportDates**
- [ ] **UPDATE `update_expense.ts` to new event schema with affectedReportDates**
- [ ] **UPDATE `delete_expense.ts` to new event schema with affectedReportDates**
- [ ] **UPDATE `approve_expense_by_id.ts` to new event schema with affectedReportDates**
- [ ] Test: Verify expense operations publish with new schema

### 🔴 Phase 2: CRITICAL - Missing Revenue Events (DO SECOND)
- [ ] ADD event publisher to `update_revenue.ts` with new schema
- [ ] ADD event publisher to `delete_revenue.ts` with new schema
- [ ] ADD event publisher to `approve_revenue_by_id.ts` with new schema
- [ ] Test: Verify revenue operations publish events correctly

### 🟡 Phase 3: HIGH - Cash Balance Events
- [ ] ADD event publisher to cash balance updates in `daily_reports.ts`
- [ ] Test: Verify balance updates trigger events

### 🟢 Phase 4: MEDIUM - Cache Infrastructure
- [ ] Create `cache_manager.ts` with org-scoped cache and summary support
- [ ] Create `finance_events_subscriber.ts` for cache invalidation
- [ ] Test: Verify cache invalidates on financial events
- [ ] Monitor cache invalidation logs

### 🟢 Phase 5: MEDIUM - Cache Integration
- [ ] Integrate cache into `daily_reports.ts` endpoint
- [ ] Integrate cache into `monthly_yearly_reports.ts` endpoint
- [ ] Add cache to summary/aggregate endpoints
- [ ] Test: Verify cache hit rates > 70%

### 🟢 Phase 6: LOW - Real-Time & Monitoring
- [ ] Implement `realtime_sse.ts` polling endpoint
- [ ] Create `cache_metrics.ts` with admin endpoints
- [ ] Add event metrics endpoint to `event_store.ts`
- [ ] Set up monitoring dashboards for cache and events
- [ ] Test: Verify real-time updates propagate within 5s

### 🟢 Phase 7: LOW - Testing & Documentation
- [ ] Create comprehensive tests for event publishing
- [ ] Create tests for cache invalidation logic
- [ ] Create tests for real-time update flow
- [ ] Document deployment procedures
- [ ] Document rollback procedures

