# Staging Rehearsal Guide
## Partitioned Database Switchover

This guide walks through a complete staging rehearsal to verify partition migration readiness before production deployment.

---

## Prerequisites

✅ **Required:**
- Staging database with copy of production schema
- PostgreSQL client tools installed (`psql`, `pg_dump`)
- Bash shell access
- At least 30 minutes of dedicated time
- Staging environment isolated from production

✅ **Recommended:**
- Recent production data snapshot
- Monitoring dashboards configured
- Team members on standby for rollback

---

## Phase 1: Environment Setup

### Step 1: Prepare Staging Database

```bash
# Navigate to backend directory
cd backend/database

# Set environment variables
export DB_NAME="hospitality_staging"
export BACKUP_DIR="./staging_backups"
export ADMIN_EMAIL="your-email@example.com"
```

### Step 2: Verify Current State

```bash
# Check database connectivity
psql -d $DB_NAME -c "SELECT version();"

# Verify legacy tables exist
psql -d $DB_NAME -c "\dt"

# Check existing data volume
psql -d $DB_NAME -c "
  SELECT 
    'daily_cash_balances' as table_name,
    pg_size_pretty(pg_total_relation_size('daily_cash_balances')) as size,
    COUNT(*) as rows
  FROM daily_cash_balances
  UNION ALL
  SELECT 
    'revenues',
    pg_size_pretty(pg_total_relation_size('revenues')),
    COUNT(*)
  FROM revenues
  UNION ALL
  SELECT 
    'expenses',
    pg_size_pretty(pg_total_relation_size('expenses')),
    COUNT(*)
  FROM expenses;
"
```

**✅ Expected:** Tables exist with reasonable row counts.

---

## Phase 2: Create Partitioned Tables

### Step 3: Run Partition Creation Migration

```bash
# Apply partition migration
psql -d $DB_NAME -f migrations/create_partitioned_tables.sql

# Verify partitioned tables created
psql -d $DB_NAME -c "
  SELECT 
    tablename,
    schemaname
  FROM pg_tables
  WHERE tablename LIKE '%_partitioned'
  ORDER BY tablename;
"
```

**✅ Expected:** See `daily_cash_balances_partitioned`, `revenues_partitioned`, `expenses_partitioned`

### Step 4: Update Triggers with ON CONFLICT Logic

```bash
# Apply trigger update migration
psql -d $DB_NAME -f migrations/update_partition_triggers_with_upsert.sql

# Verify triggers enabled
psql -d $DB_NAME -c "
  SELECT 
    t.tgname AS trigger_name,
    c.relname AS table_name,
    CASE t.tgenabled
      WHEN 'O' THEN 'ENABLED'
      WHEN 'D' THEN 'DISABLED'
      ELSE 'UNKNOWN'
    END AS status
  FROM pg_trigger t
  INNER JOIN pg_class c ON t.tgrelid = c.oid
  WHERE c.relname IN ('daily_cash_balances', 'revenues', 'expenses')
    AND t.tgname LIKE 'sync_to_partitioned_%'
  ORDER BY c.relname, t.tgname;
"
```

**✅ Expected:** All triggers show `ENABLED` status.

---

## Phase 3: Test Trigger Behavior

### Step 5: Run Trigger Test Suite

```bash
# Execute SQL test script
psql -d $DB_NAME -f verification/test_trigger_upserts.sql > trigger_test_results.txt

# Review results
grep -E "(PASS|FAIL)" trigger_test_results.txt
```

**✅ Expected:** All tests show `✓ PASS`

**🚨 If any FAIL:** Stop here, review test output, fix triggers, and re-run from Step 4.

### Step 6: Verify Dual-Write Parity (Pre-Migration)

```bash
# Run parity verification
psql -d $DB_NAME -f verification/verify_dual_write_parity.sql > pre_migration_parity.txt

# Check for mismatches
grep -iE "(missing|mismatch|fail)" pre_migration_parity.txt
```

