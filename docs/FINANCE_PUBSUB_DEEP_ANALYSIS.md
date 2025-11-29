# Finance Pub/Sub Deep Analysis & Implementation Status

**Date:** 2025-11-19  
**Scope:** Complete audit of Finance realtime system (backend + frontend)  
**Goal:** Identify what's working, gaps, and actionable improvements

---

## 🎯 Executive Summary

### What We've Achieved ✅
1. **Core Pub/Sub Infrastructure** - Topics, payloads, subscriber, buffer system all operational
2. **Long-poll Transport** - `useFinanceRealtimeV2` hook with backoff, visibility handling, health tracking
3. **Partial Event Publishing** - Add/approve flows publish events correctly
4. **Frontend Realtime Hook** - Connected and receiving events with health badge
5. **Incremental Aggregates** - Summary cards update via event-driven totals adjustments

### Critical Gaps 🔴
1. **Missing Publishers** - `update_*` and `delete_*` endpoints don't publish events
2. **Broad Invalidations** - Still invalidating entire lists instead of patching rows
3. **No Single-Item Endpoints** - Can't fetch individual expense/revenue for reconciliation
4. **Query Settings** - `staleTime: 0` + `refetchOnWindowFocus: true` causing excessive fetches
5. **No Ops Visibility** - No admin UI to monitor realtime health

---

## 📊 Detailed Technical Analysis

### 1. Backend Event Publishing Coverage

#### ✅ **Publishing Correctly:**
- `add_expense.ts` → `expense_added` ✓
- `add_revenue.ts` → `revenue_added` ✓  
- `approve_expense.ts` → `expense_approved/rejected` ✓
- `approve_expense_by_id.ts` → `expense_approved/rejected` ✓
- `approve_revenue.ts` → `revenue_approved/rejected` ✓
- `approve_revenue_by_id.ts` → `revenue_approved/rejected` ✓
- `daily_approval_manager.ts` → `daily_approval_granted` ✓

#### ❌ **Missing Publishers:**

**File:** `backend/finance/update_expense.ts`
- **Current:** Updates expense in DB (lines 161-243), commits transaction (line 289), returns data — **NO EVENT PUBLISHED**
- **Impact:** Frontend never sees expense updates in realtime; relies on periodic refetch
- **Fix Required:** After commit (line 289), publish `expense_updated` with full metadata

**File:** `backend/finance/update_revenue.ts`
- **Current:** Updates revenue in DB, commits — **NO EVENT PUBLISHED**
- **Impact:** Same as expense; revenue edits invisible to realtime stream
- **Fix Required:** Publish `revenue_updated` after commit

**File:** `backend/finance/delete_expense.ts`
- **Current:** Deletes expense (line 140+), commits (line 164) — **NO EVENT PUBLISHED**
- **Impact:** Deleted expenses don't disappear from UI until manual refresh
- **Fix Required:** Publish `expense_deleted` before commit with metadata (id, amountCents, paymentMode for totals adjustment)

**File:** `backend/finance/delete_revenue.ts`
- **Current:** Same pattern as delete_expense — **NO EVENT PUBLISHED**
- **Impact:** Same gap
- **Fix Required:** Publish `revenue_deleted`

---

### 2. Frontend Event Handling Analysis

**File:** `frontend/pages/FinancePage.tsx`

#### Current Pattern (Lines 79-128):
```typescript
useEffect(() => {
  const onFinanceEvents = (e: any) => {
    // 1. Updates incremental totals for summary cards ✅
    setTotals(prev => { ... });
    
    // 2. Broad invalidations ❌
    if (type.includes('expense')) {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['profit-loss'] });
    }
    // Similar for revenues...
  };
}, [queryClient]);
```

#### Problems:
1. **Broad Invalidations** - Every event triggers full list refetch (100+ items)
2. **No Row-Level Updates** - Doesn't patch React Query cache for specific rows
3. **Redundant Fetches** - Event + invalidation + optimistic update all happening

#### What Should Happen:
```typescript
// When expense_updated arrives:
1. Find expense in cache by entityId
2. Patch that specific row with metadata fields
3. Only invalidate if row not found (edge case)

// When expense_deleted arrives:
1. Remove that row from cache
2. Adjust totals
3. No invalidation needed
```

---

### 3. React Query Configuration Issues

