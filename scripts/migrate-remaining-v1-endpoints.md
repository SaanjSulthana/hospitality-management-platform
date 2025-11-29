# Migration Script for Remaining /v1 Endpoints

## Status Summary
- ✅ Frontend: /v1 base path configured
- ✅ Express Gateway: Dual routing complete (13 routes)
- ✅ Properties: 5/5 endpoints migrated (create, update, list, delete, occupancy)
- ⏳ Tasks: 0/~10 endpoints (NEXT)
- ⏳ Users: 0/~8 endpoints
- ⏳ Finance: 3/~20 endpoints (need remaining CRUD)
- ⏳ Staff: 1/~40 endpoints (need core operations)

## Pattern to Follow

For each endpoint file:

1. Add import: `import { v1Path } from "../shared/http";`
2. Extract handler function from API definition
3. Create dual exports (legacy + v1)

Example transformation:
```typescript
// BEFORE:
export const someEndpoint = api<Request, Response>(
  { auth: true, expose: true, method: "GET", path: "/domain/resource" },
  async (req) => {
    // handler logic
  }
);

// AFTER:
async function someEndpointHandler(req: Request): Promise<Response> {
  // handler logic (unchanged)
}

// Legacy path
export const someEndpoint = api<Request, Response>(
  { auth: true, expose: true, method: "GET", path: "/domain/resource" },
  someEndpointHandler
);

// Versioned path
export const someEndpointV1 = api<Request, Response>(
  { auth: true, expose: true, method: "GET", path: v1Path("/domain/resource") },
  someEndpointHandler
);
```

## Files to Migrate

### Tasks Domain (Priority 1)
- backend/tasks/create.ts
- backend/tasks/list.ts
- backend/tasks/update.ts
- backend/tasks/delete.ts
- backend/tasks/assign.ts
- backend/tasks/update_status.ts
- backend/tasks/update_hours.ts
- backend/tasks/add_attachment.ts
- backend/tasks/images.ts (4 endpoints)

### Users Domain (Priority 2)
- backend/users/create.ts
- backend/users/list.ts
- backend/users/get.ts
- backend/users/update.ts
- backend/users/delete.ts
- backend/users/assign_properties.ts
- backend/users/get_properties.ts
- backend/users/update_activity.ts

### Finance Domain (Priority 3 - Complete CRUD)
Already done: list_revenues.ts, list_expenses.ts, subscribe_realtime.ts
Need:
- backend/finance/add_revenue.ts
- backend/finance/add_expense.ts
- backend/finance/get_revenue_by_id.ts
- backend/finance/get_expense_by_id.ts
- backend/finance/update_revenue.ts
- backend/finance/update_expense.ts
- backend/finance/delete_revenue.ts
- backend/finance/delete_expense.ts
- backend/finance/approve_revenue.ts
- backend/finance/approve_expense.ts
- backend/finance/approve_revenue_by_id.ts
- backend/finance/approve_expense_by_id.ts
- backend/finance/financial_summary.ts
- backend/finance/pending_approvals.ts
- backend/finance/realtime_metrics.ts (already has v1 - verify)
- backend/finance/events_store.ts (2 endpoints)
- backend/finance/event_monitoring.ts (3 endpoints)

### Staff Domain (Priority 4 - Core Operations Only)
Already done: export_delegates.ts
Focus on core CRUD:
- backend/staff/create.ts
- backend/staff/list.ts
- backend/staff/update.ts
- backend/staff/delete.ts
- backend/staff/assign_property.ts

## Testing Checklist
After migration:
1. Run CI check: `npm run ci:check-versioned-paths`
2. Test one endpoint per domain with curl
3. Verify deprecation headers on legacy paths
4. Test frontend integration for one page

## OpenAPI Generation
After all migrations:
```bash
mkdir -p docs/api/v1
encore gen openapi > docs/api/v1/openapi.yaml
```

