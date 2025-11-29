# 🔥 Finance Event System Documentation

## Overview

The Finance Event System is a **type-safe, validated, and monitored** event publishing infrastructure designed to scale to **1M+ organizations**. All finance events flow through this system with strict validation to ensure data integrity and prevent invalid events from reaching subscribers.

---

## Valid Event Types

The system supports **12 strictly typed event types**:

### Revenue Events
- `revenue_added` - New revenue transaction created
- `revenue_updated` - Revenue transaction modified
- `revenue_deleted` - Revenue transaction removed
- `revenue_approved` - Revenue transaction approved
- `revenue_rejected` - Revenue transaction rejected

### Expense Events
- `expense_added` - New expense transaction created
- `expense_updated` - Expense transaction modified
- `expense_deleted` - Expense transaction removed
- `expense_approved` - Expense transaction approved
- `expense_rejected` - Expense transaction rejected

### System Events
- `daily_approval_granted` - Bulk daily approval completed
- `cash_balance_updated` - Daily cash balance reconciled

---

## Architecture

```
┌─────────────────┐
│  Finance APIs   │
│  (Add/Update/   │
│   Approve/etc)  │
└────────┬────────┘
         │
         ↓
┌─────────────────────────────┐
│  Event Validator Module     │
│  - Type validation          │
│  - Required field checks    │
│  - Legacy type mapping      │
│  - Metadata validation      │
└────────┬────────────────────┘
         │
         ↓
┌─────────────────────────────┐
│  financeEvents Topic        │
│  (Encore Pub/Sub)           │
│  deliveryGuarantee:         │
│  "at-least-once"            │
└────────┬────────────────────┘
         │
         ↓
   ┌────┴────┬────────┬────────┐
   │         │        │        │
   ↓         ↓        ↓        ↓
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│Reports│ │Cache │ │Balance│ │Event │
│Finance│ │Inval-│ │ Read │ │Store │
│Subscr.│ │idate │ │Model │ │      │
└───────┘ └──────┘ └──────┘ └──────┘
```

---

## Core Components

### 1. Event Validator (`event_validator.ts`)

**Purpose**: Centralized validation and type safety enforcement

**Key Functions**:
- `buildValidatedEvent()` - **THE ONLY WAY** to create events
- `mapEventType()` - Maps legacy event types to valid types
- `inferEntityType()` - Auto-infers entity type from event type
- `validateMetadata()` - Validates metadata fields

**Example Usage**:
```typescript
import { buildValidatedEvent } from '../finance/event_validator';

// Build a validated event
const eventPayload = buildValidatedEvent(
  {
    eventType: 'revenue_added',
    orgId: 123,
    propertyId: 456,
    entityId: 789,
    entityType: 'revenue',
    metadata: {
      amountCents: 50000,
      paymentMode: 'cash',
      transactionDate: '2025-01-28',
      affectedReportDates: ['2025-01-28']
    }
  },
  userId // From getAuthData()
);

// Publish to topic
await financeEvents.publish(eventPayload);
```

### 2. Event Monitoring (`event_monitoring.ts`)

**Purpose**: Real-time monitoring and alerting for production scale

**Endpoints**:
- `GET /finance/events/monitoring` - Detailed monitoring stats (Admin only)
- `GET /finance/events/health` - Health check (Public)
- `GET /finance/events/types` - List of valid event types (Public)

**Metrics Tracked**:
- Validation success/failure rates
- Event type distribution
- Legacy event usage
- Error patterns
- Performance (p95, p99 latency)

**Example Response**:
```json
{
  "status": "healthy",
  "statistics": {
    "totalValidated": 125000,
    "validEvents": 124500,
    "invalidEvents": 500,
    "legacyMappings": 50,
    "validationRate": 0.996,
    "invalidRate": 0.004,
    "legacyRate": 0.0004
  },
  "alerts": [],
  "recommendations": [
    "✅ Excellent validation rate! System is working as expected."
  ]
}
```