**File:** `frontend/pages/FinancePage.tsx` (Lines 285-320, 322-361)

```typescript
// Expenses Query
const { data: expenses } = useQuery({
  queryKey: ['expenses', selectedPropertyId, dateRange],
  queryFn: async () => { ... },
  refetchInterval: false,
  staleTime: 0,                    // ❌ PROBLEM: Always considers data stale
  gcTime: 300000,
  refetchOnWindowFocus: true,      // ❌ PROBLEM: Refetches on every tab switch
  refetchOnMount: true,
});

// Revenues Query - Same pattern
```

#### Impact:
- **Excessive Backend Load:** Every tab switch → full list fetch
- **Redundant with Events:** Stream updates make aggressive refetching unnecessary
- **Log Evidence:** Terminal shows 20-70s overlapping list queries under load

#### Recommended Settings:
```typescript
staleTime: 5000,              // 5s grace period (events keep data fresh)
refetchOnWindowFocus: false,  // Events handle freshness
refetchOnMount: true,         // Still fetch on first mount
```

---

### 4. Missing Single-Item Fetch Endpoints

**Current State:**
- ❌ No `GET /finance/expenses/:id`
- ❌ No `GET /finance/revenues/:id`

**Why Needed:**
When an event arrives for a row not in cache (filtered out, pagination, etc.), we need to fetch just that row instead of invalidating entire list.

**Example Scenario:**
1. User filters to "Property A" expenses
2. Manager adds expense for "Property B" → event published
3. Event arrives with `entityId: 123` (Property B)
4. Cache doesn't have this row (filtered out)
5. **Current:** Invalidate entire list → fetch 100 items
6. **Better:** Fetch only expense 123, check filter, add if matches

**Implementation:**
```typescript
// backend/finance/get_expense_by_id.ts
export const getExpenseById = api<{id: number}, ExpenseResponse>(
  { auth: true, method: "GET", path: "/finance/expenses/:id" },
  async (req) => {
    // Fetch single expense with joins
    // Check org_id, property access
    // Return full expense data
  }
);
```

---

### 5. Observability & Monitoring

**Current:**
- ✅ Backend metrics endpoint exists: `/finance/events/metrics`
- ✅ Logs show buffer activity, publish/deliver counts
- ❌ **No UI to view metrics** (must tail logs or curl endpoint)

**What's Missing:**
An admin-only card that shows:
- 🟢 Green badge if `totalDropped === 0`
- 🔴 Red badge if drops > 0 or delivery lag
- Buffer sizes per org
- Published vs delivered counts by event type
- Last event timestamp

**Value:**
- Instant visibility into realtime health
- Troubleshoot "why didn't my update appear instantly?"
- Capacity planning (growing buffers = scale subscriber)

---

## 🔍 Code Quality Assessment

### Strengths ✅
1. **Type Safety** - `FinanceEventPayload` well-defined with metadata
2. **Error Handling** - Publishers wrapped in try/catch, don't fail transactions
3. **Idempotency** - `eventId` (UUID) included in all events
4. **Bounded Buffers** - MAX_BUFFER_SIZE=200, TTL=25s prevents memory leaks
5. **Backoff Strategy** - Frontend hook has exponential backoff (1s → 5s)
6. **Visibility Pause** - Hook pauses when tab hidden to reduce load

### Weaknesses ❌
1. **Incomplete Publisher Coverage** - 4 major endpoints missing events
2. **No Row-Level Cache Updates** - Frontend still using broad invalidations
3. **Overly Aggressive Refetch** - staleTime=0 defeats event-driven design
4. **No Single-Item Fetch** - Forces list refetch for missing rows
5. **No Ops Dashboard** - Monitoring requires log access

---

## 📈 Performance Impact Analysis

### Current Behavior (from terminal logs):
```
[Finance] Published expense_added event
→ financeEvents → finance_realtime_subscriber → buffer
→ Long-poll returns event to frontend
→ Frontend: invalidateQueries(['expenses'])
→ Backend: SELECT * FROM expenses... (100 rows)
→ Network: ~50-200KB response
→ React Query: Replace entire cache
```

**Time:** ~200-500ms per event  
**Bandwidth:** ~50-200KB per update  
**Backend Load:** Full table scan + joins

