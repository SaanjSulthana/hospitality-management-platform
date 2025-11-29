# Finance API Versioning Audit & Implementation Report

Generated: 2025-11-25

## Executive Summary

This document audits all finance endpoints against the API versioning migration plan (`docs/api-versioning-plan.md` and `docs/api/migration-to-v1.md`) and provides an implementation roadmap for remaining endpoints.

## Versioning Status by Category

### ✅ **Category A: Already Versioned (CRUD Operations)**

These endpoints already have BOTH legacy and v1 versions:

| Endpoint Name | Legacy Path | V1 Path | Status |
|--------------|-------------|---------|--------|
| `addExpense` | `/finance/expenses` | `/v1/finance/expenses` | ✅ Complete |
| `addExpenseV1` | - | `/v1/finance/expenses` | ✅ Complete |
| `updateExpense` | `/finance/expenses/:id` | `/v1/finance/expenses/:id` | ✅ Complete |
| `updateExpenseV1` | - | `/v1/finance/expenses/:id` | ✅ Complete |
| `deleteExpense` | `/finance/expenses/:id` | `/v1/finance/expenses/:id` | ✅ Complete |
| `deleteExpenseV1` | - | `/v1/finance/expenses/:id` | ✅ Complete |
| `getExpenseById` | `/finance/expenses/:id` | `/v1/finance/expenses/:id` | ✅ Complete |
| `getExpenseByIdV1` | - | `/v1/finance/expenses/:id` | ✅ Complete |
| `listExpenses` | `/finance/expenses` | `/v1/finance/expenses` | ✅ Complete |
| `listExpensesV1` | - | `/v1/finance/expenses` | ✅ Complete |
| `approveExpenseById` | `/finance/expenses/:id/approve` | `/v1/finance/expenses/:id/approve` | ✅ Complete |
| `approveExpenseByIdV1` | - | `/v1/finance/expenses/:id/approve` | ✅ Complete |
| `addRevenue` | `/finance/revenues` | - | ⚠️ Missing V1 |
| `updateRevenue` | `/finance/revenues/:id` | `/v1/finance/revenues/:id` | ✅ Complete |
| `updateRevenueV1` | - | `/v1/finance/revenues/:id` | ✅ Complete |
| `deleteRevenue` | `/finance/revenues/:id` | `/v1/finance/revenues/:id` | ✅ Complete |
| `deleteRevenueV1` | - | `/v1/finance/revenues/:id` | ✅ Complete |
| `getRevenueById` | `/finance/revenues/:id` | `/v1/finance/revenues/:id` | ✅ Complete |
| `getRevenueByIdV1` | - | `/v1/finance/revenues/:id` | ✅ Complete |
| `listRevenues` | `/finance/revenues` | `/v1/finance/revenues` | ✅ Complete |
| `listRevenuesV1` | - | `/v1/finance/revenues` | ✅ Complete |
| `approveRevenueById` | `/finance/revenues/:id/approve` | `/v1/finance/revenues/:id/approve` | ✅ Complete |
| `approveRevenueByIdV1` | - | `/v1/finance/revenues/:id/approve` | ✅ Complete |

### 🔴 **Category B: Missing V1 Versions (Core Operations)**

These core endpoints need v1 versions:

| Endpoint Name | Current Path | Required V1 Path | Priority |
|--------------|-------------|------------------|----------|
| `addRevenue` | `/finance/revenues` | `/v1/finance/revenues` | 🔴 HIGH |
| `approveRevenue` | `/finance/revenues/approve` | `/v1/finance/revenues/approve` | 🔴 HIGH |
| `approveExpense` | `/finance/expenses/approve` | `/v1/finance/expenses/approve` | 🔴 HIGH |
| `getFinancialSummary` | `/finance/summary` | `/v1/finance/summary` | 🟡 MEDIUM |
| `getFinancialSummaryV1` | `/v1/finance/summary` | - | ✅ Complete |

### 🔴 **Category C: Realtime & Subscription Endpoints**

| Endpoint Name | Current Path | Required V1 Path | Status |
|--------------|-------------|------------------|--------|
| `subscribeFinanceRealtime` | `/finance/realtime/subscribe` | `/v1/finance/realtime/subscribe` | ✅ Complete |
| `subscribeFinanceRealtimeV1` | `/v1/finance/realtime/subscribe` | - | ✅ Complete |
| `getFinanceRealtimeMetrics` | `/finance/realtime/metrics` | `/v1/finance/realtime/metrics` | 🔴 MISSING |
| `subscribeFinanceEvents` | `/finance/events/subscribe` | `/v1/finance/events/subscribe` | 🔴 MISSING |
| `getEventHistory` | `/finance/events/history` | `/v1/finance/events/history` | 🔴 MISSING |
| `getEventMetrics` | `/finance/events/metrics` | `/v1/finance/events/metrics` | 🔴 MISSING |
| `getEventMonitoring` | `/finance/events/monitoring` | `/v1/finance/events/monitoring` | 🔴 MISSING |

