# Database Partition Verification Scripts

This directory contains SQL scripts for verifying the integrity and correctness of database partitioning and dual-write triggers.

## Scripts Overview

### 1. `test_trigger_upserts.sql`
**Purpose:** Test trigger behavior for INSERT, UPDATE, and ON CONFLICT handling.

**Usage:**
```bash
psql -d hospitality -f test_trigger_upserts.sql
```

**What it tests:**
- Insert synchronization from legacy to partitioned tables
- Update synchronization via triggers
- ON CONFLICT upsert handling
- Bulk insert performance
- Row count parity

**Expected Output:** ✓ PASS messages for all tests

---

### 2. `verify_dual_write_parity.sql`
**Purpose:** Comprehensive verification of data consistency between legacy and partitioned tables.

**Usage:**
```bash
psql -d hospitality -f verify_dual_write_parity.sql
```

**What it checks:**
- Row count comparisons
- Row-by-row data validation
- Value mismatches
- Trigger existence and status
- Partition distribution statistics
- Data checksums

**Expected Output:** Zero mismatches, equal row counts, all triggers ENABLED

---

## Recommended Testing Workflow

### Pre-Migration Testing

1. **Test Triggers in Isolation:**
   ```bash
   psql -d hospitality -f test_trigger_upserts.sql
   ```
   Verify all tests pass (✓ PASS) before proceeding.

2. **Verify Current State:**
   ```bash
   psql -d hospitality -f verify_dual_write_parity.sql > pre_migration_report.txt
   ```
   Save output for comparison.

### During Migration

3. **Run Dry-Run Switchover:**
   ```bash
   cd ../
   DRY_RUN=true ./switchover_to_partitioned.sh
   ```
   Review logs to understand what will happen.

4. **Execute Actual Switchover:**
   ```bash
   ./switchover_to_partitioned.sh
   ```
   This will automatically log row counts at each stage.

### Post-Migration Validation

5. **Verify Parity Again:**
   ```bash
   psql -d hospitality -f verify_dual_write_parity.sql > post_migration_report.txt
   ```

6. **Compare Reports:**
   ```bash
   diff pre_migration_report.txt post_migration_report.txt
   ```
   Look for:
   - Row counts should match
   - Checksums should match
   - No new mismatches

### Continuous Monitoring

7. **Periodic Checks:**
   ```bash
   # Run daily or after significant data operations
   psql -d hospitality -f verify_dual_write_parity.sql | grep -E "(FAIL|mismatch|Missing)"
   ```
   No output means everything is in sync.

---

## Troubleshooting

### Issue: Trigger Tests Fail
**Symptoms:** ✗ FAIL messages in `test_trigger_upserts.sql`

**Solution:**
1. Check if triggers exist and are enabled:
   ```sql
   SELECT tgname, tgenabled FROM pg_trigger 
   WHERE tgname LIKE 'sync_to_partitioned_%';
   ```

2. Verify trigger functions have ON CONFLICT logic:
   ```sql
   \df+ sync_revenues_insert
   \df+ sync_expenses_insert
   ```

3. If missing, run the trigger update migration:
   ```bash
   psql -d hospitality -f ../migrations/update_partition_triggers_with_upsert.sql
   ```

---

### Issue: Row Count Mismatches
**Symptoms:** Legacy and partitioned tables show different counts

**Possible Causes:**
1. Triggers not enabled
2. Data inserted before triggers were created
3. ON CONFLICT not handling updates properly

**Solution:**
1. Check trigger status (see above)

2. Manually sync data:
   ```sql
   INSERT INTO daily_cash_balances_partitioned
   SELECT * FROM daily_cash_balances
   ON CONFLICT (org_id, property_id, balance_date) DO UPDATE SET
     opening_balance_cents = EXCLUDED.opening_balance_cents,
     closing_balance_cents = EXCLUDED.closing_balance_cents,
     updated_at = EXCLUDED.updated_at;
   ```

3. Re-run verification

---

### Issue: Value Mismatches
**Symptoms:** Rows exist in both tables but with different values

**Possible Causes:**
1. Concurrent updates during migration
2. Trigger not firing for all UPDATE operations
3. Application bypassing triggers

**Solution:**
1. Identify specific mismatches:
   ```sql
   SELECT l.id, l.amount_cents as legacy, p.amount_cents as partitioned
   FROM revenues l
   JOIN revenues_partitioned p ON l.id = p.id AND l.occurred_at = p.occurred_at
   WHERE l.amount_cents <> p.amount_cents;
   ```

2. Manually reconcile:
   ```sql
   UPDATE revenues_partitioned p
   SET amount_cents = l.amount_cents, updated_at = l.updated_at
   FROM revenues l
   WHERE p.id = l.id AND p.occurred_at = l.occurred_at
     AND p.amount_cents <> l.amount_cents;
   ```

---

## Integration Testing

For automated testing, use the Jest test suite:

```bash
cd ../../..
bun run --cwd backend test database/__tests__/partition_triggers.test.ts
```

This runs the same validation logic but in an automated, repeatable manner.

---

## Monitoring & Alerts

### Recommended Metrics to Track

1. **Row Count Drift:**
   ```sql
   SELECT 
     (SELECT COUNT(*) FROM revenues) - 
     (SELECT COUNT(*) FROM revenues_partitioned) AS drift;
   ```

2. **Trigger Failure Rate:**
   Check PostgreSQL logs for errors related to trigger functions.

3. **Query Performance:**
   Compare query execution times between legacy and partitioned tables.

---

## Rollback Instructions

If issues are detected and rollback is needed:

1. **Disable Partition Routing:**
   ```bash
   export USE_PARTITIONED_TABLES=false
   # Restart application
   ```

2. **Run Rollback Script:**
   ```bash
   cd ../
   ./switchover_to_partitioned.sh --rollback
   ```

3. **Verify Application Health:**
   Monitor error rates and query performance.

4. **Investigate Issues:**
   Review logs and verification reports to identify root cause.

---

## Questions or Issues?

Contact the DevOps team or refer to:
- Main scaling document: `/.agent-os/recaps/2025-10-29-1m-scaling-readiness.md`
- Partition implementation plan: `/database-partitioning-implementation-plan.md`
- Technical spec: `/.agent-os/specs/2025-10-29-partitioned-db-activation/sub-specs/technical-spec.md`