### Target Behavior (with row-level updates):
```
[Finance] Published expense_added event
→ financeEvents → finance_realtime_subscriber → buffer
→ Long-poll returns event to frontend
→ Frontend: Patch cache row with event metadata
→ No backend call
→ UI updates immediately
```

**Time:** ~0-50ms (memory operation)  
**Bandwidth:** ~0 bytes (already have event data)  
**Backend Load:** Zero

**Estimated Improvement:** 90%+ reduction in list queries

---

## 🎯 Actionable Todo List with Priority

### 🔥 **PRIORITY 1: Complete Publisher Coverage** (1-2 hours)
These are the foundation; without them, realtime is incomplete.

#### Task 1.1: Add `expense_updated` event publishing
**File:** `backend/finance/update_expense.ts`  
**Location:** After line 289 (after `await tx.commit()`)  
**Code:**
```typescript
// Publish update event
try {
  const expenseDate = toISTDateString(updatedExpense.expense_date || new Date());
  await financeEvents.publish({
    eventId: uuidv4(),
    eventVersion: 'v1',
    eventType: 'expense_updated',
    orgId: authData.orgId,
    propertyId: updatedExpense.property_id,
    userId: parseInt(authData.userID),
    timestamp: new Date(),
    entityId: id,
    entityType: 'expense',
    metadata: {
      amountCents: updatedExpense.amount_cents,
      currency: updatedExpense.currency,
      paymentMode: updatedExpense.payment_mode,
      category: updatedExpense.category,
      transactionDate: expenseDate,
      affectedReportDates: [expenseDate],
    }
  });
  console.log('[Finance] Published expense_updated event for ID:', id);
} catch (err) {
  console.error('[Finance] Failed to publish expense_updated:', err);
}
```

#### Task 1.2: Add `revenue_updated` event publishing
**File:** `backend/finance/update_revenue.ts`  
**Similar pattern as 1.1**

#### Task 1.3: Add `expense_deleted` event publishing
**File:** `backend/finance/delete_expense.ts`  
**Location:** Before commit (line 164)  
**Code:**
```typescript
// Publish delete event
try {
  await financeEvents.publish({
    eventId: uuidv4(),
    eventVersion: 'v1',
    eventType: 'expense_deleted',
    orgId: authData.orgId,
    propertyId: expenseRow.property_id,
    userId: parseInt(authData.userID),
    timestamp: new Date(),
    entityId: id,
    entityType: 'expense',
    metadata: {
      amountCents: expenseRow.amount_cents,
      paymentMode: expenseRow.payment_mode,
      category: expenseRow.category,
      transactionDate: toISTDateString(expenseRow.expense_date || new Date()),
    }
  });
} catch (err) {
  console.error('[Finance] Failed to publish expense_deleted:', err);
}
```

#### Task 1.4: Add `revenue_deleted` event publishing
**File:** `backend/finance/delete_revenue.ts`  
**Similar pattern as 1.3**

**Validation:**
- [ ] All 4 new publishers added
- [ ] Import `{ v4 as uuidv4 }` from 'uuid'
- [ ] Import `{ financeEvents }` from './events'
- [ ] No linter errors
- [ ] Test each mutation → check terminal logs for "Published {event_type}"

---

### 🔥 **PRIORITY 2: Implement Row-Level Cache Patching** (2-3 hours)
This is the key performance optimization.

#### Task 2.1: Extend `onFinanceEvents` handler with cache patching
**File:** `frontend/pages/FinancePage.tsx`  
**Location:** Inside `useEffect` (lines 79-128), replace current invalidations  