### 🟡 **Category D: Approval Management**

| Endpoint Name | Current Path | Required V1 Path | Status |
|--------------|-------------|------------------|--------|
| `getPendingApprovals` | `/finance/pending-approvals` | `/v1/finance/pending-approvals` | 🔴 MISSING |
| `grantDailyApproval` | `/finance/grant-daily-approval` | `/v1/finance/grant-daily-approval` | 🔴 MISSING |
| `getDailyApprovalStats` | `/finance/daily-approval-stats` | `/v1/finance/daily-approval-stats` | 🔴 MISSING |
| `getDailyApprovalSummary` | `/finance/daily-approval-summary` | `/v1/finance/daily-approval-summary` | 🔴 MISSING |
| `getTodayPendingTransactions` | `/finance/today-pending-transactions` | `/v1/finance/today-pending-transactions` | 🔴 MISSING |
| `bulkApproveTransactions` | `/finance/bulk-approve` | `/v1/finance/bulk-approve` | 🔴 MISSING |
| `checkDailyApproval` | `/finance/check-daily-approval` | `/v1/finance/check-daily-approval` | 🔴 MISSING |
| `resetApprovalStatus` | `/finance/reset-approval-status` | `/v1/finance/reset-approval-status` | 🔴 MISSING |

### 🟢 **Category E: Bank & Reconciliation**

| Endpoint Name | Current Path | Required V1 Path | Status |
|--------------|-------------|------------------|--------|
| `getBankAccounts` | TBD | `/v1/finance/bank-accounts` | 🔴 MISSING |
| `syncBankTransactions` | TBD | `/v1/finance/bank-sync` | 🔴 MISSING |
| `reconcileTransaction` | TBD | `/v1/finance/reconcile/:id` | 🔴 MISSING |

### 🟡 **Category F: Monitoring & Health (PUBLIC)**

These should be under `/v1/system/` per the migration plan:

| Endpoint Name | Current Path | Required V1 Path | Auth | Status |
|--------------|-------------|------------------|------|--------|
| `getEventValidationHealth` | `/finance/events/health` | `/v1/system/finance/events/health` | No | 🔴 MISSING |
| `getValidEventTypes` | `/finance/events/types` | `/v1/system/finance/events/types` | No | 🔴 MISSING |
| `dbHealthCheck` | `/finance/db-health-check` | `/v1/system/finance/db-health` | Yes | 🔴 MISSING |
| `healthCheckEndpoint` | `/finance/health` | `/v1/system/finance/health` | Yes | 🔴 MISSING |
| `quickHealthCheckEndpoint` | `/finance/quick-health` | `/v1/system/finance/quick-health` | No | 🔴 MISSING |

### 🔵 **Category G: Migration & Schema Management (ADMIN)**

