# Rollout & Rollback Handbook
## Partitioned Database Activation for 1M Organizations

> **Version**: 1.0  
> **Last Updated**: 2024-11-07  
> **Owner**: Platform Engineering Team

## Table of Contents

1. [Overview](#overview)
2. [Pre-Rollout Checklist](#pre-rollout-checklist)
3. [Rollout Phases](#rollout-phases)
4. [Monitoring During Rollout](#monitoring-during-rollout)
5. [Rollback Procedures](#rollback-procedures)
6. [Post-Rollout Verification](#post-rollout-verification)
7. [Emergency Contacts](#emergency-contacts)
8. [Troubleshooting](#troubleshooting)

---

## Overview

### Objective

Safely enable partitioned database tables for finance and reporting data to support 1M+ organizations with improved query performance and data management.

### Key Components

- **Partitioned Tables**: `revenue_transactions_partitioned`, `expense_transactions_partitioned`
- **Dual-Write Triggers**: Automatically sync legacy → partitioned tables
- **Feature Flag**: `USE_PARTITIONED_TABLES` environment variable
- **Redis Cache**: External cache for distributed caching
- **Read Replicas**: Optional read scaling with PgBouncer

### Rollout Strategy

**Phased Approach**:
1. Development environment (validation)
2. Staging environment (rehearsal)
3. Production pilot (1% of orgs)
4. Production gradual rollout (10% → 50% → 100%)

---

## Pre-Rollout Checklist

### Infrastructure Readiness

- [ ] **PostgreSQL 15+** installed and configured
- [ ] **Partitioned tables** created with migrations applied
- [ ] **Dual-write triggers** installed and active
- [ ] **Redis** provisioned and accessible (optional but recommended)
- [ ] **PgBouncer** configured for connection pooling (optional)
- [ ] **Read replicas** configured if using replication (optional)
- [ ] **Backup** recent full database backup completed
- [ ] **Monitoring** endpoints accessible and returning data

### Data Validation

```bash
# Check row count parity
curl http://localhost:4000/monitoring/partitions/metrics | jq '.tables[] | {name, rowCountDelta, status}'

# Expected: rowCountDelta < 10 for all tables
# Expected: status = "synced" for all tables
```

- [ ] Row count delta < 10 rows for all tables
- [ ] Dual-write triggers are active
- [ ] Recent writes appear in both legacy and partitioned tables
- [ ] No errors in PostgreSQL logs

### Application Readiness

```bash
# Check application health
curl http://localhost:4000/monitoring/unified/health | jq '.status'

# Expected: "healthy"
```

- [ ] Application builds successfully
- [ ] All unit tests pass
- [ ] Integration tests pass in partitioned mode
- [ ] Load tests completed successfully
- [ ] Cache endpoints respond correctly
- [ ] Replica endpoints respond correctly (if using replicas)

### Team Readiness

- [ ] On-call engineer assigned and available
- [ ] Database administrator on standby
- [ ] Rollback plan reviewed with team
- [ ] Communication channels established (Slack, PagerDuty, etc.)
- [ ] Monitoring dashboards open and accessible
- [ ] Runbook accessible to all team members

---

## Rollout Phases

### Phase 1: Development Environment

**Timeline**: Day 1  
**Risk Level**: Low  

**Steps**:

1. **Enable feature flag**:
   ```bash
   # In development .env or environment
   export USE_PARTITIONED_TABLES=true
   ```

2. **Restart application**:
   ```bash
   encore run
   ```

3. **Verify partition routing**:
   ```bash
   # Check metrics
   curl http://localhost:4000/monitoring/partitions/metrics
   
   # Create test transaction
   curl -X POST http://localhost:4000/finance/revenue \
     -H "Content-Type: application/json" \
     -d '{"orgId": 1, "amount": 100, "description": "Test"}'
   
   # Verify in partitioned table
   psql -d hospitality_platform -c "SELECT COUNT(*) FROM revenue_transactions_partitioned WHERE org_id = 1;"
   ```

4. **Run full test suite**:
   ```bash
   bun test
   ```

**Success Criteria**:
- All tests pass
- Queries route to partitioned tables
- No errors in logs

**Rollback**: Set `USE_PARTITIONED_TABLES=false` and restart

---

### Phase 2: Staging Environment

**Timeline**: Day 2-3  
**Risk Level**: Low-Medium  

**Steps**:

1. **Apply migrations** (if not already applied):
   ```bash
   encore db migrate
   ```

2. **Enable feature flag in staging**:
   ```bash
   # Update staging environment variables
   USE_PARTITIONED_TABLES=true
   ```

3. **Deploy to staging**:
   ```bash
   git checkout main
   git pull origin main
   encore deploy staging
   ```

4. **Run smoke tests**:
   ```bash
   # Use staging environment
   ./scripts/smoke_tests.sh staging
   ```

5. **Load testing** (simulate 100K orgs):
   ```bash
   # Run load test script
   ./scripts/load_test.sh --orgs 100000 --duration 1h
   ```

6. **Monitor for 24 hours**:
   - Check partition metrics hourly
   - Monitor cache hit rates
   - Watch for errors or performance degradation

**Success Criteria**:
- Load tests pass with acceptable performance
- No data inconsistencies detected
- Cache hit rate > 70%
- No critical alerts

**Rollback**: Deploy previous version with `USE_PARTITIONED_TABLES=false`

---

### Phase 3: Production Pilot (1% Traffic)

**Timeline**: Day 4-7  
**Risk Level**: Medium  

**Preparation**:

1. **Create pilot organization list**:
   ```sql
   -- Select small, low-risk organizations
   SELECT id, name, transaction_count 
   FROM organizations 
   WHERE transaction_count < 1000 
   ORDER BY created_at DESC 
   LIMIT 100;
   ```

2. **Configure feature flag** (if using LaunchDarkly or similar):
   ```javascript
   // Feature flag targeting
   {
     "USE_PARTITIONED_TABLES": {
       "enabled": true,
       "rules": [
         {
           "variation": true,
           "clauses": [
             {
               "attribute": "orgId",
               "op": "in",
               "values": [123, 456, 789, ...]  // Pilot org IDs
             }
           ]
         }
       ],
       "fallthrough": { "variation": false }
     }
   }
   ```

   **OR** simple percentage rollout:
   ```bash
   # Enable for 1% of requests
   USE_PARTITIONED_TABLES_PERCENTAGE=1
   ```

**Rollout Steps**:

1. **Deploy to production**:
   ```bash
   git tag v1.0.0-partitions
   git push origin v1.0.0-partitions
   encore deploy production
   ```

2. **Enable for pilot orgs**:
   - Update feature flag to enable for pilot orgs only
   - Verify with metrics endpoint

3. **Monitor continuously** (first 4 hours):
   ```bash
   # Watch unified metrics
   watch -n 30 'curl -s http://production.app/monitoring/unified/metrics | jq .'
   
   # Watch logs
   encore logs --env production --follow | grep -i error
   ```

4. **Check pilot org data integrity**:
   ```sql
   -- For each pilot org
   SELECT 
     l.org_id,
     COUNT(l.id) as legacy_count,
     COUNT(p.id) as partition_count,
     COUNT(l.id) - COUNT(p.id) as delta
   FROM revenue_transactions l
   LEFT JOIN revenue_transactions_partitioned p ON l.id = p.id
   WHERE l.org_id IN (123, 456, 789, ...)
   GROUP BY l.org_id;
   ```

**Success Criteria**:
- No errors for pilot organizations
- Data integrity maintained (delta < 10)
- Performance equal or better than baseline
- No increase in error rates or latency

**Duration**: 72 hours minimum

**Rollback**: See [Emergency Rollback](#emergency-rollback) section

---

### Phase 4: Gradual Production Rollout

**Timeline**: Day 8-21  
**Risk Level**: Medium-High  

**Rollout Schedule**:

| Day | Percentage | Organizations | Monitoring Interval |
|-----|-----------|---------------|---------------------|
| 8   | 1%        | ~10,000       | Every 1 hour        |
| 10  | 5%        | ~50,000       | Every 2 hours       |
| 12  | 10%       | ~100,000      | Every 4 hours       |
| 14  | 25%       | ~250,000      | Every 6 hours       |
| 17  | 50%       | ~500,000      | Every 8 hours       |
| 21  | 100%      | 1,000,000     | Daily               |

**Steps for Each Increment**:

1. **Update feature flag percentage**:
   ```bash
   USE_PARTITIONED_TABLES_PERCENTAGE=5  # or 10, 25, 50, 100
   ```

2. **Wait 10 minutes** for configuration to propagate

3. **Verify metrics**:
   ```bash
   curl http://production.app/monitoring/unified/metrics | jq '.partitions'
   ```

4. **Monitor for issues**:
   - Check error rates in APM
   - Monitor database CPU and memory
   - Watch cache hit rates
   - Check replica lag (if using replicas)

5. **Pause if issues detected**:
   - Critical errors: Immediate rollback
   - Performance degradation > 20%: Investigate and fix
   - Data inconsistencies: Rollback and investigate

6. **Wait for stabilization** (minimum 24 hours between increments)

**Success Criteria for Each Increment**:
- Error rate < 0.1%
- P95 latency < baseline + 10%
- Cache hit rate > 70%
- No critical alerts
- Data integrity maintained

---

## Monitoring During Rollout

### Primary Dashboards

**1. Unified Metrics Dashboard**
```bash
# Real-time monitoring
curl http://production.app/monitoring/unified/metrics
```

**Key Metrics**:
- System status (healthy/degraded/unhealthy)
- Partition sync status
- Cache hit rate
- Replica lag
- Active alerts

**2. Partition Metrics**
```bash
curl http://production.app/monitoring/partitions/metrics
```

**Watch For**:
- Row count delta > 100
- Sync status = "out_of_sync"
- Switchover readiness = false

**3. Cache Metrics**
```bash
curl http://production.app/monitoring/cache/invalidation-metrics
```

**Watch For**:
- Hit rate < 50%
- Cache unavailable
- High invalidation failure rate

**4. Database Metrics**
```bash
curl http://production.app/database/replica/lag
curl http://production.app/database/replica/pool-stats
```

**Watch For**:
- Replica lag > 30 seconds
- Connection pool exhaustion
- Unhealthy replicas

### Automated Monitoring Script

```bash
#!/bin/bash
# monitor_rollout.sh

METRICS_URL="http://production.app/monitoring/unified/metrics"
ALERT_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

while true; do
  response=$(curl -s $METRICS_URL)
  status=$(echo $response | jq -r '.system.status')
  critical_alerts=$(echo $response | jq -r '.alerts.critical')
  
  if [ "$status" != "healthy" ] || [ "$critical_alerts" -gt 0 ]; then
    message="⚠️ ALERT: System status: $status, Critical alerts: $critical_alerts"
    curl -X POST $ALERT_WEBHOOK -H 'Content-Type: application/json' \
      -d "{\"text\": \"$message\"}"
    echo $message
  else
    echo "✅ System healthy at $(date)"
  fi
  
  sleep 300  # Check every 5 minutes
done
```

### Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Row count delta | > 100 | > 1000 | Check dual-write triggers |
| Cache hit rate | < 70% | < 50% | Investigate cache config |
| Replica lag | > 10s | > 30s | Check replication |
| Error rate | > 0.5% | > 1% | Consider rollback |
| P95 latency | +20% | +50% | Investigate performance |

---

## Rollback Procedures

### Standard Rollback (No Data Loss Risk)

**Scenario**: Performance issues, high error rates, but no data integrity problems

**Duration**: ~15 minutes

**Steps**:

1. **Disable feature flag**:
   ```bash
   # Set percentage to 0 or disable entirely
   USE_PARTITIONED_TABLES=false
   # or
   USE_PARTITIONED_TABLES_PERCENTAGE=0
   ```

2. **Verify configuration**:
   ```bash
   # Check that queries route to legacy tables
   curl http://production.app/monitoring/partitions/metrics | jq '.partitionedTablesEnabled'
   # Expected: false
   ```

3. **Monitor for 30 minutes**:
   ```bash
   # Watch error rates and latency
   encore logs --env production --follow | grep -i error
   ```

4. **Verify metrics normalized**:
   ```bash
   curl http://production.app/monitoring/unified/health
   # Expected: status = "healthy"
   ```

**No Code Deployment Required** - Feature flag change is sufficient

---

### Emergency Rollback (Data Integrity Risk)

**Scenario**: Data inconsistencies detected, critical errors, data loss risk

**Duration**: ~30 minutes

**Steps**:

1. **IMMEDIATE: Disable feature flag**:
   ```bash
   USE_PARTITIONED_TABLES=false
   USE_PARTITIONED_TABLES_PERCENTAGE=0
   ```

2. **Notify team via emergency channel**:
   ```bash
   # Post to #incidents Slack channel
   # Page on-call DBA
   ```

3. **Stop dual-write triggers** (if needed):
   ```sql
   -- Disable triggers temporarily
   ALTER TABLE revenue_transactions DISABLE TRIGGER revenue_transactions_dual_write_trigger;
   ALTER TABLE expense_transactions DISABLE TRIGGER expense_transactions_dual_write_trigger;
   ```

4. **Assess data integrity**:
   ```sql
   -- Check row counts
   SELECT 
     'revenue' as table_name,
     (SELECT COUNT(*) FROM revenue_transactions) as legacy_count,
     (SELECT COUNT(*) FROM revenue_transactions_partitioned) as partition_count;
   
   SELECT 
     'expense' as table_name,
     (SELECT COUNT(*) FROM expense_transactions) as legacy_count,
     (SELECT COUNT(*) FROM expense_transactions_partitioned) as partition_count;
   ```

5. **If data loss detected**:
   ```bash
   # Restore from most recent backup
   pg_restore -d hospitality_platform backup_file.dump
   ```

6. **Re-enable triggers** (after fixes):
   ```sql
   ALTER TABLE revenue_transactions ENABLE TRIGGER revenue_transactions_dual_write_trigger;
   ALTER TABLE expense_transactions ENABLE TRIGGER expense_transactions_dual_write_trigger;
   ```

7. **Post-mortem**:
   - Document what went wrong
   - Identify root cause
   - Create action items to prevent recurrence

---

### Rollback Decision Matrix

| Issue | Severity | Action | Timeline |
|-------|----------|--------|----------|
| Error rate > 1% | High | Standard rollback | 15 min |
| Latency +50% | High | Standard rollback | 15 min |
| Row delta > 1000 | Critical | Emergency rollback | Immediate |
| Data corruption | Critical | Emergency rollback + restore | Immediate |
| Cache unavailable | Medium | Continue (has fallback) | Monitor |
| Replica lag > 30s | Medium | Continue (has fallback) | Fix replica |
| Single org affected | Low | Disable for org only | 5 min |

---

## Post-Rollout Verification

### Day 1 After 100% Rollout

- [ ] **Data Integrity Check**:
  ```sql
  -- Comprehensive row count verification
  SELECT 
    'revenue' as table_name,
    (SELECT COUNT(*) FROM revenue_transactions) as legacy,
    (SELECT COUNT(*) FROM revenue_transactions_partitioned) as partitioned,
    ABS((SELECT COUNT(*) FROM revenue_transactions) - 
        (SELECT COUNT(*) FROM revenue_transactions_partitioned)) as delta
  UNION ALL
  SELECT 
    'expense' as table_name,
    (SELECT COUNT(*) FROM expense_transactions) as legacy,
    (SELECT COUNT(*) FROM expense_transactions_partitioned) as partitioned,
    ABS((SELECT COUNT(*) FROM expense_transactions) - 
        (SELECT COUNT(*) FROM expense_transactions_partitioned)) as delta;
  ```

- [ ] **Performance Verification**:
  ```bash
  # Compare query performance
  # Before: Legacy tables
  # After: Partitioned tables
  # Expected: Equal or better
  ```

- [ ] **Error Rates**: Verify error rate < 0.1%
- [ ] **Cache Hit Rate**: Verify hit rate > 70%
- [ ] **User Reports**: Check for any user-reported issues

### Week 1 After 100% Rollout

- [ ] Monitor daily for any anomalies
- [ ] Review partition pruning effectiveness
- [ ] Optimize partition ranges if needed
- [ ] Document any issues and resolutions

### Month 1 After 100% Rollout

- [ ] Consider deprecating legacy tables
- [ ] Plan migration away from dual-write triggers
- [ ] Evaluate cost savings and performance improvements
- [ ] Update disaster recovery procedures

---

## Emergency Contacts

### On-Call Rotation

| Role | Primary | Secondary | Phone |
|------|---------|-----------|-------|
| Platform Engineer | [Name] | [Name] | [Number] |
| Database Administrator | [Name] | [Name] | [Number] |
| Engineering Manager | [Name] | [Name] | [Number] |
| CTO | [Name] | - | [Number] |

### Communication Channels

- **Slack**: #incidents, #platform-engineering
- **PagerDuty**: Platform Engineering service
- **Zoom**: Emergency war room link: [URL]

### Escalation Path

1. **Level 1**: On-call platform engineer (0-15 min)
2. **Level 2**: Database administrator (15-30 min)
3. **Level 3**: Engineering manager (30-60 min)
4. **Level 4**: CTO (60+ min or critical business impact)

---

## Troubleshooting

### Issue: High Row Count Delta

**Symptoms**:
- Row count difference > 100 between legacy and partitioned

**Diagnosis**:
```sql
-- Check recent transactions
SELECT id, created_at, updated_at 
FROM revenue_transactions 
WHERE id NOT IN (SELECT id FROM revenue_transactions_partitioned)
ORDER BY created_at DESC 
LIMIT 100;
```

**Resolution**:
1. Check if dual-write triggers are active
2. Verify triggers are not disabled or erroring
3. Check PostgreSQL logs for trigger errors
4. If systematic, disable feature flag and investigate

### Issue: Cache Performance Degradation

**Symptoms**:
- Cache hit rate drops below 50%
- High cache miss rates

**Diagnosis**:
```bash
curl http://production.app/monitoring/cache/invalidation-metrics | jq '.cacheHitStats'
```

**Resolution**:
1. Check if Redis is available
2. Verify Redis memory limits not exceeded
3. Check cache TTL configuration
4. Review cache invalidation patterns

### Issue: Replica Lag Increasing

**Symptoms**:
- Replica lag > 30 seconds
- Read queries timing out

**Diagnosis**:
```bash
curl http://production.app/database/replica/lag
```

**Resolution**:
1. Check network latency between primary and replica
2. Verify replica disk I/O performance
3. Check for long-running transactions blocking replication
4. Temporarily route reads to primary if critical

### Issue: Partition Pruning Not Working

**Symptoms**:
- Queries scanning all partitions
- Poor query performance

**Diagnosis**:
```sql
EXPLAIN ANALYZE 
SELECT * FROM revenue_transactions_partitioned 
WHERE date >= '2024-01-01' AND date < '2024-02-01';
-- Check which partitions are scanned
```

**Resolution**:
1. Ensure queries include partition key in WHERE clause
2. Verify partition constraints are correct
3. Run ANALYZE on partitioned tables
4. Consider adjusting partition strategy

---

## Summary Checklist

### Before Rollout
- [ ] All infrastructure provisioned
- [ ] Data parity verified
- [ ] Tests passing
- [ ] Team briefed
- [ ] Monitoring ready

### During Rollout
- [ ] Feature flag updated
- [ ] Metrics monitored continuously
- [ ] Issues documented
- [ ] Communication maintained

### After Rollout
- [ ] Data integrity verified
- [ ] Performance validated
- [ ] No critical alerts
- [ ] Documentation updated
- [ ] Post-mortem (if issues)

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-11-07 | Platform Team | Initial version |

## Related Documents

- [Redis Provisioning Guide](redis_provisioning.md)
- [PgBouncer Setup Guide](pgbouncer_setup.md)
- [Replica Manager Initialization](replica_initialization.md)
- [Monitoring Endpoints Reference](../monitoring/MONITORING_ENDPOINTS_REFERENCE.md)