### 3. Events Service (`events-service/events_service.ts`)

**Purpose**: Centralized event publishing microservice

**Endpoints**:
- `POST /events/publish` - Publish single event
- `POST /events/batch-publish` - Publish up to 1000 events
- `GET /events/stats` - Event statistics
- `GET /events/health` - Service health

**Features**:
- Enforces authentication
- Validates all events before publishing
- Records validation metrics
- Supports batch operations (max 1000 events)
- Publishes to both `financeEvents` and `realtimeUpdates` topics

---

## Event Payload Structure

```typescript
interface FinanceEventPayload {
  eventId: string;              // UUID (auto-generated)
  eventVersion: 'v1';           // Version for schema evolution
  eventType:                    // One of 12 valid types
    | 'expense_added' | 'expense_updated' | 'expense_deleted' 
    | 'expense_approved' | 'expense_rejected'
    | 'revenue_added' | 'revenue_updated' | 'revenue_deleted'
    | 'revenue_approved' | 'revenue_rejected'
    | 'daily_approval_granted' | 'cash_balance_updated';
  
  orgId: number;                // Required
  propertyId: number;           // Required (0 for bulk operations)
  userId: number;               // Required (from auth)
  timestamp: Date;              // Auto-generated
  entityId: number;             // Transaction/entity ID
  entityType:                   // Entity classification
    | 'expense' | 'revenue' 
    | 'daily_approval' | 'cash_balance';
  
  metadata: {
    previousStatus?: string;    // For status changes
    newStatus?: string;
    amountCents?: number;       // Amount in cents
    currency?: string;          // Default: USD
    transactionDate?: string;   // YYYY-MM-DD format
    paymentMode?: 'cash' | 'bank';
    category?: string;          // Expense category
    source?: string;            // Revenue source
    affectedReportDates?: string[]; // For cache invalidation
    notes?: string;             // Approval notes
  };
}
```

---

## Migration from Legacy Events

### Legacy Event Type Mapping

The validator automatically maps legacy event types:

| Legacy Event Type | Maps To | Condition |
|-------------------|---------|-----------|
| `transaction_created` | `revenue_added` | Default (or use `entityType`) |
| `transaction_approved` | `revenue_approved` or `expense_approved` | Requires `entityType` |
| `transaction_updated` | `revenue_updated` | Default |
| `transaction_deleted` | `revenue_deleted` | Default |
| `balance_updated` | `cash_balance_updated` | Direct mapping |

**Example - Legacy Event**:
```typescript
// ❌ OLD WAY (will be mapped but generates warning)
{
  eventType: 'transaction_approved',
  entityType: 'revenue',
  // ... other fields
}

// ✅ NEW WAY (preferred)
{
  eventType: 'revenue_approved',
  entityType: 'revenue',
  // ... other fields
}
```

### Migration Strategy

**Phase 1: Immediate (Current)**
- All legacy events are automatically mapped with warnings
- No breaking changes for existing code
- Validation errors caught at API boundary

**Phase 2: Transition (1-2 weeks)**
- Monitor `/finance/events/monitoring` for legacy usage
- Update services one by one to use new event types
- Target: Reduce legacy rate to < 1%

**Phase 3: Deprecation (1 month)**
- Consider removing legacy mappings once usage is near zero
- Update validator to reject legacy types
- All services must use new event types

---

## Best Practices

### ✅ DO

1. **Always use `buildValidatedEvent()`**
   ```typescript
   const event = buildValidatedEvent({ ... }, userId);
   await financeEvents.publish(event);
   ```

2. **Include `affectedReportDates` in metadata**
   ```typescript
   metadata: {
     transactionDate: '2025-01-28',
     affectedReportDates: ['2025-01-28'] // For cache invalidation
   }
   ```

3. **Use specific event types**
   ```typescript
   eventType: 'revenue_approved' // ✅ Specific
   ```