| Endpoint Name | Current Path | Required V1 Path | Status |
|--------------|-------------|------------------|--------|
| `getMigrationStatusEndpoint` | `/finance/migration-status` | `/v1/finance/migrations/status` | 🔴 MISSING |
| `applyMigrationEndpoint` | `/finance/apply-migration/:version` | `/v1/finance/migrations/apply/:version` | 🔴 MISSING |
| `applyAllMigrationsEndpoint` | `/finance/apply-all-migrations` | `/v1/finance/migrations/apply-all` | 🔴 MISSING |
| `rollbackMigrationEndpoint` | `/finance/rollback-migration/:version` | `/v1/finance/migrations/rollback/:version` | 🔴 MISSING |
| `validateMigrationsEndpoint` | `/finance/validate-migrations` | `/v1/finance/migrations/validate` | 🔴 MISSING |
| `runMigration` | `/finance/run-migration` | `/v1/finance/migrations/run` | 🔴 MISSING |
| `runMigrationApi` | `/finance/run-migration-auth` | `/v1/finance/migrations/run-auth` | 🔴 MISSING |
| `runMigrationNoAuth` | `/finance/run-migration-no-auth` | `/v1/system/finance/migrations/run` | 🔴 MISSING |
| `runMigration13` | `/finance/run-migration-13` | `/v1/finance/migrations/run-13` | 🔴 MISSING |
| `runPaymentMigration` | `/finance/run-payment-migration` | `/v1/finance/migrations/payment` | 🔴 MISSING |
| `getSchemaStatus` | `/finance/schema-status` | `/v1/finance/schema/status` | 🔴 MISSING |
| `checkSchema` | `/finance/check-schema` | `/v1/system/finance/schema/check` | 🔴 MISSING |
| `checkSchemaComprehensive` | `/finance/check-schema-comprehensive` | `/v1/system/finance/schema/comprehensive` | 🔴 MISSING |
| `checkExpenseSchema` | `/finance/check-expense-schema` | `/v1/system/finance/schema/expense` | 🔴 MISSING |
| `checkDailyApprovalsSchema` | `/finance/check-daily-approvals-schema` | `/v1/system/finance/schema/daily-approvals` | 🔴 MISSING |
| `fixSchema` | `/finance/fix-schema` | `/v1/finance/schema/fix` | 🔴 MISSING |
| `fixDailyApprovalsTable` | `/finance/fix-daily-approvals-table` | `/v1/finance/schema/fix-daily-approvals` | 🔴 MISSING |
| `ensureSchema` | `/finance/ensure-schema` | `/v1/system/finance/schema/ensure` | 🔴 MISSING |
| `ensureDailyApprovalsTable` | `/finance/ensure-daily-approvals-table` | `/v1/system/finance/schema/ensure-daily-approvals` | 🔴 MISSING |
| `ensureNotificationsTable` | `/finance/ensure-notifications-table` | `/v1/system/finance/schema/ensure-notifications` | 🔴 MISSING |
| `addMissingColumns` | `/finance/add-missing-columns` | `/v1/finance/schema/add-columns` | 🔴 MISSING |
| `addReceiptFileIdColumns` | `/finance/add-receipt-file-id-columns` | `/v1/finance/schema/add-receipt-columns` | 🔴 MISSING |
| `addPerformanceIndexes` | `/finance/add-performance-indexes` | `/v1/system/finance/schema/add-indexes` | 🔴 MISSING |

### 🟣 **Category H: Database & Setup (ADMIN)**

| Endpoint Name | Current Path | Required V1 Path | Status |
|--------------|-------------|------------------|--------|
| `initDb` | `/finance/init-db` | `/v1/system/finance/db/init` | 🔴 MISSING |
| `forceInitDb` | `/finance/force-init-db` | `/v1/system/finance/db/force-init` | 🔴 MISSING |
| `setupDatabase` | `/finance/setup-database` | `/v1/system/finance/db/setup` | 🔴 MISSING |
| `quickSetup` | `/finance/quick-setup` | `/v1/system/finance/db/quick-setup` | 🔴 MISSING |
| `checkDbStatus` | `/finance/check-db-status` | `/v1/system/finance/db/status` | 🔴 MISSING |
| `checkDbSchemaDirect` | `/finance/check-db-schema-direct` | `/v1/system/finance/db/schema-direct` | 🔴 MISSING |
| `fixMigrationIssues` | `/finance/fix-migration-issues` | `/v1/finance/db/fix-migrations` | 🔴 MISSING |
| `checkPaymentColumns` | `/finance/check-payment-columns` | `/v1/system/finance/db/check-payment-columns` | 🔴 MISSING |

### 🟤 **Category I: Notifications & Alerts**

| Endpoint Name | Current Path | Required V1 Path | Status |
|--------------|-------------|------------------|--------|
| `checkNotifications` | `/finance/check-notifications` | `/v1/finance/notifications` | 🔴 MISSING |
| `markNotificationsRead` | TBD | `/v1/finance/notifications/mark-read` | 🔴 MISSING |
| `getAlertsEndpoint` | `/finance/alerts` | `/v1/finance/alerts` | 🔴 MISSING |
| `resolveAlertEndpoint` | `/finance/alerts/:id/resolve` | `/v1/finance/alerts/:id/resolve` | 🔴 MISSING |
| `clearResolvedAlertsEndpoint` | `/finance/alerts/clear-resolved` | `/v1/finance/alerts/clear-resolved` | 🔴 MISSING |

### ⚪ **Category J: Test & Debug Endpoints (Development Only)**

These should be disabled in production:

