# Test Execution Guide

## Overview

This guide explains how to run smoke tests and observability checks for the partitioned database activation infrastructure.

## Test Scripts

### 1. Smoke Tests (`smoke_tests.sh`)

Validates core functionality of the system including:
- System health
- Partition synchronization
- Cache performance
- Database replica status
- Alert system
- Functional endpoints

### 2. Observability Checks (`observability_checks.sh`)

Validates monitoring infrastructure including:
- All monitoring endpoints
- Metric collection
- Data consistency
- Performance metrics
- Alert generation
- Continuous monitoring readiness

### 3. Comprehensive Test Runner (`run_all_checks.sh`)

Runs all tests in sequence and provides consolidated results.

---

## Prerequisites

### Required Tools

- `bash` (4.0+)
- `curl`
- `jq` (JSON processor)
- `bc` (calculator for numeric comparisons)

Install on Ubuntu/Debian:
```bash
sudo apt-get install jq bc
```

Install on macOS:
```bash
brew install jq
```

### Running Application

Ensure the application is running before executing tests:

```bash
# Development
cd backend
encore run

# Or with Docker
docker-compose up
```

---

## Running Tests

### Quick Start

Run all tests:
```bash
cd backend/tests
bash run_all_checks.sh development
```

### Individual Test Suites

**Smoke Tests**:
```bash
bash backend/tests/smoke_tests.sh development
```

**Observability Checks**:
```bash
backend/tests/observability_checks.sh
```

### Environment-Specific Testing

**Development**:
```bash
BASE_URL=http://localhost:4000 bash backend/tests/smoke_tests.sh development
```

**Staging**:
```bash
BASE_URL=https://staging.api.app bash backend/tests/smoke_tests.sh staging
```

**Production** (read-only checks):
```bash
BASE_URL=https://api.production.app bash backend/tests/smoke_tests.sh production
```

### With Authentication

Some endpoints require authentication:

```bash
export AUTH_TOKEN="your-jwt-token-here"
bash backend/tests/smoke_tests.sh staging
```

### Verbose Mode

Enable verbose output:
```bash
VERBOSE=true bash backend/tests/observability_checks.sh
```

---

## Test Categories

### 1. System Health Checks

Tests basic system availability and health status.

**Tests**:
- System health endpoint responds
- Overall status is healthy
- All health checks pass

**Expected Results**:
```json
{
  "healthy": true,
  "status": "healthy",
  "checks": [
    {"name": "Partition Sync", "passed": true},
    {"name": "Cache Availability", "passed": true},
    {"name": "Replica Health", "passed": true}
  ]
}
```

### 2. Partition Sync Checks

Validates partition table synchronization with legacy tables.

**Tests**:
- Partition metrics endpoint accessible
- Revenue transactions delta < 10 rows
- Expense transactions delta < 10 rows
- Partitions exist and are active
- Switchover readiness

**Acceptance Criteria**:
- Row count delta must be < 10 for PASS
- Delta < 100 for WARNING
- Delta >= 100 for FAIL

### 3. Cache Performance Checks

Validates cache availability and performance.

**Tests**:
- Cache metrics endpoint accessible
- Cache type (Redis preferred)
- Cache hit rate > 50%
- Cache GET performance < 100ms

**Thresholds**:
- Hit rate > 80%: Excellent
- Hit rate > 50%: Acceptable
- Hit rate < 50%: WARNING

### 4. Database Replica Checks

Validates read replica health and replication lag.

**Tests**:
- Database info endpoint
- Replica health status
- Replication lag < 30 seconds
- Connection pool utilization

**Thresholds**:
- Lag < 10s: Excellent
- Lag < 30s: Acceptable
- Lag >= 30s: CRITICAL

### 5. Alert Checks

Validates alert system functionality.

**Tests**:
- No critical alerts
- Warning alerts < 5
- Alert history accessible

**Alert Levels**:
- **Critical**: Requires immediate action
- **Warning**: Should be investigated
- **Info**: Informational only

### 6. Functional Tests

Validates authenticated endpoints (optional).

**Tests**:
- Partition table stats endpoint
- Alert history endpoint
- Alert acknowledgment

**Note**: Requires `AUTH_TOKEN` environment variable

---

## Exit Codes

Tests use standard exit codes:

- `0`: All tests passed
- `1`: Some tests failed (critical)
- `2`: Tests passed with warnings (non-critical)

### Example Usage in CI/CD

```yaml
# .github/workflows/tests.yml
- name: Run Smoke Tests
  run: |
    bash backend/tests/smoke_tests.sh staging
  continue-on-error: false

- name: Run Observability Checks
  run: |
    bash backend/tests/observability_checks.sh
  continue-on-error: false
```

---

## Interpreting Results

### Test Output Format

```
Testing: System Health Endpoint... ✓ PASS
Testing: Partition Metrics Endpoint... ✓ PASS
Checking: Cache Hit Rate... ⚠ WARNING
  Threshold: 50
  Got: 45.5
Testing: No Critical Alerts... ✗ FAIL
  Expected: 0
  Got: 1
```

### Result Summary

```
=====================================
  TEST RESULTS SUMMARY
=====================================
Passed:   18
Warnings: 2
Failed:   1

✗ TESTS FAILED
System has critical issues that must be resolved
```