**Pseudocode:**
```typescript
for (const ev of events) {
  const { eventType, entityId, entityType, metadata } = ev;
  
  // Determine cache key
  const cacheKey = entityType === 'expense' ? ['expenses'] : ['revenues'];
  
  // Get current cache
  const cached = queryClient.getQueryData(cacheKey);
  if (!cached?.[entityType + 's']) continue; // Skip if no cache
  
  // Handle based on event type
  if (eventType.endsWith('_added')) {
    // Insert new row at top (if not exists)
    queryClient.setQueryData(cacheKey, (old: any) => {
      const list = old[entityType + 's'] || [];
      const exists = list.find((x: any) => x.id === entityId);
      if (exists) return old; // Already there (from optimistic)
      
      const newRow = buildRowFromEvent(ev, metadata); // Helper function
      return {
        ...old,
        [entityType + 's']: [newRow, ...list]
      };
    });
  }
  
  else if (eventType.endsWith('_updated')) {
    // Patch existing row
    queryClient.setQueryData(cacheKey, (old: any) => {
      const list = old[entityType + 's'] || [];
      const idx = list.findIndex((x: any) => x.id === entityId);
      if (idx === -1) {
        // Not in cache → fetch single item
        fetchSingleItem(entityType, entityId); // TODO: implement
        return old;
      }
      
      const updated = { ...list[idx], ...metadata, updatedAt: new Date().toISOString() };
      const newList = [...list];
      newList[idx] = updated;
      return { ...old, [entityType + 's']: newList };
    });
  }
  
  else if (eventType.endsWith('_approved') || eventType.endsWith('_rejected')) {
    // Patch status and approval fields
    queryClient.setQueryData(cacheKey, (old: any) => {
      const list = old[entityType + 's'] || [];
      const idx = list.findIndex((x: any) => x.id === entityId);
      if (idx === -1) return old;
      
      const updated = {
        ...list[idx],
        status: metadata.newStatus,
        approvedByUserId: ev.userId,
        approvedAt: ev.timestamp,
      };
      const newList = [...list];
      newList[idx] = updated;
      return { ...old, [entityType + 's']: newList };
    });
  }
  
  else if (eventType.endsWith('_deleted')) {
    // Remove row from cache
    queryClient.setQueryData(cacheKey, (old: any) => {
      const list = old[entityType + 's'] || [];
      return {
        ...old,
        [entityType + 's']: list.filter((x: any) => x.id !== entityId)
      };
    });
  }
}

// Keep narrow invalidations for derived queries only
if (hasExpenseEvent) {
  queryClient.invalidateQueries({ queryKey: ['profit-loss'] });
}
if (hasApprovalEvent) {
  queryClient.invalidateQueries({ queryKey: ['daily-approval-check'] });
}
```

**Helper Function:**
```typescript
function buildRowFromEvent(ev: FinanceEventPayload, metadata: any) {
  const isExpense = ev.entityType === 'expense';
  return {
    id: ev.entityId,
    propertyId: ev.propertyId,
    propertyName: metadata.propertyName || 'Property', // May need separate fetch
    [isExpense ? 'category' : 'source']: metadata.category || metadata.source,
    amountCents: metadata.amountCents,
    currency: metadata.currency || 'INR',
    paymentMode: metadata.paymentMode,
    [isExpense ? 'expenseDate' : 'occurredAt']: metadata.transactionDate,
    status: metadata.newStatus || 'pending',
    createdAt: ev.timestamp.toISOString(),
  };
}
```

**Validation:**
- [ ] Test add expense → see instant UI update (no refetch)
- [ ] Test approve → status changes immediately
- [ ] Test update → fields change immediately
- [ ] Test delete → row disappears immediately
- [ ] Check network tab: no list fetches triggered by events
- [ ] Check React Query Devtools: cache updated correctly

---

### 🔥 **PRIORITY 3: Optimize Query Settings** (15 minutes)
Simple config change with big impact.

#### Task 3.1: Update expenses query
**File:** `frontend/pages/FinancePage.tsx` (line 316)  
**Change:**
```typescript
staleTime: 5000,              // Was: 0
refetchOnWindowFocus: false,  // Was: true
```

#### Task 3.2: Update revenues query
**File:** `frontend/pages/FinancePage.tsx` (line 357)  
**Same changes as 3.1**

**Validation:**
- [ ] Switch tabs repeatedly → check network tab (no list fetches)
- [ ] Add/edit/approve items → UI still updates (via events)
- [ ] Reconciliation effect still runs after 5s stale period

---

### ⚠️ **PRIORITY 4: Add Single-Item Fetch Endpoints** (1 hour)
Needed for complete row-level reconciliation.