| Endpoint Name | Current Path | Keep in Prod? |
|--------------|-------------|---------------|
| `simpleTest` | `/finance/simple-test` | ❌ No |
| `verySimpleTest` | `/finance/very-simple-test` | ❌ No |
| `testSimple` | `/finance/test-simple` | ❌ No |
| `testDatabase` | `/finance/test-database` | ❌ No |
| `testDbSchema` | `/finance/test-db-schema` | ❌ No |
| `testDbTables` | `/finance/test-db-tables` | ❌ No |
| `testAddExpense` | `/finance/test-add-expense` | ❌ No |
| `testAddRevenue` | `/finance/test-add-revenue` | ❌ No |
| `testMinimalAdd` | `/finance/test-minimal-add` | ❌ No |
| `testSimpleRevenue` | `/finance/test-simple-revenue` | ❌ No |
| `testPaymentMode` | `/finance/test-payment-mode` | ❌ No |
| `performanceTest` | `/finance/performance-test` | ❌ No |
| `queryPerformanceTest` | `/finance/query-performance-test` | ❌ No |
| `performanceReportEndpoint` | `/finance/performance-report` | ❌ No |
| `debugDailyApproval` | `/finance/debug-daily-approval` | ❌ No |
| `debugTransactionStatus` | `/finance/debug-transaction-status` | ❌ No |
| `addRevenueMinimal` | `/finance/add-revenue-minimal` | ❌ No |

---

## Summary Statistics

| Category | Total | Versioned | Missing V1 | % Complete |
|----------|-------|-----------|------------|------------|
| **CRUD Operations** | 22 | 21 | 1 | 95% |
| **Core Operations** | 5 | 2 | 3 | 40% |
| **Realtime/Events** | 7 | 2 | 5 | 29% |
| **Approvals** | 8 | 0 | 8 | 0% |
| **Bank/Reconciliation** | 3 | 0 | 3 | 0% |
| **Monitoring/Health** | 5 | 0 | 5 | 0% |
| **Migrations/Schema** | 25 | 0 | 25 | 0% |
| **Database/Setup** | 8 | 0 | 8 | 0% |
| **Notifications/Alerts** | 5 | 0 | 5 | 0% |
| **Test/Debug** | 15 | 0 | N/A | N/A |
| **TOTAL (Prod)** | **88** | **25** | **63** | **28%** |

---

## Implementation Priority

### 🔴 **Phase 1: Critical (Week 1) - 11 endpoints**

Core business operations that frontend depends on:

1. `addRevenue` → `/v1/finance/revenues`
2. `approveRevenue` → `/v1/finance/revenues/approve`
3. `approveExpense` → `/v1/finance/expenses/approve`
4. `getPendingApprovals` → `/v1/finance/pending-approvals`
5. `grantDailyApproval` → `/v1/finance/grant-daily-approval`
6. `getDailyApprovalStats` → `/v1/finance/daily-approval-stats`
7. `getDailyApprovalSummary` → `/v1/finance/daily-approval-summary`
8. `getTodayPendingTransactions` → `/v1/finance/today-pending-transactions`
9. `bulkApproveTransactions` → `/v1/finance/bulk-approve`
10. `checkDailyApproval` → `/v1/finance/check-daily-approval`
11. `resetApprovalStatus` → `/v1/finance/reset-approval-status`

### 🟡 **Phase 2: Important (Week 2) - 12 endpoints**

Realtime, events, and notifications:

1. `getFinanceRealtimeMetrics` → `/v1/finance/realtime/metrics`
2. `subscribeFinanceEvents` → `/v1/finance/events/subscribe`
3. `getEventHistory` → `/v1/finance/events/history`
4. `getEventMetrics` → `/v1/finance/events/metrics`
5. `getEventMonitoring` → `/v1/finance/events/monitoring`
6. `checkNotifications` → `/v1/finance/notifications`
7. `markNotificationsRead` → `/v1/finance/notifications/mark-read`
8. `getAlertsEndpoint` → `/v1/finance/alerts`
9. `resolveAlertEndpoint` → `/v1/finance/alerts/:id/resolve`
10. `clearResolvedAlertsEndpoint` → `/v1/finance/alerts/clear-resolved`
11. `getBankAccounts` → `/v1/finance/bank-accounts`
12. `syncBankTransactions` → `/v1/finance/bank-sync`

### 🟢 **Phase 3: System (Week 3) - 40 endpoints**

Schema, migrations, monitoring, health (system operations):

**Monitoring/Health (5):**
- Move to `/v1/system/finance/...`

**Migrations (17):**
- Reorganize to `/v1/finance/migrations/...`

**Schema (13):**
- Reorganize to `/v1/finance/schema/...` and `/v1/system/finance/schema/...`

**Database/Setup (8):**
- Move to `/v1/system/finance/db/...`

---

## Implementation Template

### For Standard CRUD Endpoint:

