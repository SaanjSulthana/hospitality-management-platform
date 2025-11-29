# Realtime Implementation Quick Start

> **⚡ Fast-track guide** – For detailed explanations, see [REALTIME_IMPLEMENTATION_TEMPLATE.md](./REALTIME_IMPLEMENTATION_TEMPLATE.md)

---

## 📝 30-Second Setup

**Before you start, define:**

```bash
DOMAIN="tasks"           # e.g., tasks, staff, users, analytics
PAGE="TasksPage"         # e.g., TasksPage, StaffPage
ENTITY="Task"            # e.g., Task, StaffMember, User
ENTITY_ID="taskId"       # e.g., taskId, staffId, userId
```

---

## 🚀 5-Step Implementation

### Step 1: Backend Buffer (10 min)

Create `backend/<domain>/realtime_buffer.ts`:

```typescript
// Copy from: backend/finance/realtime_buffer.ts
// Replace: finance → <domain>, FinanceEvent → <Domain>Event
```

### Step 2: Backend Subscriber (5 min)

Create `backend/<domain>/realtime_subscriber.ts`:

```typescript
import { Subscription } from "encore.dev/pubsub";
import { <Domain>EventsTopic } from './events';
import { pushEvent } from './realtime_buffer';

export const realtimeSubscriber = new Subscription(
  <Domain>EventsTopic,
  "<domain>-realtime-subscriber",
  {
    handler: async (event) => {
      pushEvent(event.orgId, event.propertyId, event);
    },
  }
);
```

### Step 3: Backend Endpoints (10 min)

Create `backend/<domain>/subscribe_realtime.ts`:

```typescript
// Copy from: backend/finance/subscribe_realtime.ts
// Replace: finance → <domain>
```

Create `backend/<domain>/realtime_metrics.ts`:

```typescript
// Copy from: backend/finance/realtime_metrics.ts
// Replace: finance → <domain>
```

### Step 4: Frontend Hook (15 min)

Create `frontend/hooks/use<Domain>RealtimeV2.ts`:

```typescript
// Copy from: frontend/hooks/useFinanceRealtimeV2.ts
// Replace: finance → <domain>
// Update: URL path to /<domain>/realtime/subscribe
```

### Step 5: Page Integration (10 min)

In `frontend/pages/<Page>Page.tsx`:

```typescript
import { use<Domain>RealtimeV2 } from '@/hooks/use<Domain>RealtimeV2';

export default function <Page>Page() {
  const queryClient = useQueryClient();
  
  const handleEvents = useCallback((events) => {
    events.forEach(event => {
      switch (event.eventType) {
        case '<Domain>Created':
          queryClient.setQueryData(['<domain>', 'list'], old => 
            [event.payload, ...(old || [])]
          );
          break;
        case '<Domain>Updated':
          queryClient.setQueryData(['<domain>', 'list'], old =>
            old?.map(item => item.<entityId> === event.payload.<entityId> 
              ? event.payload : item
            )
          );
          break;
        case '<Domain>Deleted':
          queryClient.setQueryData(['<domain>', 'list'], old =>
            old?.filter(item => item.<entityId> !== event.payload.<entityId>)
          );
          break;
      }
    });
  }, [queryClient]);
  
  const { isConnected } = use<Domain>RealtimeV2({
    propertyId,
    onEvents: handleEvents,
  });
  
  // Rest of your page...
}
```

---

## ✅ Quick Test

1. **Open 5 tabs** → Only 1 should show `/<domain>/realtime/subscribe` in Network tab
2. **Create entity in Tab 1** → Should appear in all tabs within 2s
3. **Logout in Tab 1** → All tabs stop polling within 200ms
4. **Check metrics:** `curl http://localhost:4000/<domain>/realtime/metrics`

---

## 🔧 Dev Proxy

Add to `frontend/vite.config.ts`:

```typescript
server: {
  proxy: {
    '/<domain>/realtime': {
      target: 'http://localhost:4000',
      changeOrigin: true,
    },
  },
},
```

---

## 🎯 Performance Checklist

- [ ] Only 1 long-poll per session (not per tab)
- [ ] Events deliver in <2 seconds
- [ ] Logout stops all tabs in <200ms
- [ ] Aggregate queries fire ≤1/sec during bursts
- [ ] No "jwt malformed" errors

---

## 📚 Next Steps

- **Detailed guide:** [REALTIME_IMPLEMENTATION_TEMPLATE.md](./REALTIME_IMPLEMENTATION_TEMPLATE.md)
- **Architecture:** [NETWORKING_AND_REALTIME_IMPROVEMENTS.md](./NETWORKING_AND_REALTIME_IMPROVEMENTS.md)
- **Finance example:** `backend/finance/`, `frontend/hooks/useFinanceRealtimeV2.ts`

---

## 🆘 Common Issues

| Issue | Quick Fix |
|-------|-----------|
| Multiple tabs polling | Check leader election in browser console |
| "jwt malformed" | Guard: `if (token && token.length > 0)` before adding Authorization header |
| Events not appearing | Verify BroadcastChannel name: `'<domain>-events'` |
| High 401s | Ensure refresh mutex in AuthContext (already global) |
| Dropped events | Increase `MAX_BUFFER_SIZE` in buffer.ts |

---

**Total Time: ~50 minutes** | **Complexity: Medium** | **Impact: High**

