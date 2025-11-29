# Partition Routing Quick Start Guide

## 🚀 What Was Implemented

Task 2 of the Partitioned DB Activation spec is now complete. The system can seamlessly switch between legacy and partitioned tables using a single environment variable.

## ✅ Quick Verification

### 1. Check Current Mode

```bash
cd backend
node -e "console.log('Partitioned Mode:', process.env.USE_PARTITIONED_TABLES === 'true' ? 'ENABLED' : 'DISABLED')"
```

### 2. Run Tests in Both Modes

```bash
# Run automated dual-mode tests
chmod +x scripts/test_dual_mode.sh
./scripts/test_dual_mode.sh
```

Expected output:
```
✅ Legacy Mode: PASSED
✅ Partitioned Mode: PASSED
🎉 SUCCESS: All tests passed in both modes!
```

### 3. Enable Partitioned Mode

```bash
# Set environment variable
export USE_PARTITIONED_TABLES=true

# Optional: Enable debug logging
export LOG_PARTITION_ROUTING=true

# Restart your application
npm run dev
```

Look for initialization logs:
```
[FinanceService] Initialized v2.0.0 (Partition-Aware)
[FinanceService] Partitioned Tables: ENABLED
[ReportsService] Initialized v2.0.0 (Partition-Aware)
[ReportsService] Partitioned Tables: ENABLED
```

### 4. Verify Routing

With `LOG_PARTITION_ROUTING=true`, you'll see routing decisions:

```
[PartitionRouting] INSERT - revenues -> revenues_partitioned
[PartitionRouting] SELECT - expenses -> expenses_partitioned
[PartitionRouting] UPSERT - daily_cash_balances -> daily_cash_balances_partitioned
```

## 📊 Architecture Overview

```
┌─────────────────────────┐
│   Finance Service       │
│   (v2.0.0)             │
└───────────┬─────────────┘
            │
            │ Uses
            ▼
┌─────────────────────────┐
│  Finance Repository     │
│  - insertRevenue()     │
│  - insertExpense()     │
│  - updateStatus()      │
└───────────┬─────────────┘
            │
            │ Routes to
            ▼
    ┌───────────────┐
    │  Partitioned? │
    └───────┬───────┘
            │
    ┌───────┴────────┐
    │                │
    ▼                ▼
┌─────────┐    ┌──────────────────┐
│ revenues│    │revenues_partitioned│
└─────────┘    └──────────────────┘
(Legacy)       (Partitioned)
    │                │
    └────────┬───────┘
             │
      Dual-Write Triggers
         Keep in Sync
```

## 🔄 Migration Path

### Current State (Dual-Write)
- ✅ Legacy tables are primary
- ✅ Triggers automatically copy to partitioned tables
- ✅ Both table sets stay synchronized
- ✅ Can switch modes with zero downtime

### Switch to Partitioned Mode
```bash
# 1. Verify data parity
psql -d hospitality -f database/verification/verify_dual_write_parity.sql

# 2. Enable partitioned mode
export USE_PARTITIONED_TABLES=true

# 3. Restart application
npm run dev

# 4. Monitor logs for partition routing
# Look for: "[PartitionRouting]" messages
```

### Rollback to Legacy Mode
```bash
# 1. Disable partitioned mode
export USE_PARTITIONED_TABLES=false

# 2. Restart application
npm run dev

# Instant rollback - no data migration needed!
```

## 🧪 Testing

### Unit Tests
```bash
# Test repositories
npm test partition_routing.integration

# Test services
npm test finance_service.dual_mode
npm test reports_service.dual_mode
```

### Integration Tests
```bash
# Run full test suite in legacy mode
USE_PARTITIONED_TABLES=false npm test

# Run full test suite in partitioned mode
USE_PARTITIONED_TABLES=true npm test
```

## 📝 Key Files

### Repository Layer
- `backend/shared/repositories/base_repository.ts` - Base class with routing logic
- `backend/shared/repositories/finance_repository.ts` - Revenue/expense operations
- `backend/shared/repositories/reports_repository.ts` - Daily balance operations

### Services (Updated)
- `backend/services/finance-service/finance_service.ts` - Now uses repositories
- `backend/services/reports-service/reports_service.ts` - Now uses repositories

### Tests
- `backend/shared/repositories/__tests__/partition_routing.integration.test.ts`
- `backend/services/__tests__/finance_service.dual_mode.test.ts`
- `backend/services/__tests__/reports_service.dual_mode.test.ts`

### Configuration
- `backend/config/runtime.ts` - DatabaseConfig settings

## 🎯 Production Readiness

### Pre-Production Checklist
- [x] Repository layer implemented and tested
- [x] Services updated to use repositories
- [x] Tests pass in both legacy and partitioned modes
- [x] Dual-write triggers ensure data parity
- [x] Rollback mechanism verified (just flip flag)
- [ ] Redis cache provisioned (Task 3.1)
- [ ] Read replicas configured (Task 3.2)
- [ ] Monitoring/alerting set up (Task 3.3)

### Pilot Rollout Plan

1. **Select Pilot Orgs** (e.g., internal test orgs)
2. **Enable Partitioned Mode** for pilot instance
3. **Monitor for 24-48 hours**:
   - Check error rates
   - Verify data consistency
   - Monitor performance metrics
4. **Validate Success**:
   - Run verification queries
   - Check application logs
   - Test all user workflows
5. **Expand Gradually**:
   - Roll out to 10% of production
   - Then 25%, 50%, 100%
   - Can rollback at any stage

## 🆘 Troubleshooting

### Problem: Services still using legacy tables
**Solution:**
```bash
# Check environment variable
echo $USE_PARTITIONED_TABLES

# Should output: true

# If not set:
export USE_PARTITIONED_TABLES=true
# Then restart services
```

### Problem: Data missing after switch
**Solution:**
```sql
-- Verify dual-write triggers are active
SELECT 
  t.tgname AS trigger_name,
  c.relname AS table_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE t.tgname LIKE 'sync_to_partitioned_%';

-- Should see 3 triggers (one per table)
```

### Problem: Performance slower than expected
**Solution:**
```sql
-- Check if partition pruning is working
EXPLAIN ANALYZE 
SELECT * FROM revenues_partitioned 
WHERE occurred_at >= '2025-01-01' 
  AND occurred_at < '2025-02-01';

-- Should see: "Partitions removed: X"
```

## 📚 Learn More

- Full documentation: `backend/shared/repositories/README.md`
- Implementation details: `backend/TASK2_IMPLEMENTATION_COMPLETE.md`
- Migration guide: `backend/database/STAGING_REHEARSAL_GUIDE.md`
- Task tracking: `.agent-os/specs/2025-10-29-partitioned-db-activation/tasks.md`

## 🎉 Success!

Task 2 is complete. The application is now partition-aware and ready for scale testing and production rollout.

**Next:** Task 3 - Infrastructure & Observability (Redis, Replicas, Metrics)

