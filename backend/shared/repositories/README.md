# Partition-Aware Repository Layer

## Overview

This repository layer provides automatic partition routing for finance and reports data, enabling seamless switching between legacy and partitioned tables based on the `USE_PARTITIONED_TABLES` configuration flag.

## Architecture

### Core Components

1. **BaseRepository** (`base_repository.ts`)
   - Foundation class providing partition routing logic
   - Table name resolution (legacy vs partitioned)
   - Query builder utilities
   - Routing decision logging

2. **FinanceRepository** (`finance_repository.ts`)
   - Handles revenues and expenses tables
   - Methods: insert, get, update, delete, sum operations
   - Automatic partition routing based on configuration

3. **ReportsRepository** (`reports_repository.ts`)
   - Handles daily_cash_balances table
   - Methods: upsert, get, update, delete, count operations
   - Date range queries with partition awareness

## Usage

### In Services

```typescript
import { FinanceRepository } from '../../shared/repositories/finance_repository';
import { financeDB } from '../../finance/db';

class FinanceService {
  private financeRepo: FinanceRepository;

  constructor() {
    this.financeRepo = new FinanceRepository(financeDB);
  }

  async addRevenue(data) {
    // Repository automatically routes to correct table
    const inserted = await this.financeRepo.insertRevenue({
      org_id: data.orgId,
      property_id: data.propertyId,
      amount_cents: data.amount,
      // ... other fields
    });
    
    return inserted;
  }
}
```

### Explicit Partition Control

```typescript
// Force use of legacy table
const revenue = await financeRepo.insertRevenue(data, false);

// Force use of partitioned table
const revenue = await financeRepo.insertRevenue(data, true);

// Use configuration default (recommended)
const revenue = await financeRepo.insertRevenue(data);
```

## Configuration

### Environment Variables

```bash
# Enable partitioned tables globally
export USE_PARTITIONED_TABLES=true

# Enable partition routing logs for debugging
export LOG_PARTITION_ROUTING=true
```

### Runtime Configuration

Edit `backend/config/runtime.ts`:

```typescript
export const DatabaseConfig = {
  usePartitionedTables: process.env.USE_PARTITIONED_TABLES === 'true',
  // ... other settings
};
```

## Testing

### Integration Tests

Location: `__tests__/partition_routing.integration.test.ts`

Tests verify:
- Correct table targeting (legacy vs partitioned)
- CRUD operations in both modes
- Data consistency with dual-write triggers
- Query routing based on flags

### Service Tests

Locations:
- `backend/services/__tests__/finance_service.dual_mode.test.ts`
- `backend/services/__tests__/reports_service.dual_mode.test.ts`

Tests verify:
- Service functionality in both modes
- Data parity with dual-write triggers
- Performance and error handling

### Running Tests

```bash
# Run all partition tests in legacy mode
USE_PARTITIONED_TABLES=false npm test partition_routing

# Run all partition tests in partitioned mode
USE_PARTITIONED_TABLES=true npm test partition_routing

# Run dual-mode test suite (both modes)
./scripts/test_dual_mode.sh
```

## Migration Strategy

### Phase 1: Dual-Write Mode (Current)

- Legacy tables are primary
- Triggers write to partitioned tables automatically
- Repositories use legacy tables by default
- Both table sets stay in sync

### Phase 2: Pilot Testing

- Select pilot organizations
- Set `USE_PARTITIONED_TABLES=true` for pilot instances
- Repositories route pilot orgs to partitioned tables
- Monitor performance and correctness

### Phase 3: Full Switchover

- Set `USE_PARTITIONED_TABLES=true` globally
- All traffic routes through partitioned tables
- Legacy tables remain as fallback
- Validate data consistency

### Phase 4: Cleanup (Optional)

- After confidence period (24-48 hours)
- Drop legacy tables if no issues detected
- Remove dual-write triggers

## Performance Considerations

### Partition Benefits

1. **Hash Partitioning** (daily_cash_balances)
   - Distributes data evenly by org_id
   - Enables parallel query execution
   - Reduces index size per partition