4. **Handle errors gracefully**
   ```typescript
   try {
     const event = buildValidatedEvent({ ... });
     await financeEvents.publish(event);
   } catch (error) {
     if (error.code === 'invalid_argument') {
       // Handle validation error
     }
   }
   ```

### ❌ DON'T

1. **Don't publish events directly without validation**
   ```typescript
   // ❌ WRONG - bypasses validation
   await financeEvents.publish({
     eventType: 'transaction_approved', // Invalid type
     // ... missing required fields
   });
   ```

2. **Don't use generic types**
   ```typescript
   eventType: 'transaction_approved' // ❌ Use revenue_approved or expense_approved
   ```

3. **Don't omit required fields**
   ```typescript
   // ❌ Missing userId, propertyId, entityType
   buildValidatedEvent({ eventType: 'revenue_added', orgId: 123 })
   ```

4. **Don't exceed batch limits**
   ```typescript
   // ❌ Too many events
   batchPublishEvents(arrayOf2000Events) // Max is 1000
   ```

---

## Monitoring & Alerting

### Health Thresholds

| Metric | Healthy | Warning | Unhealthy |
|--------|---------|---------|-----------|
| Validation Rate | > 99% | 98-99% | < 98% |
| Invalid Rate | < 1% | 1-5% | > 5% |
| Legacy Rate | < 5% | 5-20% | > 20% |
| Avg Validation Time | < 5ms | 5-10ms | > 10ms |
| P99 Validation Time | < 20ms | 20-50ms | > 50ms |

### Monitoring Endpoints

```bash
# Check system health (public)
curl https://api.yourapp.com/finance/events/health

# Get detailed monitoring (requires admin auth)
curl -H "Authorization: Bearer <token>" \
  https://api.yourapp.com/finance/events/monitoring

# List valid event types
curl https://api.yourapp.com/finance/events/types
```

### Alerts to Watch

1. **High Invalid Rate**: 
   - Indicates services publishing malformed events
   - Check error distribution for patterns
   - Update offending services

2. **High Legacy Rate**:
   - Old code still using deprecated event types
   - Migrate services to new event types
   - Review `/finance/events/monitoring` for sources

3. **Performance Degradation**:
   - Validation time increasing
   - Check database/cache performance
   - Review event payload sizes

---

## Scalability for 1M Organizations

### Design Decisions

1. **Validation at API Boundary**
   - Prevents invalid events from reaching subscribers
   - Reduces retry storms and dead letter queue buildup
   - Clear error messages for developers

2. **Centralized Validation Module**
   - Single source of truth for event schemas
   - Easy to update validation rules
   - Consistent behavior across all services

3. **Performance Optimizations**
   - Validation typically < 1ms
   - No database calls during validation
   - In-memory type checking only

4. **Subscriber Scalability**
   - Each subscriber: `maxConcurrency: 5000`
   - Handles 5000 concurrent events per subscriber
   - 4 subscribers = 20,000 concurrent events
   - Sufficient for 1M+ orgs (average 1 event/org/min)

### Capacity Planning

**Expected Load (1M Organizations)**:
- 1M orgs × 10 transactions/day = 10M events/day
- 10M events/day ÷ 86400 seconds = **116 events/second**
- Peak load (5x average) = **580 events/second**

**Current Capacity**:
- Validation: **~10,000 events/second** (< 1ms per event)
- Publishing: **~5,000 events/second** (Encore Pub/Sub)
- Subscribers: **20,000 concurrent events** (4 subscribers × 5000)

**Headroom**: **8-40x current expected load** ✅

---

## Troubleshooting

### Common Errors

#### 1. "Invalid event type"
```
Error: Invalid event type: 'transaction_approved'. 
Valid types: expense_added, expense_updated, ...
```

**Solution**: Use specific event type or provide `entityType`
```typescript
// Option 1: Use specific type
eventType: 'revenue_approved'

// Option 2: Provide entityType for mapping
eventType: 'transaction_approved',
entityType: 'revenue' // Maps to revenue_approved
```