```typescript
// Example: add_revenue.ts

// LEGACY (keep during deprecation)
export const addRevenue = api(
  { auth: true, expose: true, method: "POST", path: "/finance/revenues" },
  addRevenueHandler
);

// V1 (new)
export const addRevenueV1 = api(
  { auth: true, expose: true, method: "POST", path: "/v1/finance/revenues" },
  addRevenueHandler
);
```

### For System/Monitoring Endpoint:

```typescript
// Example: db_health_check.ts

// LEGACY (keep during deprecation)
export const dbHealthCheck = api(
  { auth: true, expose: true, method: "GET", path: "/finance/db-health-check" },
  dbHealthCheckHandler
);

// V1 (new - under system namespace)
export const dbHealthCheckV1 = api(
  { auth: true, expose: true, method: "GET", path: "/v1/system/finance/db-health" },
  dbHealthCheckHandler
);
```

### For Test/Debug Endpoint:

```typescript
// Add environment check
import { getEnv } from "~encore/internal/utils/env";

export const simpleTest = api(
  { auth: false, expose: true, method: "GET", path: "/finance/simple-test" },
  async () => {
    // Disable in production
    if (getEnv() === 'production') {
      throw APIError.permissionDenied("Test endpoints disabled in production");
    }
    // ... test logic
  }
);
```

---

## Frontend Integration Updates Required

Update `frontend/src/utils/api-standardizer.ts`:

```typescript
export const API_ENDPOINTS = {
  __PREFIX: '/v1',

  // Finance - Already correct
  EXPENSES: '/v1/finance/expenses',
  REVENUES: '/v1/finance/revenues',
  PENDING_APPROVALS: '/v1/finance/pending-approvals',
  GRANT_APPROVAL: '/v1/finance/grant-daily-approval',
  
  // Finance - Need to add
  APPROVE_REVENUE: '/v1/finance/revenues/approve',
  APPROVE_EXPENSE: '/v1/finance/expenses/approve',
  DAILY_APPROVAL_STATS: '/v1/finance/daily-approval-stats',
  DAILY_APPROVAL_SUMMARY: '/v1/finance/daily-approval-summary',
  TODAY_PENDING: '/v1/finance/today-pending-transactions',
  BULK_APPROVE: '/v1/finance/bulk-approve',
  FINANCE_REALTIME_METRICS: '/v1/finance/realtime/metrics',
  FINANCE_EVENTS_SUBSCRIBE: '/v1/finance/events/subscribe',
  FINANCE_NOTIFICATIONS: '/v1/finance/notifications',
  FINANCE_ALERTS: '/v1/finance/alerts',
  
  // Bank
  BANK_ACCOUNTS: '/v1/finance/bank-accounts',
  BANK_SYNC: '/v1/finance/bank-sync',
  RECONCILE: (id: number) => `/v1/finance/reconcile/${id}`,
} as const;
```

---

## CI/CD Integration

Add to `.github/workflows/api-versioning-check.yml`:

```yaml
name: API Versioning Check

on: [push, pull_request]

jobs:
  check-versioning:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Check all api() paths are versioned
        run: |
          # Find unversioned paths (excluding test files)
          if grep -r 'path:\s*["'\'']\/finance\/' backend/finance/*.ts | grep -v test | grep -v '/v1/'; then
            echo "❌ Found unversioned finance endpoints"
            exit 1
          fi
          echo "✅ All finance endpoints are versioned"
```

---

## Next Steps

1. ✅ **Review this audit** with team
2. 🔴 **Implement Phase 1** (11 critical endpoints) - Week 1
3. 🟡 **Implement Phase 2** (12 important endpoints) - Week 2
4. 🟢 **Implement Phase 3** (40 system endpoints) - Week 3
5. 📱 **Update frontend** API client with all new v1 paths
6. 🧪 **Update tests** to use v1 endpoints
7. 📚 **Update API documentation** with version changes
8. 🚀 **Deploy with legacy compatibility** enabled
9. 📊 **Monitor legacy endpoint usage** for 60 days
10. 🗑️ **Remove legacy endpoints** after migration window

---

## Risk Mitigation

1. **Dual routing** keeps legacy paths working during migration
2. **Deprecation headers** inform clients of upcoming changes
3. **Monitoring** tracks legacy usage to identify lagging clients
4. **60-day window** provides ample time for migration
5. **Test suite** validates both legacy and v1 paths during transition

---

**Status**: 📊 25/88 endpoints versioned (28% complete)
**ETA**: ⏱️ 3 weeks for full implementation
**Risk**: 🟢 Low (with dual routing and deprecation strategy)