**✅ Expected:** No mismatches (row counts may differ if partitioned tables are empty - that's OK before migration).

---

## Phase 4: Dry-Run Switchover

### Step 7: Execute Dry-Run

```bash
# Run switchover in dry-run mode
DRY_RUN=true ./switchover_to_partitioned.sh > dry_run.log 2>&1

# Review dry-run output
less dry_run.log
```

**Review Checklist:**
- ✅ Pre-flight checks pass
- ✅ Backup would be created
- ✅ Migration steps are clear
- ✅ Row count logging is detailed
- ✅ Validation steps are comprehensive

**🚨 If issues found:** Review logs, fix scripts, repeat dry-run.

---

## Phase 5: Actual Switchover (Staging)

### Step 8: Backup Staging Data

```bash
# Create manual backup before switchover
pg_dump -d $DB_NAME \
  -t daily_cash_balances \
  -t revenues \
  -t expenses \
  --no-owner \
  --no-acl \
  -f "$BACKUP_DIR/manual_backup_$(date +%Y%m%d_%H%M%S).sql"
```

### Step 9: Execute Real Switchover

```bash
# Run actual switchover (NOT dry-run)
./switchover_to_partitioned.sh

# Follow prompts carefully
# Answer "yes" when ready to proceed
```

**🎯 Monitor Output:**
- Row counts logged at each stage
- Migration completion messages
- No errors during data migration
- Post-migration verification passes

### Step 10: Post-Migration Verification

```bash
# Run comprehensive parity check
psql -d $DB_NAME -f verification/verify_dual_write_parity.sql > post_migration_parity.txt

# Compare pre and post migration
diff pre_migration_parity.txt post_migration_parity.txt

# Check specific counts
psql -d $DB_NAME -c "
  SELECT 
    'daily_cash_balances' as table_name,
    (SELECT COUNT(*) FROM daily_cash_balances) as legacy_count,
    (SELECT COUNT(*) FROM daily_cash_balances_partitioned) as partitioned_count,
    CASE 
      WHEN (SELECT COUNT(*) FROM daily_cash_balances) = 
           (SELECT COUNT(*) FROM daily_cash_balances_partitioned)
      THEN 'MATCH ✓'
      ELSE 'MISMATCH ✗'
    END as status
  UNION ALL
  SELECT 
    'revenues',
    (SELECT COUNT(*) FROM revenues),
    (SELECT COUNT(*) FROM revenues_partitioned),
    CASE 
      WHEN (SELECT COUNT(*) FROM revenues) = 
           (SELECT COUNT(*) FROM revenues_partitioned)
      THEN 'MATCH ✓'
      ELSE 'MISMATCH ✗'
    END
  UNION ALL
  SELECT 
    'expenses',
    (SELECT COUNT(*) FROM expenses),
    (SELECT COUNT(*) FROM expenses_partitioned),
    CASE 
      WHEN (SELECT COUNT(*) FROM expenses) = 
           (SELECT COUNT(*) FROM expenses_partitioned)
      THEN 'MATCH ✓'
      ELSE 'MISMATCH ✗'
    END;
"
```

**✅ Expected:** All tables show `MATCH ✓`

---

## Phase 6: Application Testing

### Step 11: Enable Partition Routing (Staging App)

```bash
# Update environment variable in staging deployment
export USE_PARTITIONED_TABLES=true
export ENABLE_PARTITION_ROUTING=true

# Restart staging application
# (Method depends on your deployment - Docker, PM2, systemd, etc.)
```

### Step 12: Smoke Test Critical Flows

**Test Scenarios:**

1. **Create Revenue Record:**
   ```bash
   curl -X POST http://staging-api/finance/revenue \
     -H "Content-Type: application/json" \
     -d '{
       "propertyId": 1,
       "amount": 100.00,
       "description": "Test Revenue - Staging",
       "paymentMode": "cash",
       "occurredAt": "2025-10-29T12:00:00Z"
     }'
   ```

2. **Create Expense Record:**
   ```bash
   curl -X POST http://staging-api/finance/expense \
     -H "Content-Type: application/json" \
     -d '{
       "propertyId": 1,
       "amount": 50.00,
       "description": "Test Expense - Staging",
       "paymentMode": "bank",
       "occurredAt": "2025-10-29T12:00:00Z"
     }'
   ```

3. **Fetch Daily Report:**
   ```bash
   curl -X GET "http://staging-api/reports/daily?date=2025-10-29&propertyId=1"
   ```

4. **Update Transaction:**
   ```bash
   curl -X POST http://staging-api/finance/approve \
     -H "Content-Type: application/json" \
     -d '{"transactionId": 123, "type": "revenue"}'
   ```

**✅ Expected:**
- All API calls return 200 OK
- Data visible in both legacy and partitioned tables
- No application errors in logs

### Step 13: Verify Data Consistency After App Operations

```bash
# Check if new data was synced
psql -d $DB_NAME -c "
  SELECT 
    l.id, 
    l.description as legacy_desc,
    p.description as partitioned_desc,
    CASE 
      WHEN l.description = p.description THEN 'SYNCED ✓'
      ELSE 'OUT OF SYNC ✗'
    END as status
  FROM revenues l
  LEFT JOIN revenues_partitioned p ON l.id = p.id AND l.occurred_at = p.occurred_at
  WHERE l.description LIKE '%Test Revenue - Staging%'
  ORDER BY l.created_at DESC
  LIMIT 5;
"
```

**✅ Expected:** All rows show `SYNCED ✓`

---

## Phase 7: Performance Testing

### Step 14: Query Performance Comparison

```bash
# Create performance test script
cat > performance_test.sql << 'EOF'
-- Test 1: Simple SELECT by org_id
\timing on

EXPLAIN ANALYZE
SELECT * FROM daily_cash_balances
WHERE org_id = 1
ORDER BY balance_date DESC
LIMIT 10;

EXPLAIN ANALYZE
SELECT * FROM daily_cash_balances_partitioned
WHERE org_id = 1
ORDER BY balance_date DESC
LIMIT 10;

-- Test 2: Aggregation query
EXPLAIN ANALYZE
SELECT 
  DATE_TRUNC('month', occurred_at) as month,
  SUM(amount_cents) as total
FROM revenues
WHERE org_id = 1
  AND occurred_at >= '2025-01-01'
GROUP BY month
ORDER BY month;

EXPLAIN ANALYZE
SELECT 
  DATE_TRUNC('month', occurred_at) as month,
  SUM(amount_cents) as total
FROM revenues_partitioned
WHERE org_id = 1
  AND occurred_at >= '2025-01-01'
GROUP BY month
ORDER BY month;

\timing off
EOF

# Run performance tests
psql -d $DB_NAME -f performance_test.sql > performance_results.txt

# Review results
less performance_results.txt
```

**🎯 Analysis:**
- Compare execution times
- Check if partition pruning is working (fewer rows scanned)
- Verify index usage

---

## Phase 8: Load Testing (Optional but Recommended)

### Step 15: Simulate Concurrent Writes

```bash
# Create load test script
cat > load_test.sh << 'EOF'
#!/bin/bash

for i in {1..100}; do
  psql -d $DB_NAME -c "
    INSERT INTO revenues (
      org_id, property_id, amount_cents, occurred_at,
      description, status, created_by_user_id, created_at, updated_at
    ) VALUES (
      $((RANDOM % 100 + 1)), 
      1, 
      $((RANDOM * 100)), 
      NOW(), 
      'Load Test Revenue $i', 
      'pending', 
      1, 
      NOW(), 
      NOW()
    );
  " &
done

wait
echo "Load test complete"
EOF

chmod +x load_test.sh

# Run load test
./load_test.sh

# Verify data consistency after load
psql -d $DB_NAME -f verification/verify_dual_write_parity.sql | grep -A 5 "ROW COUNT"
```

**✅ Expected:** Row counts match after concurrent writes.

---

## Phase 9: Rollback Test

### Step 16: Test Rollback Procedure

```bash
# Disable partition routing
export USE_PARTITIONED_TABLES=false

# Restart application (staging)

# Verify app works with legacy tables
curl http://staging-api/reports/daily?date=2025-10-29&propertyId=1

# Re-enable partition routing
export USE_PARTITIONED_TABLES=true

# Restart application again

# Verify app works with partitioned tables
curl http://staging-api/reports/daily?date=2025-10-29&propertyId=1
```

**✅ Expected:** Both modes work without data loss.

---

## Phase 10: Documentation & Sign-Off

### Step 17: Generate Rehearsal Report

```bash
# Create summary report
cat > staging_rehearsal_report.md << EOF
# Staging Rehearsal Report - Partitioned Database Migration

**Date:** $(date +'%Y-%m-%d')
**Database:** $DB_NAME
**Rehearsed By:** $USER

## Summary
- ✅ Partitioned tables created successfully
- ✅ Triggers enabled and tested
- ✅ Dry-run completed without errors
- ✅ Actual switchover completed
- ✅ Data parity verified
- ✅ Application smoke tests passed
- ✅ Performance tests show expected improvements
- ✅ Rollback procedure validated

## Metrics
$(cat row_counts_*.log | tail -30)

## Issues Encountered
- None / [List any issues]

## Recommendations
- Ready for production deployment
- Estimated production migration time: [estimate]
- Recommended deployment window: [off-peak hours]

## Next Steps
1. Schedule production migration
2. Notify stakeholders
3. Prepare monitoring dashboards
4. Brief on-call team on rollback procedure

## Attachments
- \`dry_run.log\` - Dry-run execution log
- \`pre_migration_parity.txt\` - Pre-migration verification
- \`post_migration_parity.txt\` - Post-migration verification
- \`performance_results.txt\` - Query performance comparison
- \`row_counts_*.log\` - Row count tracking logs

**Approved By:** [Name]
**Date:** [Date]
EOF

echo "Report generated: staging_rehearsal_report.md"
```

### Step 18: Review & Sign-Off

**Review Checklist:**
- [ ] All phases completed successfully
- [ ] No data loss or corruption detected
- [ ] Performance meets or exceeds expectations
- [ ] Rollback procedure validated
- [ ] Team trained on operational procedures
- [ ] Monitoring dashboards configured
- [ ] Incident response plan documented

---

## Troubleshooting Common Issues

### Issue: Trigger Test Failures

**Symptom:** `✗ FAIL` in trigger tests

**Solution:**
1. Check trigger function source code
2. Verify ON CONFLICT clauses exist
3. Re-run trigger update migration
4. Retry tests

### Issue: Row Count Mismatches

**Symptom:** Legacy ≠ Partitioned counts

**Solution:**
1. Check if triggers are enabled
2. Manually sync:
   ```sql
   INSERT INTO revenues_partitioned SELECT * FROM revenues ON CONFLICT (id, occurred_at) DO NOTHING;
   ```
3. Re-verify parity

### Issue: Performance Regression

**Symptom:** Partitioned queries slower than legacy

**Solution:**
1. Check if indexes exist on partitioned tables
2. Run `ANALYZE` on partitioned tables
3. Verify partition pruning is working
4. Review query plans

---

## Production Deployment Timeline

Based on staging rehearsal:

1. **T-7 days:** Staging rehearsal complete (this document)
2. **T-3 days:** Final review and approval
3. **T-1 day:** Pre-migration communications
4. **T-0 (Day of):**
   - 00:00 - Deploy trigger updates (zero downtime)
   - 02:00 - Run migration during low traffic window
   - 03:00 - Verify and enable partition routing
   - 04:00 - Monitor and validate
5. **T+1 day:** Post-migration review
6. **T+7 days:** Cleanup legacy tables (if stable)

---

## Questions or Issues?

Contact the DevOps/Database team or refer to:
- Technical Spec: `/.agent-os/specs/2025-10-29-partitioned-db-activation/sub-specs/technical-spec.md`
- Verification README: `/backend/database/verification/README.md`
- Main Scaling Document: `/.agent-os/recaps/2025-10-29-1m-scaling-readiness.md`

