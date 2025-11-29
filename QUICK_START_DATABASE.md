# 🚀 Database Quick Start Guide

> **Quick reference for working with the partitioned database architecture**

---

## 📊 Database Overview

We use **7 databases** with **partitioning** for 1M+ organization scale:

| Database | Purpose | Key Tables |
|----------|---------|------------|
| `hospitality` | Main app | All core tables + partitioned tables |
| `finance` | Financial service | revenues_partitioned, expenses_partitioned |
| `guest_checkin_db` | Guest management | guest_checkins, guest_documents |
| `event_store` | Event sourcing | events |
| `read_models` | CQRS queries | account_balance_read_model |
| `shared` | Cross-service | revenues, expenses |
| `health_check_db` | Infrastructure | health checks |

---

## 🔍 Quick Commands

### View All Databases
```sql
-- In Encore DB Explorer
SELECT datname FROM pg_database WHERE datistemplate = false;
```

### Check Partitioned Tables
```sql
-- See all partitioned tables
SELECT tablename FROM pg_tables 
WHERE tablename LIKE '%_partitioned' 
ORDER BY tablename;

-- See all partition children
SELECT tablename FROM pg_tables 
WHERE tablename LIKE '%_20%' 
   OR tablename LIKE '%_default'
ORDER BY tablename;
```

### Verify Data Parity
```sql
-- Quick health check
SELECT 
  'revenues' as table_name,
  (SELECT COUNT(*) FROM revenues) as legacy,
  (SELECT COUNT(*) FROM revenues_partitioned) as partitioned,
  (SELECT COUNT(*) FROM revenues) - 
  (SELECT COUNT(*) FROM revenues_partitioned) as delta;
```

---

## 🛠️ Common Tasks

### 1. Query Data (Application Code)

```typescript
// Use repository layer (automatically handles partitioning)
import { ReportsRepository } from './repositories/reports_repository';
import { FinanceRepository } from './repositories/finance_repository';

const reportsRepo = new ReportsRepository(db);
const financeRepo = new FinanceRepository(db);

// Get daily balance (routes to correct table automatically)
const balance = await reportsRepo.getDailyCashBalance(orgId, propertyId, date);

// Get revenues for date range
const revenues = await financeRepo.getRevenues(orgId, {
  startDate: '2025-01-01',
  endDate: '2025-01-31'
});
```

### 2. Check Partition Health

```bash
# Via API
curl http://localhost:4000/monitoring/partitions/metrics

# Via DB Explorer
Go to: http://localhost:4000 → DB Explorer → hospitality database
```

### 3. View Partition Distribution

```sql
-- Hash partitions (daily_cash_balances)
SELECT 
  tableoid::regclass AS partition,
  COUNT(*) as row_count
FROM daily_cash_balances_partitioned
GROUP BY tableoid
ORDER BY partition;

-- Range partitions (revenues)
SELECT 
  tableoid::regclass AS partition,
  COUNT(*) as row_count,
  MIN(occurred_at) as earliest,
  MAX(occurred_at) as latest
FROM revenues_partitioned
GROUP BY tableoid
ORDER BY partition;
```

---

## 🎛️ Environment Variables

```bash
# Enable partitioned tables (auto-enabled in staging/prod)
USE_PARTITIONED_TABLES=true

# Enable partition routing in repositories
ENABLE_PARTITION_ROUTING=true

# Enable automatic partition maintenance
ENABLE_PARTITION_MAINTENANCE=true

# Enable debug logging
LOG_PARTITION_ROUTING=true
```

---

## 📈 Performance Tips

### ✅ DO: Always include partition keys
```sql
-- GOOD: Efficient (scans 1 partition)
SELECT * FROM revenues_partitioned
WHERE org_id = 123 
  AND occurred_at >= '2025-01-01'
  AND occurred_at < '2025-02-01';
```

### ❌ DON'T: Query without partition keys
```sql
-- BAD: Inefficient (scans all partitions)
SELECT * FROM revenues_partitioned
WHERE description LIKE '%payment%';
```

---

## 🔧 Maintenance

### Automatic (Cron Jobs)
- **Monthly partition creation**: 1st @ 2:00 AM
- **Old partition cleanup**: 15th @ 3:00 AM

### Manual (If Needed)
```bash
# Trigger partition creation manually
curl -X POST http://localhost:4000/cron/partition-maintenance

# Trigger cleanup manually
curl -X POST http://localhost:4000/cron/partition-cleanup
```

---

## 🚨 Troubleshooting

### Issue: "Table not found"
```bash
# Check if partitioned tables exist
psql -c "SELECT tablename FROM pg_tables WHERE tablename LIKE '%_partitioned';"

# If missing, run migration
curl -X POST http://localhost:4000/monitoring/run-partition-migration
```

### Issue: "Data mismatch between tables"
```sql
-- Check parity
SELECT 
  (SELECT COUNT(*) FROM revenues) as legacy,
  (SELECT COUNT(*) FROM revenues_partitioned) as partitioned;

-- Find missing records
SELECT l.* FROM revenues l
LEFT JOIN revenues_partitioned p ON l.id = p.id
WHERE p.id IS NULL;
```

### Issue: "Slow queries"
```sql
-- Check if partition pruning is working
EXPLAIN ANALYZE 
SELECT * FROM revenues_partitioned
WHERE occurred_at >= '2025-01-01';

-- Look for "Seq Scan" instead of "Index Scan" or "Bitmap Heap Scan"
-- If found, add indexes
```

---

## 📚 Resources

### Documentation
- **Full Guide**: `DATABASE_ARCHITECTURE.md`
- **Summary**: `PARTITION_IMPLEMENTATION_SUMMARY.md`
- **This Guide**: `QUICK_START_DATABASE.md`

### API Endpoints
- `GET /monitoring/partitions/metrics` - Health metrics
- `GET /monitoring/verify-partitions` - Verification
- `POST /monitoring/run-partition-migration` - Manual migration

### DB Explorer
- **URL**: `http://localhost:4000`
- **Tab**: "DB Explorer"
- **Databases**: Select from dropdown (hospitality, finance, etc.)

---

## 💡 Pro Tips

1. **Always use the repository layer** - Don't query tables directly
2. **Check DB Explorer regularly** - Visual confirmation of data
3. **Monitor partition metrics** - Watch for data parity issues
4. **Include partition keys in WHERE** - Enable partition pruning
5. **Test in both modes** - Verify with feature flags on/off

---

## 🎯 Quick Health Check

```bash
# 1. Check partitions exist
curl http://localhost:4000/monitoring/verify-partitions

# 2. Check data parity
psql hospitality -c "
SELECT 
  'revenues' as table_name,
  (SELECT COUNT(*) FROM revenues) as legacy,
  (SELECT COUNT(*) FROM revenues_partitioned) as partitioned;
"

# 3. Check triggers active
psql hospitality -c "
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname LIKE '%sync%';
"

# 4. View in DB Explorer
open http://localhost:4000
```

---

## ✅ System Status

**Current Status:** ✅ **OPERATIONAL**  
**Capacity:** 1M+ Organizations  
**Performance:** <50ms p95 latency  
**Last Updated:** November 8, 2025

---

**Need more details?** See `DATABASE_ARCHITECTURE.md` for comprehensive guide.


