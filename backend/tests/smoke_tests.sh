#!/bin/bash
# Smoke Tests for Partitioned Database Activation
# Usage: ./smoke_tests.sh [environment]
# Example: ./smoke_tests.sh staging

set -e

# Configuration
ENVIRONMENT=${1:-development}
BASE_URL=${BASE_URL:-http://localhost:4000}
EXIT_CODE=0

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
PASSED=0
FAILED=0
WARNINGS=0

echo "====================================="
echo "  Smoke Tests - $ENVIRONMENT"
echo "  Base URL: $BASE_URL"
echo "====================================="
echo ""

# Helper function to run test
run_test() {
  local test_name=$1
  local command=$2
  local expected=$3
  
  echo -n "Testing: $test_name... "
  
  result=$(eval $command 2>&1)
  
  if echo "$result" | grep -q "$expected"; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}✗ FAIL${NC}"
    echo "  Expected: $expected"
    echo "  Got: $result"
    ((FAILED++))
    EXIT_CODE=1
    return 1
  fi
}

# Helper function for warning
run_warning_check() {
  local test_name=$1
  local command=$2
  local threshold=$3
  
  echo -n "Checking: $test_name... "
  
  result=$(eval $command 2>&1)
  
  if [ "$result" -lt "$threshold" ] 2>/dev/null || echo "$result" | grep -q "true"; then
    echo -e "${GREEN}✓ OK${NC}"
    ((PASSED++))
    return 0
  else
    echo -e "${YELLOW}⚠ WARNING${NC}"
    echo "  Threshold: $threshold"
    echo "  Got: $result"
    ((WARNINGS++))
    return 1
  fi
}

echo "===================================="
echo "1. SYSTEM HEALTH CHECKS"
echo "===================================="

# Test 1: Overall system health
run_test "System Health Endpoint" \
  "curl -sf $BASE_URL/monitoring/unified/health | jq -r '.healthy'" \
  "true"

# Test 2: System status
run_test "System Status" \
  "curl -sf $BASE_URL/monitoring/unified/health | jq -r '.status'" \
  "healthy"

# Test 3: All health checks passing
run_test "All Health Checks Pass" \
  "curl -sf $BASE_URL/monitoring/unified/health | jq '.checks[] | select(.passed == false) | .name' | wc -l" \
  "0"

echo ""
echo "===================================="
echo "2. PARTITION SYNC CHECKS"
echo "===================================="

# Test 4: Partition metrics endpoint
run_test "Partition Metrics Endpoint" \
  "curl -sf $BASE_URL/monitoring/partitions/metrics | jq -r '.partitionedTablesEnabled'" \
  "true\|false"

# Test 5: Revenue transactions sync
run_warning_check "Revenue Transactions Sync (delta < 10)" \
  "curl -sf $BASE_URL/monitoring/partitions/metrics | jq '.tables[] | select(.name == \"revenue_transactions\") | .rowCountDelta | if . < 0 then -. else . end'" \
  "10"

# Test 6: Expense transactions sync
run_warning_check "Expense Transactions Sync (delta < 10)" \
  "curl -sf $BASE_URL/monitoring/partitions/metrics | jq '.tables[] | select(.name == \"expense_transactions\") | .rowCountDelta | if . < 0 then -. else . end'" \
  "10"

# Test 7: Partitions exist
run_test "Partitions Created" \
  "curl -sf $BASE_URL/monitoring/partitions/metrics | jq '.tables[] | select(.partitionCount > 0) | .name' | wc -l" \
  "[12]"

# Test 8: Switchover readiness
if [ "$ENVIRONMENT" != "development" ]; then
  run_warning_check "Switchover Readiness" \
    "curl -sf $BASE_URL/monitoring/partitions/metrics | jq -r '.switchoverReadiness.ready'" \
    "true"
fi

echo ""
echo "===================================="
echo "3. CACHE PERFORMANCE CHECKS"
echo "===================================="

# Test 9: Cache metrics endpoint
run_test "Cache Metrics Endpoint" \
  "curl -sf $BASE_URL/monitoring/cache/invalidation-metrics | jq -r '.cacheAvailable'" \
  "true\|false"

# Test 10: Cache type (prefer Redis)
CACHE_TYPE=$(curl -sf $BASE_URL/monitoring/cache/invalidation-metrics | jq -r '.cacheType')
echo -n "Checking: Cache Type... "
if [ "$CACHE_TYPE" = "redis" ]; then
  echo -e "${GREEN}✓ Redis${NC}"
  ((PASSED++))
elif [ "$CACHE_TYPE" = "memory" ]; then
  echo -e "${YELLOW}⚠ In-Memory (Redis unavailable)${NC}"
  ((WARNINGS++))
else
  echo -e "${RED}✗ Unknown type: $CACHE_TYPE${NC}"
  ((FAILED++))
  EXIT_CODE=1
fi

# Test 11: Cache hit rate (if requests > 100)
TOTAL_REQUESTS=$(curl -sf $BASE_URL/monitoring/cache/invalidation-metrics | jq -r '.cacheHitStats.totalRequests')
if [ "$TOTAL_REQUESTS" -gt 100 ] 2>/dev/null; then
  run_warning_check "Cache Hit Rate (> 50%)" \
    "curl -sf $BASE_URL/monitoring/cache/invalidation-metrics | jq -r '.cacheHitStats.hitRate'" \
    "50"
