# Encore Cache Tiered Rollout Guide

## Overview

This guide provides step-by-step instructions for safely rolling out the tiered cache architecture (L1 Memory + L2 Encore Cache + optional L3 Redis) to staging and production environments.

## Pre-Rollout Checklist

- [ ] All cache backend implementations tested
- [ ] Tiered cache backfill logic verified
- [ ] Metrics and observability endpoints working
- [ ] Backout procedure documented and understood
- [ ] Staging environment ready for canary testing
- [ ] SLO/SLI dashboards configured

## Phase 1: Development Validation (Complete)

**Status**: ✅ Complete

**Configuration**:
```bash
CACHE_TIERING=L1
```

**Validation**:
- Unit tests passing
- Integration tests passing
- Manual testing completed

## Phase 2: Staging Canary (10% Traffic)

**Timeline**: 2-3 days

**Configuration**:
```bash
NODE_ENV=staging
CACHE_TIERING=L1L2
CACHE_ENCORE_MAX_ENTRIES=100000
CACHE_METRICS_ENABLED=true
```

**Rollout Steps**:

1. **Deploy to 10% of staging instances**:
   ```bash
   # Using your deployment tool
   encore deploy staging --canary-percentage=10
   ```

2. **Monitor key metrics** (30 minutes):
   - Cache hit rate: Should be > 70%
   - p95 latency: Should be < 100ms
   - Error rate: Should be < 0.1%
   - Memory usage: Should be stable

3. **Verify health endpoints**:
   ```bash
   curl https://staging.yourapp.encr.app/cache/health
   ```

   Expected response includes:
   ```json
   {
     "service": "CacheService",
     "status": "healthy",
     "tierMetrics": {
       "hits": 1234,
       "misses": 56,
       "lastHitTier": "L1-Memory",
       "latencyP50": 5,
       "latencyP95": 15
     }
   }
   ```

4. **Check SLO Dashboard**:
   - Navigate to monitoring dashboard
   - Verify all SLIs are green:
     - Availability: > 99.5%
     - Latency p95: < 100ms
     - Error rate: < 0.1%
     - Cache hit rate: > 70%

**Success Criteria**:
- No increase in error rates
- Cache hit rate > 70%
- p95 latency within SLO (< 100ms)
- No memory leaks or crashes
- Tier backfill working correctly

**Rollback Trigger**:
- Error rate > 1%
- p95 latency > 200ms
- Memory usage growing unbounded
- Cache backend unavailable for > 5 minutes

**Rollback Procedure**:
```bash
# Update environment variable
CACHE_TIERING=L1

# Redeploy
encore deploy staging --fast-rollback
```

## Phase 3: Staging Full Rollout (100% Traffic)

**Timeline**: 3-5 days

**Prerequisites**:
- Phase 2 canary successful for 2-3 days
- All metrics within SLO
- No incidents reported

**Configuration**:
```bash
NODE_ENV=staging
CACHE_TIERING=L1L2
CACHE_ENCORE_MAX_ENTRIES=500000
```

**Rollout Steps**:

1. **Gradual rollout** (25% → 50% → 75% → 100%):
   ```bash
   encore deploy staging --canary-percentage=25
   # Wait 2 hours, monitor metrics
   
   encore deploy staging --canary-percentage=50
   # Wait 4 hours, monitor metrics
   
   encore deploy staging --canary-percentage=75
   # Wait 6 hours, monitor metrics
   
   encore deploy staging --canary-percentage=100
   ```

2. **Monitor continuously** for 72 hours

3. **Load testing**:
   ```bash
   # Simulate production load
   npm run load-test:staging
   ```

**Success Criteria**:
- 72 hours of stable operation
- All SLIs consistently green
- Load test performance acceptable
- No increase in support tickets

## Phase 4: Production Canary (1% Traffic)

**Timeline**: 5-7 days

**Prerequisites**:
- Staging fully rolled out and stable for 5+ days
- Change Advisory Board approval
- On-call engineer briefed
- Runbook reviewed

**Configuration**:
```bash
NODE_ENV=production
CACHE_TIERING=L1L2
CACHE_ENCORE_MAX_ENTRIES=1000000
CACHE_METRICS_ENABLED=true
```

**Rollout Steps**:

1. **Deploy to 1% of production**:
   ```bash
   encore deploy production --canary-percentage=1
   ```

2. **Monitor intensively** (24 hours):
   - Set up dedicated Slack channel
   - Assign on-call engineer
   - Monitor every 15 minutes for first 4 hours
   - Then hourly for remaining 20 hours

3. **Automated health checks**:
   ```bash
   # Set up automated checks
   */15 * * * * curl -f https://api.yourapp.com/cache/health || alert-oncall
   ```

4. **Review business metrics**:
   - User-reported issues
   - API response times
   - Customer satisfaction scores

**Success Criteria**:
- 24 hours without incidents
- All SLOs maintained
- No customer complaints
- Business metrics unaffected

**Rollback Trigger**:
- ANY production incident
- Error rate > 0.5%
- p95 latency > 150ms
- Customer complaints received

**Emergency Rollback**:
```bash
# Immediate rollback
CACHE_TIERING=L1
encore deploy production --emergency-rollback
```