#### Task 4.1: Create `get_expense_by_id.ts`
**File:** `backend/finance/get_expense_by_id.ts`  
**Code:**
```typescript
import { api, APIError } from "encore.dev/api";
import { getAuthData } from "encore.dev/auth";
import { requireRole } from "../auth/require_role";
import { financeDB } from "./db";

export interface GetExpenseByIdRequest {
  id: number;
}

export interface GetExpenseByIdResponse {
  id: number;
  propertyId: number;
  propertyName: string;
  category: string;
  amountCents: number;
  currency: string;
  description: string;
  receiptUrl?: string;
  receiptFileId?: string;
  expenseDate: string;
  paymentMode: 'cash' | 'bank';
  bankReference?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdByUserId: number;
  createdByName: string;
  approvedByUserId?: number;
  approvedByName?: string;
  approvedAt?: Date;
  createdAt: Date;
}

export const getExpenseById = api<GetExpenseByIdRequest, GetExpenseByIdResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/expenses/:id" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) throw APIError.unauthenticated("Authentication required");
    requireRole("ADMIN", "MANAGER")(authData);

    const expense = await financeDB.queryRow`
      SELECT
        e.id, e.property_id, p.name as property_name, e.category, e.amount_cents, e.currency,
        e.description, e.receipt_url, e.receipt_file_id, e.expense_date,
        e.payment_mode, e.bank_reference,
        COALESCE(e.status, 'pending') as status, e.created_by_user_id,
        u.display_name as created_by_name,
        e.approved_by_user_id, au.display_name as approved_by_name, e.approved_at, e.created_at
      FROM expenses e
      JOIN properties p ON e.property_id = p.id
      JOIN users u ON e.created_by_user_id = u.id
      LEFT JOIN users au ON e.approved_by_user_id = au.id
      WHERE e.id = ${req.id} AND e.org_id = ${authData.orgId}
    `;

    if (!expense) throw APIError.notFound("Expense not found");

    // Check manager property access
    if (authData.role === "MANAGER") {
      const hasAccess = await financeDB.queryRow`
        SELECT EXISTS(
          SELECT 1 FROM user_properties
          WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${expense.property_id}
        )
      `;
      if (!hasAccess) throw APIError.permissionDenied("No access to this property");
    }

    return expense;
  }
);
```

#### Task 4.2: Create `get_revenue_by_id.ts`
**Similar to 4.1, adjust for revenues table schema**

#### Task 4.3: Export new endpoints
**File:** `backend/finance/encore.service.ts`  
**Add:**
```typescript
export { getExpenseById } from "./get_expense_by_id";
export { getRevenueById } from "./get_revenue_by_id";
```

#### Task 4.4: Use in frontend cache reconciliation
**File:** `frontend/pages/FinancePage.tsx`  
**In the `_updated` event handler:**
```typescript
if (idx === -1) {
  // Not in cache → fetch single item
  const backend = getAuthenticatedBackend();
  const item = await backend.finance[entityType === 'expense' ? 'getExpenseById' : 'getRevenueById'](entityId);
  
  // Check if matches current filters
  const matchesFilter = (
    (!selectedPropertyId || selectedPropertyId === 'all' || item.propertyId === parseInt(selectedPropertyId)) &&
    (!dateRange.startDate || item[entityType === 'expense' ? 'expenseDate' : 'occurredAt'] >= dateRange.startDate) &&
    (!dateRange.endDate || item[entityType === 'expense' ? 'expenseDate' : 'occurredAt'] <= dateRange.endDate)
  );
  
  if (matchesFilter) {
    // Add to cache
    queryClient.setQueryData(cacheKey, (old: any) => ({
      ...old,
      [entityType + 's']: [item, ...(old[entityType + 's'] || [])]
    }));
  }
  return old;
}
```

**Validation:**
- [ ] Filter to Property A
- [ ] Add expense for Property B (via API or another tab)
- [ ] Event arrives
- [ ] Frontend fetches single expense
- [ ] Expense NOT added to cache (filter mismatch)
- [ ] No full list refetch

---

### 📊 **PRIORITY 5: Admin Metrics Dashboard** (1-2 hours)
Optional but valuable for operations.