### Status Indicators

- `✓` Green: Test passed
- `⚠` Yellow: Warning (non-critical issue)
- `✗` Red: Test failed (critical issue)

---

## Continuous Integration

### GitHub Actions

```yaml
name: Smoke Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  smoke-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: |
          npm install -g encore
          cd backend && npm install
      
      - name: Start application
        run: |
          cd backend && encore run &
          sleep 30  # Wait for startup
      
      - name: Run smoke tests
        run: |
          bash backend/tests/smoke_tests.sh development
      
      - name: Run observability checks
        run: |
          bash backend/tests/observability_checks.sh
```

### GitLab CI

```yaml
smoke-tests:
  stage: test
  image: node:20
  before_script:
    - npm install -g encore
    - cd backend && npm install
  script:
    - encore run &
    - sleep 30
    - bash tests/smoke_tests.sh development
    - bash tests/observability_checks.sh
  artifacts:
    when: always
    reports:
      junit: test-results.xml
```

---

## Troubleshooting

### Common Issues

#### 1. "Connection refused" errors

**Symptom**:
```
curl: (7) Failed to connect to localhost port 4000: Connection refused
```

**Solution**:
- Ensure application is running
- Check correct BASE_URL
- Verify port is not blocked by firewall

#### 2. "jq: command not found"

**Symptom**:
```
./smoke_tests.sh: line 45: jq: command not found
```

**Solution**:
```bash
# Ubuntu/Debian
sudo apt-get install jq

# macOS
brew install jq

# Windows (Git Bash)
# Download from https://stedolan.github.io/jq/download/
```

#### 3. High row count delta

**Symptom**:
```
Checking: Revenue Transactions Sync... ⚠ WARNING
  Threshold: 10
  Got: 150
```

**Solution**:
- Check if dual-write triggers are active
- Verify triggers are not erroring
- Check PostgreSQL logs
- Consider running data reconciliation

#### 4. Low cache hit rate

**Symptom**:
```
Checking: Cache Hit Rate... ⚠ WARNING
  Threshold: 50
  Got: 25.5
```

**Solution**:
- Check if Redis is available
- Verify cache TTL configuration
- Review cache invalidation patterns
- Check for cache warming

#### 5. High replica lag

**Symptom**:
```
Checking: Replica Lag... ✗ FAIL
  Threshold: 30
  Got: 125
```

**Solution**:
- Check network latency between primary and replica
- Verify replica resources (CPU, memory, disk I/O)
- Check for long-running transactions
- Review replication configuration

---

## Manual Verification

If automated tests fail, manually verify key endpoints:

```bash
# System health
curl http://localhost:4000/monitoring/unified/health | jq .

# Partition metrics
curl http://localhost:4000/monitoring/partitions/metrics | jq .

# Cache metrics
curl http://localhost:4000/monitoring/cache/invalidation-metrics | jq .

# Database status
curl http://localhost:4000/database/info | jq .
```

---

## Scheduling Automated Tests

### Cron Job (Linux/macOS)

Run tests daily at 2 AM:
```bash
0 2 * * * /path/to/backend/tests/run_all_checks.sh production 2>&1 | mail -s "Daily Smoke Tests" ops@example.com
```

### Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (daily, 2:00 AM)
4. Action: Start a program
5. Program: `C:\Program Files\Git\bin\bash.exe`
6. Arguments: `C:\path\to\backend\tests\run_all_checks.sh production`

---

## Test Maintenance

### Adding New Tests

1. Add test function to appropriate script:
```bash
# In smoke_tests.sh
run_test "My New Test" \
  "curl -sf $BASE_URL/my/endpoint | jq -r '.status'" \
  "expected_value"
```

2. Update test counters
3. Document in this guide

### Updating Thresholds

Adjust thresholds based on production metrics:

```bash
# Cache hit rate threshold
run_warning_check "Cache Hit Rate (> 70%)" \
  "curl -sf $BASE_URL/monitoring/cache/invalidation-metrics | jq -r '.cacheHitStats.hitRate'" \
  "70"  # Adjust this value
```

### Deprecating Tests

1. Comment out test in script
2. Document reason in comments
3. Remove after 2 releases

---

## Best Practices

1. **Run tests before deployment** to catch issues early
2. **Monitor test duration** to detect performance regressions
3. **Keep thresholds realistic** based on actual production metrics
4. **Review failed tests immediately** to prevent cascading issues
5. **Update tests** when adding new features or endpoints
6. **Document exceptions** when tests must be skipped
7. **Automate in CI/CD** for continuous validation
8. **Alert on failures** to ensure rapid response

---

## Related Documentation

- [Rollout & Rollback Handbook](../infrastructure/ROLLOUT_ROLLBACK_HANDBOOK.md)
- [Monitoring Dashboards](../monitoring/MONITORING_DASHBOARDS.md)
- [Observability Endpoints Reference](../monitoring/MONITORING_ENDPOINTS_REFERENCE.md)

---

## Support

For issues or questions:
- **Slack**: #platform-engineering
- **Email**: platform-team@example.com
- **On-call**: PagerDuty - Platform Engineering