2. **Range Partitioning** (revenues, expenses)
   - Efficient time-based queries
   - Automatic partition pruning
   - Easy archival of old partitions

### Query Optimization

```typescript
// Efficient: Uses partition key
await financeRepo.getRevenues(orgId, {
  startDate: '2025-01-01',
  endDate: '2025-01-31'
});

// Less efficient: Full table scan without partition key
await financeRepo.getRevenues(orgId, {
  status: 'approved'
});
```

## Troubleshooting

### Issue: Wrong Table Being Used

**Check:**
1. Verify `USE_PARTITIONED_TABLES` environment variable
2. Enable `LOG_PARTITION_ROUTING=true` to see routing decisions
3. Check `DatabaseConfig.usePartitionedTables` value at runtime

### Issue: Data Missing After Switchover

**Verify:**
1. Dual-write triggers are active
2. Row counts match between legacy and partitioned tables
3. Run partition verification queries

```sql
-- Check counts
SELECT 
  'revenues' as table,
  (SELECT COUNT(*) FROM revenues) as legacy,
  (SELECT COUNT(*) FROM revenues_partitioned) as partitioned;
```

### Issue: Performance Regression

**Investigate:**
1. Check if partition pruning is working (EXPLAIN ANALYZE)
2. Verify indexes exist on partitioned tables
3. Monitor partition-specific metrics

## Best Practices

1. **Always use repositories** - Never query tables directly in services
2. **Test both modes** - Run tests with both flag values
3. **Monitor routing** - Enable logging during migration periods
4. **Validate data** - Regularly check legacy/partitioned parity
5. **Gradual rollout** - Use pilot orgs before global switchover

## API Reference

### FinanceRepository

#### Methods

- `insertRevenue(data, usePartitioned?)` - Create new revenue
- `getRevenues(orgId, filters, usePartitioned?)` - Query revenues
- `getRevenueById(id, orgId, usePartitioned?)` - Get single revenue
- `updateRevenueStatus(id, orgId, status, userId, usePartitioned?)` - Approve/reject
- `deleteRevenue(id, orgId, usePartitioned?)` - Delete revenue
- `getRevenueSumByDateRange(orgId, propertyId, start, end, usePartitioned?)` - Aggregate
- `insertExpense(data, usePartitioned?)` - Create new expense
- `getExpenses(orgId, filters, usePartitioned?)` - Query expenses
- `getExpenseById(id, orgId, usePartitioned?)` - Get single expense
- `updateExpenseStatus(id, orgId, status, userId, usePartitioned?)` - Approve/reject
- `deleteExpense(id, orgId, usePartitioned?)` - Delete expense
- `getExpenseSumByDateRange(orgId, propertyId, start, end, usePartitioned?)` - Aggregate

### ReportsRepository

#### Methods

- `upsertDailyCashBalance(data, usePartitioned?)` - Insert or update balance
- `getDailyCashBalance(orgId, propertyId, date, usePartitioned?)` - Get single balance
- `getDailyCashBalancesByDateRange(orgId, propertyId, start, end, usePartitioned?)` - Query range
- `getAllDailyCashBalances(orgId, propertyId, limit, offset, usePartitioned?)` - List all
- `updateDailyCashBalance(id, orgId, updates, usePartitioned?)` - Update balance
- `getDailyCashBalanceById(id, orgId, usePartitioned?)` - Get by ID
- `deleteDailyCashBalance(id, orgId, usePartitioned?)` - Delete balance
- `countDailyCashBalances(orgId, propertyId, usePartitioned?)` - Count records

## Contributing

When adding new repository methods:

1. Extend `BaseRepository` for new tables
2. Add partition routing to all query methods
3. Include `usePartitioned?` parameter
4. Add logging via `logPartitionRouting()`
5. Write tests covering both modes
6. Update this README with new methods

## Support

For issues or questions:
- Check `/backend/database/STAGING_REHEARSAL_GUIDE.md` for migration procedures
- Review `/backend/database/__tests__/partition_triggers.test.ts` for trigger tests
- See `.agent-os/specs/2025-10-29-partitioned-db-activation/tasks.md` for implementation status