## Phase 5: Production Gradual Rollout

**Timeline**: 7-14 days

**Rollout Schedule**:
- Day 1-2: 1% → 5%
- Day 3-4: 5% → 10%
- Day 5-6: 10% → 25%
- Day 7-9: 25% → 50%
- Day 10-12: 50% → 75%
- Day 13-14: 75% → 100%

**At each step**:
1. Deploy new percentage
2. Monitor for minimum 24 hours
3. Verify SLOs maintained
4. Get stakeholder approval
5. Proceed to next step

## Phase 6: Optional L3 Redis (Heavy Workloads)

**Use case**: Only if L1+L2 insufficient for specific heavy keys

**Configuration**:
```bash
CACHE_TIERING=L1L2L3
REDIS_HOST=your-redis-cluster.cache.amazonaws.com
REDIS_PORT=6379
REDIS_USE_TLS=true
```

**When to enable**:
- Cache eviction rate > 10%
- Specific org/property with extremely high traffic
- Need for persistent cache across deployments

## SLO/SLI Definitions

### Service Level Indicators (SLIs)

1. **Availability**: % of successful cache operations
2. **Latency p50**: Median cache operation latency
3. **Latency p95**: 95th percentile latency
4. **Latency p99**: 99th percentile latency
5. **Error Rate**: % of failed cache operations
6. **Cache Hit Rate**: % of cache hits vs total requests

### Service Level Objectives (SLOs)

| Metric | Staging SLO | Production SLO |
|--------|-------------|----------------|
| Availability | > 99.5% | > 99.9% |
| Latency p50 | < 10ms | < 5ms |
| Latency p95 | < 100ms | < 50ms |
| Latency p99 | < 200ms | < 100ms |
| Error Rate | < 0.5% | < 0.1% |
| Cache Hit Rate | > 70% | > 80% |

## Monitoring Dashboards

### Key Metrics to Watch

1. **Cache Operations**:
   - Requests per second
   - Hit rate by tier (L1/L2/L3)
   - Miss rate
   - Eviction count

2. **Performance**:
   - Latency percentiles (p50, p95, p99)
   - Throughput
   - Backfill operations

3. **Resource Usage**:
   - Memory consumption per tier
   - CPU usage
   - Network I/O

4. **Errors**:
   - Cache backend failures
   - Timeout errors
   - Network errors

### Alert Rules

```yaml
# cache-alerts.yaml
alerts:
  - name: CacheErrorRateHigh
    condition: error_rate > 1%
    duration: 5m
    severity: critical
    
  - name: CacheLatencyHigh
    condition: latency_p95 > 100ms
    duration: 10m
    severity: warning
    
  - name: CacheHitRateLow
    condition: hit_rate < 60%
    duration: 15m
    severity: warning
    
  - name: CacheBackendDown
    condition: backend_available == false
    duration: 1m
    severity: critical
```

## Backout Procedures

### Quick Backout (< 5 minutes)

For immediate issues:

```bash
# Set environment variable
export CACHE_TIERING=L1

# Restart application
encore deploy <env> --emergency-rollback

# Verify
curl https://api.yourapp.com/cache/health | jq '.dependencies[0].stats.type'
# Should return: "memory"
```

### Gradual Backout

For non-critical issues:

```bash
# Reduce percentage gradually
encore deploy <env> --canary-percentage=50
# Monitor for 1 hour

encore deploy <env> --canary-percentage=25
# Monitor for 1 hour

encore deploy <env> --canary-percentage=0
# All traffic on old version

# Then update config
CACHE_TIERING=L1
encore deploy <env>
```

## Post-Rollout Review

After successful rollout to 100% production:

1. **Metrics Review** (Week 1):
   - Compare before/after metrics
   - Identify any unexpected patterns
   - Document learnings

2. **Cost Analysis** (Week 2):
   - Encore cache usage costs
   - Infrastructure savings
   - ROI calculation

3. **Performance Optimization** (Week 3-4):
   - Tune TTLs based on real usage
   - Adjust max entries if needed
   - Optimize backfill strategies

4. **Documentation Update**:
   - Update runbooks
   - Share lessons learned
   - Update this guide based on experience

## Support Contacts

- **On-Call Engineer**: [Slack channel or pager]
- **Platform Team**: [Contact info]
- **Encore Support**: support@encore.dev

## Appendix: Common Issues

### Issue: High Eviction Rate

**Symptoms**: Cache hit rate dropping, frequent evictions

**Solution**:
```bash
# Increase max entries
CACHE_ENCORE_MAX_ENTRIES=2000000
```

### Issue: Memory Leak in L1

**Symptoms**: Memory usage growing unbounded

**Solution**:
```bash
# Reduce L1 max entries temporarily
CACHE_MEMORY_MAX_ENTRIES=5000

# Or disable L1 backfill
CACHE_TIERING=L2
```

### Issue: Encore Backend Unavailable

**Symptoms**: All cache operations failing

**Solution**:
```bash
# Immediate fallback to L1
CACHE_TIERING=L1
```

Check Encore status page and contact support.

---

**Document Version**: 1.0
**Last Updated**: 2025-11-07
**Next Review**: After production rollout completion