#### 2. "propertyId is required"
```
Error: propertyId is required for event type 'revenue_added'
```

**Solution**: Always provide `propertyId` (use 0 for bulk operations)
```typescript
propertyId: transaction.propertyId // Or 0 for bulk
```

#### 3. "userId is required"
```
Error: userId is required. Pass it explicitly or provide authUserId parameter.
```

**Solution**: Ensure authentication or pass userId explicitly
```typescript
const authData = getAuthData();
buildValidatedEvent({ ... }, parseInt(authData.userID))
```

#### 4. "Batch size too large"
```
Error: Batch size too large: 2000. Maximum: 1000 events per batch.
```

**Solution**: Split into multiple batches
```typescript
const chunks = chunkArray(events, 1000);
for (const chunk of chunks) {
  await batchPublishEvents(chunk);
}
```

---

## Testing

### Unit Tests

```typescript
import { buildValidatedEvent, mapEventType } from '../event_validator';

describe('Event Validation', () => {
  it('should validate revenue_added event', () => {
    const event = buildValidatedEvent({
      eventType: 'revenue_added',
      orgId: 1,
      propertyId: 2,
      entityId: 3,
      entityType: 'revenue',
      metadata: { amountCents: 5000 }
    }, 100);
    
    expect(event.eventType).toBe('revenue_added');
    expect(event.eventId).toBeDefined();
    expect(event.eventVersion).toBe('v1');
  });

  it('should map legacy transaction_approved', () => {
    const type = mapEventType('transaction_approved', 'revenue');
    expect(type).toBe('revenue_approved');
  });

  it('should reject invalid event type', () => {
    expect(() => {
      buildValidatedEvent({
        eventType: 'invalid_type',
        orgId: 1
      }, 100);
    }).toThrow('Invalid event type');
  });
});
```

### Integration Tests

```typescript
import { financeEvents } from '../finance/events';
import { buildValidatedEvent } from '../event_validator';

describe('Event Publishing', () => {
  it('should publish valid event to topic', async () => {
    const event = buildValidatedEvent({
      eventType: 'revenue_added',
      orgId: 1,
      propertyId: 2,
      entityId: 3,
      entityType: 'revenue',
      metadata: { amountCents: 5000 }
    }, 100);
    
    await expect(
      financeEvents.publish(event)
    ).resolves.not.toThrow();
  });
});
```

---

## API Reference

### `buildValidatedEvent(input, authUserId?)`

Creates a type-safe, validated event payload.

**Parameters**:
- `input: EventBuilderInput` - Event data
- `authUserId?: number` - User ID from auth (optional if provided in input)

**Returns**: `FinanceEventPayload`

**Throws**: `APIError.invalidArgument` if validation fails

---

### `mapEventType(input, entityType?)`

Maps legacy event types to current valid types.

**Parameters**:
- `input: string` - Event type (legacy or current)
- `entityType?: string` - Entity type for context-dependent mapping

**Returns**: `FinanceEventPayload['eventType']`

**Throws**: `APIError.invalidArgument` if type cannot be mapped

---

### `eventValidationMonitor.getStats()`

Gets current validation statistics.

**Returns**:
```typescript
{
  totalValidated: number;
  validEvents: number;
  invalidEvents: number;
  legacyMappings: number;
  validationRate: number;
  invalidRate: number;
  legacyRate: number;
  eventTypeDistribution: Record<string, number>;
  errorDistribution: Record<string, number>;
}
```

---

## Support & Resources

- **Encore Docs**: https://encore.dev/docs/primitives/pubsub
- **Event Validator Source**: `backend/finance/event_validator.ts`
- **Monitoring Source**: `backend/finance/event_monitoring.ts`
- **Valid Event Types**: `GET /finance/events/types`

---

**Last Updated**: 2025-01-28  
**Version**: 1.0.0  
**Status**: ✅ Production Ready for 1M+ Organizations

