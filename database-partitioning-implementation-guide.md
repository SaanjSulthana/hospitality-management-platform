# Database Partitioning Implementation Guide

## 🎯 **Implementation Timeline**

### **Phase 1: Preparation (Week 1)**
- [x] Create partitioned tables alongside existing ones
- [x] Set up sync triggers to maintain data consistency
- [x] Create partition-specific indexes
- [x] Test with small dataset

### **Phase 2: Data Migration (Week 2)**
- [ ] Migrate existing data in batches during low-traffic periods
- [ ] Monitor performance during migration
- [ ] Verify data integrity after each batch

### **Phase 3: Switchover (Week 3)**
- [ ] Brief maintenance window (30 minutes)
- [ ] Switch application to use partitioned tables
- [ ] Drop old tables after verification

### **Phase 4: Optimization (Week 4)**
- [ ] Create partition-specific indexes
- [ ] Set up automatic partition creation
- [ ] Performance tuning and monitoring

## 🚀 **Step-by-Step Implementation**

### **Step 1: Run Initial Migrations**
```bash
# Run the first 3 migrations to set up partitioned tables
encore run
# This will create:
# - Partitioned tables alongside existing ones
# - Sync triggers for data consistency
# - Partition-specific indexes
```

### **Step 2: Verify Setup**
```sql
-- Check that partitioned tables exist
SELECT tablename FROM pg_tables 
WHERE tablename LIKE 'revenues_%' OR tablename LIKE 'expenses_%';

-- Check that triggers are working
INSERT INTO revenues (org_id, property_id, amount_cents, occurred_at, status)
VALUES (1, 1, 10000, '2025-01-15', 'approved');

-- Verify data appears in both tables
SELECT COUNT(*) FROM revenues;
SELECT COUNT(*) FROM revenues_partitioned;
```

### **Step 3: Migrate Data in Batches**
```sql
-- Run this script multiple times with different ID ranges
-- Adjust the ID ranges based on your data size

-- Batch 1: First 100,000 records
INSERT INTO revenues_partitioned (
    id, org_id, property_id, amount_cents, payment_mode, 
    occurred_at, status, description, category, created_at, updated_at
)
SELECT 
    id, org_id, property_id, amount_cents, payment_mode, 
    occurred_at, status, description, category, created_at, updated_at
FROM revenues 
WHERE id BETWEEN 1 AND 100000
ON CONFLICT (id, occurred_at) DO NOTHING;

-- Continue with more batches...
```

### **Step 4: Verify Data Migration**
```sql
-- Check data counts match
SELECT 
    'revenues' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT org_id) as unique_orgs,
    MIN(occurred_at) as earliest_date,
    MAX(occurred_at) as latest_date
FROM revenues_partitioned
UNION ALL
SELECT 
    'expenses' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT org_id) as unique_orgs,
    MIN(expense_date) as earliest_date,
    MAX(expense_date) as latest_date
FROM expenses_partitioned;
```

### **Step 5: Switchover (Maintenance Window)**
```sql
-- IMPORTANT: Run during maintenance window
-- 1. Rename original tables to backup
ALTER TABLE revenues RENAME TO revenues_old;
ALTER TABLE expenses RENAME TO expenses_old;

-- 2. Rename partitioned tables to original names
ALTER TABLE revenues_partitioned RENAME TO revenues;
ALTER TABLE expenses_partitioned RENAME TO expenses;

-- 3. Update sequences
-- (This is handled automatically by the migration script)
```

### **Step 6: Verify Switchover**
```sql
-- Test that partitioned tables work correctly
SELECT COUNT(*) FROM revenues WHERE occurred_at >= CURRENT_DATE - INTERVAL '30 days';

-- Check partition performance
SELECT * FROM get_partition_stats();

-- Verify application still works
-- Test your application endpoints
```

### **Step 7: Cleanup (After Verification)**
```sql
-- Only after confirming everything works correctly
DROP TABLE IF EXISTS revenues_old;
DROP TABLE IF EXISTS expenses_old;
```

## 📊 **Monitoring and Maintenance**

### **Daily Monitoring**
```sql
-- Check partition performance
SELECT * FROM get_partition_stats();

-- Analyze partition performance
SELECT * FROM analyze_partition_performance();

-- Check partition sizes
SELECT * FROM partition_sizes;
```

### **Monthly Maintenance**
```sql
-- Create partitions for next year
SELECT create_next_year_partitions();

-- Archive old partitions
SELECT archive_old_partitions(12);

-- Run maintenance
SELECT maintain_partition_system();
```

## 🚨 **Rollback Plan**

### **If Issues Occur During Migration:**
```sql
-- Stop the migration process
-- Drop sync triggers
DROP TRIGGER IF EXISTS sync_revenues_trigger ON revenues;
DROP TRIGGER IF EXISTS sync_expenses_trigger ON expenses;

-- Drop partitioned tables
DROP TABLE IF EXISTS revenues_partitioned;
DROP TABLE IF EXISTS expenses_partitioned;

-- Continue using original tables
```

### **If Issues Occur After Switchover:**
```sql
-- Rename tables back
ALTER TABLE revenues RENAME TO revenues_partitioned;
ALTER TABLE expenses RENAME TO expenses_partitioned;

ALTER TABLE revenues_old RENAME TO revenues;
ALTER TABLE expenses_old RENAME TO expenses;

-- Restart application
```

## ✅ **Success Criteria**

### **Performance Targets:**
- [ ] Daily Report queries: < 100ms (currently 500ms+)
- [ ] Monthly Report queries: < 500ms (currently 2s+)
- [ ] Cross-org Analytics: < 2s (currently 30s+)

### **Scalability Targets:**
- [ ] Support 1M organizations
- [ ] Handle 10M+ transactions/day
- [ ] Maintain 99.99% uptime

### **Cost Targets:**
- [ ] Storage costs: 60% reduction
- [ ] Compute costs: 40% reduction
- [ ] Maintenance costs: 70% reduction

## 🔧 **Troubleshooting**

### **Common Issues:**

1. **Partition Creation Fails:**
   ```sql
   -- Check if partition already exists
   SELECT tablename FROM pg_tables WHERE tablename = 'revenues_2025_q1';
   
   -- Create partition manually
   SELECT create_quarterly_partition('revenues', '2025-01-01', '2025-04-01');
   ```

2. **Data Migration Fails:**
   ```sql
   -- Check for conflicts
   SELECT COUNT(*) FROM revenues WHERE id IN (
       SELECT id FROM revenues_partitioned
   );
   
   -- Resolve conflicts
   DELETE FROM revenues_partitioned WHERE id IN (
       SELECT id FROM revenues WHERE status = 'deleted'
   );
   ```

3. **Performance Issues:**
   ```sql
   -- Analyze partitions
   ANALYZE revenues;
   ANALYZE expenses;
   
   -- Check index usage
   SELECT * FROM analyze_partition_performance();
   ```

## 📈 **Expected Results**

### **Performance Improvements:**
- **Query Speed**: 10-100x faster
- **Index Maintenance**: 90% faster
- **Backup/Restore**: 80% faster
- **Memory Usage**: 50% reduction

### **Scalability Benefits:**
- **1M Organizations**: Fully supported
- **10M+ Transactions/Day**: Handled efficiently
- **Future Growth**: Automatic partition creation

**Database partitioning is essential for 1M organizations - it's not optional, it's critical for performance, scalability, and cost efficiency.**