else
  echo "Skipping: Cache Hit Rate (insufficient requests: $TOTAL_REQUESTS)"
fi

# Test 12: Cache performance (avg get time < 100ms)
run_warning_check "Cache GET Performance (< 100ms)" \
  "curl -sf $BASE_URL/monitoring/cache/invalidation-metrics | jq -r '.performance.avgGetTime'" \
  "100"

echo ""
echo "===================================="
echo "4. DATABASE REPLICA CHECKS"
echo "===================================="

# Test 13: Database info endpoint
run_test "Database Info Endpoint" \
  "curl -sf $BASE_URL/database/info | jq -r '.primaryConnected'" \
  "true"

# Test 14: Replica health (if enabled)
REPLICAS_ENABLED=$(curl -sf $BASE_URL/database/info | jq -r '.replicasEnabled')
if [ "$REPLICAS_ENABLED" = "true" ]; then
  run_test "Replica Health Endpoint" \
    "curl -sf $BASE_URL/database/replica/health | jq -r '.healthy'" \
    "true"
  
  # Test 15: Replica lag
  run_warning_check "Replica Lag (< 30s)" \
    "curl -sf $BASE_URL/database/replica/lag | jq -r '.maxLag'" \
    "30"
else
  echo "Skipping: Replica checks (replicas not enabled)"
fi

echo ""
echo "===================================="
echo "5. ALERT CHECKS"
echo "===================================="

# Test 16: No critical alerts
run_test "No Critical Alerts" \
  "curl -sf $BASE_URL/monitoring/unified/metrics | jq -r '.alerts.critical'" \
  "0"

# Test 17: Warning alerts (acceptable)
WARNING_COUNT=$(curl -sf $BASE_URL/monitoring/unified/metrics | jq -r '.alerts.warning')
echo -n "Checking: Warning Alerts... "
if [ "$WARNING_COUNT" -eq 0 ]; then
  echo -e "${GREEN}✓ None${NC}"
  ((PASSED++))
elif [ "$WARNING_COUNT" -lt 5 ]; then
  echo -e "${YELLOW}⚠ $WARNING_COUNT warnings${NC}"
  ((WARNINGS++))
else
  echo -e "${RED}✗ Too many warnings: $WARNING_COUNT${NC}"
  ((FAILED++))
  EXIT_CODE=1
fi

echo ""
echo "===================================="
echo "6. CACHE SERVICE CHECKS"
echo "===================================="

# Test 18: Cache service health
run_test "Cache Service Health" \
  "curl -sf $BASE_URL/cache/health | jq -r '.status'" \
  "healthy"

# Test 19: Cache service stats
run_test "Cache Service Stats Endpoint" \
  "curl -sf $BASE_URL/cache/stats | jq -r '.redisStats.type'" \
  "redis\|memory"

echo ""
echo "===================================="
echo "7. UNIFIED METRICS CHECKS"
echo "===================================="

# Test 20: Unified metrics endpoint
run_test "Unified Metrics Endpoint" \
  "curl -sf $BASE_URL/monitoring/unified/metrics | jq -r '.system.status'" \
  "healthy\|degraded"

# Test 21: System uptime
UPTIME=$(curl -sf $BASE_URL/monitoring/unified/metrics | jq -r '.system.uptime')
echo -n "Checking: System Uptime... "
if [ "$UPTIME" -gt 0 ] 2>/dev/null; then
  echo -e "${GREEN}✓ ${UPTIME}s${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ Invalid uptime: $UPTIME${NC}"
  ((FAILED++))
  EXIT_CODE=1
fi

echo ""
echo "===================================="
echo "8. FUNCTIONAL TESTS"
echo "===================================="

# Test 22: Can fetch partition table stats (if authenticated)
if [ -n "$AUTH_TOKEN" ]; then
  run_test "Partition Table Stats (Auth)" \
    "curl -sf -H 'Authorization: Bearer $AUTH_TOKEN' $BASE_URL/monitoring/partitions/table-stats?tableName=revenue_transactions | jq -r '.tableName'" \
    "revenue_transactions"
else
  echo "Skipping: Authenticated endpoints (no AUTH_TOKEN provided)"
fi

# Test 23: Alert history endpoint (if authenticated)
if [ -n "$AUTH_TOKEN" ]; then
  run_test "Alert History Endpoint (Auth)" \
    "curl -sf -H 'Authorization: Bearer $AUTH_TOKEN' $BASE_URL/monitoring/unified/alerts | jq -r '.total' | grep -E '^[0-9]+$'" \
    ".*"
else
  echo "Skipping: Alert history (no AUTH_TOKEN provided)"
fi

echo ""
echo "====================================="
echo "  TEST RESULTS SUMMARY"
echo "====================================="
echo -e "${GREEN}Passed:${NC}   $PASSED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "${RED}Failed:${NC}   $FAILED"
echo ""

if [ $FAILED -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
  echo "System is ready for production deployment"
  exit 0
elif [ $FAILED -eq 0 ]; then
  echo -e "${YELLOW}⚠ TESTS PASSED WITH WARNINGS${NC}"
  echo "System is functional but has non-critical issues"
  exit 0
else
  echo -e "${RED}✗ TESTS FAILED${NC}"
  echo "System has critical issues that must be resolved"
  exit $EXIT_CODE
fi