#### Task 5.1: Create FinanceRealtimeHealthCard component
**File:** `frontend/components/ui/FinanceRealtimeHealthCard.tsx`  
**Code:**
```typescript
import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './card';
import { Badge } from './badge';
import { Button } from './button';
import { RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { API_CONFIG } from '@/src/config/api';

export function FinanceRealtimeHealthCard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_CONFIG.BASE_URL}/finance/events/metrics`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      const json = await resp.json();
      setData(json);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => { fetchMetrics(); }, []);
  
  if (!data) return null;
  
  const rt = data.realtime || {};
  const dropped = rt.totals?.totalDropped || 0;
  const buffers = rt.buffers || [];
  const published = rt.publishedByType || {};
  const delivered = rt.deliveredByType || {};
  
  const isHealthy = dropped === 0;
  
  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          Finance Realtime Health
          <Badge variant={isHealthy ? 'outline' : 'destructive'} className="flex items-center gap-1">
            {isHealthy ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
            {isHealthy ? 'Healthy' : `${dropped} Drops`}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div>
          <div className="font-medium mb-1">Buffers ({buffers.length} orgs)</div>
          {buffers.slice(0, 5).map((b: any) => (
            <div key={b.orgId} className="flex justify-between">
              <span>Org {b.orgId}</span>
              <span className="font-mono">{b.size} events</span>
            </div>
          ))}
        </div>
        
        <div>
          <div className="font-medium mb-1">Delivery Status</div>
          {Object.keys(published).map((type) => {
            const pub = published[type] || 0;
            const del = delivered[type] || 0;
            const pct = pub > 0 ? ((del / pub) * 100).toFixed(0) : '100';
            const ok = del >= pub * 0.9;
            return (
              <div key={type} className="flex justify-between">
                <span className="truncate">{type}</span>
                <span className={ok ? 'text-green-700' : 'text-orange-700'}>
                  {del}/{pub} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
        
        <Button size="sm" variant="outline" onClick={fetchMetrics} disabled={loading} className="w-full">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh Metrics
        </Button>
      </CardContent>
    </Card>
  );
}
```

#### Task 5.2: Add to SettingsPage or ReportsPage
**Location:** Admin-only section  
**Code:**
```typescript
{user?.role === 'ADMIN' && (
  <FinanceRealtimeHealthCard />
)}
```

**Validation:**
- [ ] Card renders for ADMIN users
- [ ] Shows buffer sizes
- [ ] Shows published vs delivered counts
- [ ] Badge is green when healthy
- [ ] Badge is red when drops detected
- [ ] Refresh button updates data

---

## 🧪 Testing & Validation Checklist

### End-to-End Event Flow
- [ ] **Add Expense** → Backend publishes `expense_added` → Event appears in terminal logs → Frontend receives event → Row appears in UI instantly
- [ ] **Update Expense** → Backend publishes `expense_updated` → Row updates in UI without refetch
- [ ] **Approve Expense** → Backend publishes `expense_approved` → Status changes immediately → Summary cards update
- [ ] **Delete Expense** → Backend publishes `expense_deleted` → Row disappears → Summary cards adjust
- [ ] Same 4 tests for **Revenues**

### Performance Validation
- [ ] Open browser DevTools Network tab
- [ ] Add 5 expenses rapidly
- [ ] Verify: Only 5 POST requests + 1 long-poll response (no list GETs)
- [ ] Switch tabs 3 times
- [ ] Verify: No additional list GETs (staleTime preventing refetch)

### Edge Cases
- [ ] Event arrives for row outside current filter → Frontend fetches single item → Doesn't add to cache
- [ ] Multiple events for same row → Last write wins, no duplicate rows
- [ ] Optimistic update + event arrives → Event overwrites optimistic correctly
- [ ] Network failure during long-poll → Hook reconnects with backoff → Events resume

### Metrics Validation
- [ ] Curl `/finance/events/metrics` → Check `realtime.totals.totalDropped` is 0
- [ ] Check `publishedByType` vs `deliveredByType` → Should be equal or close
- [ ] Admin card shows same data

---

## 📝 Questions for Clarification

Before proceeding with implementation, please confirm:

### 1. **Update/Delete Event Payload Structure**
For `*_updated` events, should we include:
- Full new values (amountCents, category, etc.)?
- Only changed fields (delta)?
- Both previous and new values?

**Recommendation:** Include full new values in metadata to simplify frontend reconciliation.

### 2. **Single-Item Endpoint Auth**
Should `GET /finance/expenses/:id` enforce:
- Same property access rules as list endpoint (managers only see their properties)?
- Or allow any expense in org (for realtime reconciliation)?

**Recommendation:** Enforce property access for security consistency.

### 3. **Cache Patching Strategy**
When event arrives for missing row, should we:
- Always fetch single item and attempt to add?
- Only fetch if current filters are "permissive" (no date/property filter)?
- Skip and rely on next periodic refetch?

**Recommendation:** Always try to fetch, then apply filters before adding to cache.

### 4. **Delete Event Timing**
Should `*_deleted` events publish:
- Before DB delete (so we have full row data)?
- After DB delete (to guarantee consistency)?

**Recommendation:** Before delete so metadata (amountCents, paymentMode) is available for totals adjustment.

### 5. **Admin Metrics Placement**
Where should `FinanceRealtimeHealthCard` live:
- SettingsPage (admin section)?
- ReportsPage (developer/monitoring section)?
- New /admin/monitoring page?

**Recommendation:** SettingsPage under "System Health" or "Monitoring" tab.

### 6. **Event Priority During High Load**
Should we prioritize certain event types during buffer overflow:
- Keep approval/delete events, drop updates?
- Fair FIFO (current behavior)?
- Per-event-type buffers?

**Recommendation:** Keep current FIFO; add alerting if drops occur.

---

## 🚀 Implementation Timeline Estimate

| Priority | Task | Estimated Time | Complexity |
|----------|------|----------------|------------|
| 1 | Complete Publisher Coverage | 1-2 hours | Low (pattern established) |
| 2 | Row-Level Cache Patching | 2-3 hours | Medium (careful testing) |
| 3 | Optimize Query Settings | 15 minutes | Low (config change) |
| 4 | Single-Item Endpoints | 1 hour | Low (CRUD pattern) |
| 5 | Admin Metrics Dashboard | 1-2 hours | Medium (new component) |
| **Total** | **Full Implementation** | **6-8 hours** | **Medium** |

---

## 📊 Expected Performance Improvements

### Current (Before Optimizations)
- **List Refetch Frequency:** Every event + every tab focus
- **Average Response Time:** 200-500ms per event (backend query)
- **Bandwidth per Update:** 50-200KB (full list)
- **Backend Queries per Hour (100 events):** ~200 list queries

### Target (After Optimizations)
- **List Refetch Frequency:** On mount + every 5s stale period
- **Average Response Time:** 0-50ms (memory cache patch)
- **Bandwidth per Update:** ~1-2KB (event payload only)
- **Backend Queries per Hour (100 events):** ~10 list queries + ~5 single-item fetches

**Estimated Improvements:**
- ⚡ **90%+ reduction** in list queries
- ⚡ **80%+ reduction** in network bandwidth
- ⚡ **75%+ reduction** in perceived latency

---

## 🎯 Success Criteria

Implementation is complete when:

1. ✅ All 12 event types publish correctly (add, update, delete, approve × 2 entities)
2. ✅ Frontend handles events with row-level cache patches (no broad invalidations)
3. ✅ Query settings optimized (staleTime > 0, refetchOnWindowFocus = false)
4. ✅ Single-item endpoints implemented and used for reconciliation
5. ✅ Admin metrics dashboard operational
6. ✅ Terminal logs show: "Published {event}" → "Event persisted" → "Long-poll returned N events" → No list queries
7. ✅ Browser network tab: Only POSTs + long-poll GETs, no list GETs triggered by events
8. ✅ UI updates feel instant (< 100ms perceived latency)
9. ✅ All tests pass (add/update/delete/approve for both entities)
10. ✅ Zero dropped events under normal load (check metrics)

---

## 📚 References

- **Guest Check-In Pub/Sub Guide:** `docs/GUEST_CHECKIN_PUBSUB_GUIDE.md`
- **Finance Event System Docs:** `backend/finance/EVENT_SYSTEM_DOCUMENTATION.md`
- **Finance Pub/Sub Guide V1:** `docs/FINANCE_PUBSUB_GUIDE.md`
- **Realtime Buffer Implementation:** `backend/finance/realtime_buffer.ts`
- **Frontend Hook:** `frontend/hooks/useFinanceRealtimeV2.ts`
- **Metrics Endpoint:** `backend/finance/event_monitoring.ts`

---

**Last Updated:** 2025-11-19  
**Status:** Analysis Complete, Ready for Implementation  
**Next Step:** User confirmation on clarification questions → Begin Priority 1 tasks

