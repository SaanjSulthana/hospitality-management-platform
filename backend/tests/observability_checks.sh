#!/bin/bash
# Observability Checks for Monitoring Infrastructure
# Validates all monitoring endpoints and metrics collection

set -e

BASE_URL=${BASE_URL:-http://localhost:4000}
VERBOSE=${VERBOSE:-false}

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

echo "=========================================="
echo " Observability Infrastructure Validation"
echo " Base URL: $BASE_URL"
echo "=========================================="
echo ""

# Helper function
check_endpoint() {
  local name=$1
  local url=$2
  local expected_field=$3
  
  echo -n "Checking $name... "
  
  response=$(curl -sf $url 2>&1)
  http_code=$?
  
  if [ $http_code -eq 0 ]; then
    # Check if response contains expected field
    if echo "$response" | jq -e "$expected_field" > /dev/null 2>&1; then
      echo -e "${GREEN}✓${NC}"
      ((PASSED++))
      
      if [ "$VERBOSE" = "true" ]; then
        echo "$response" | jq .
      fi
      
      return 0
    else
      echo -e "${RED}✗ Missing field: $expected_field${NC}"
      ((FAILED++))
      return 1
    fi
  else
    echo -e "${RED}✗ HTTP Error${NC}"
    ((FAILED++))
    return 1
  fi
}

echo "=========================================="
echo "1. UNIFIED MONITORING ENDPOINTS"
echo "=========================================="

check_endpoint "Unified Metrics" \
  "$BASE_URL/monitoring/unified/metrics" \
  ".system.status"

check_endpoint "Unified Health" \
  "$BASE_URL/monitoring/unified/health" \
  ".healthy"

check_endpoint "System Health Checks" \
  "$BASE_URL/monitoring/unified/health" \
  ".checks"

echo ""
echo "=========================================="
echo "2. PARTITION MONITORING ENDPOINTS"
echo "=========================================="

check_endpoint "Partition Metrics" \
  "$BASE_URL/monitoring/partitions/metrics" \
  ".tables"

check_endpoint "Partition Switchover Readiness" \
  "$BASE_URL/monitoring/partitions/metrics" \
  ".switchoverReadiness.ready"

check_endpoint "Partition Table Counts" \
  "$BASE_URL/monitoring/partitions/metrics" \
  ".tables[].rowCount"

echo ""
echo "=========================================="
echo "3. CACHE MONITORING ENDPOINTS"
echo "=========================================="

check_endpoint "Cache Invalidation Metrics" \
  "$BASE_URL/monitoring/cache/invalidation-metrics" \
  ".cacheType"

check_endpoint "Cache Hit Stats" \
  "$BASE_URL/monitoring/cache/invalidation-metrics" \
  ".cacheHitStats"

check_endpoint "Cache Performance" \
  "$BASE_URL/monitoring/cache/invalidation-metrics" \
  ".performance"

check_endpoint "Cache Service Health" \
  "$BASE_URL/cache/health" \
  ".status"

check_endpoint "Cache Service Stats" \
  "$BASE_URL/cache/stats" \
  ".redisStats"

echo ""
echo "=========================================="
echo "4. DATABASE REPLICA ENDPOINTS"
echo "=========================================="

check_endpoint "Database Info" \
  "$BASE_URL/database/info" \
  ".primaryConnected"

check_endpoint "Replica Health" \
  "$BASE_URL/database/replica/health" \
  ".replicas"

check_endpoint "Replica Lag" \
  "$BASE_URL/database/replica/lag" \
  ".maxLag"

check_endpoint "Connection Pool Stats" \
  "$BASE_URL/database/replica/pool-stats" \
  ".primary"

echo ""
echo "=========================================="
echo "5. METRIC FIELD VALIDATION"
echo "=========================================="

echo -n "Validating unified metrics structure... "
METRICS=$(curl -sf $BASE_URL/monitoring/unified/metrics)

# Check all required fields
REQUIRED_FIELDS=(
  ".system.status"
  ".system.uptime"
  ".partitions.enabled"
  ".partitions.synced"
  ".cache.type"
  ".cache.available"
  ".cache.hitRate"
  ".database.replicasEnabled"
  ".alerts.critical"
  ".alerts.warning"
)

ALL_PRESENT=true
for field in "${REQUIRED_FIELDS[@]}"; do
  if ! echo "$METRICS" | jq -e "$field" > /dev/null 2>&1; then
    echo -e "${RED}✗ Missing: $field${NC}"
    ALL_PRESENT=false
    ((FAILED++))
  fi
done

if $ALL_PRESENT; then
  echo -e "${GREEN}✓${NC}"
  ((PASSED++))
fi

echo ""
echo "=========================================="
echo "6. ALERT SYSTEM VALIDATION"
echo "=========================================="

# Test alert generation
echo -n "Testing alert detection... "
ALERTS=$(curl -sf $BASE_URL/monitoring/unified/metrics | jq -r '.alerts')

if echo "$ALERTS" | jq -e '.recentAlerts' > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC}"
  ((PASSED++))
  
  ALERT_COUNT=$(echo "$ALERTS" | jq '.recentAlerts | length')
  echo "  Recent alerts: $ALERT_COUNT"
else
  echo -e "${RED}✗${NC}"
  ((FAILED++))
fi

echo ""
echo "=========================================="
echo "7. DATA CONSISTENCY CHECKS"
echo "=========================================="

# Check partition sync status
echo -n "Checking partition data consistency... "
PARTITION_METRICS=$(curl -sf $BASE_URL/monitoring/partitions/metrics)

SYNC_ISSUES=$(echo "$PARTITION_METRICS" | jq '[.tables[] | select(.lastSyncStatus != "synced")] | length')

if [ "$SYNC_ISSUES" -eq 0 ]; then
  echo -e "${GREEN}✓ All tables synced${NC}"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠ $SYNC_ISSUES tables out of sync${NC}"
  echo "$PARTITION_METRICS" | jq '.tables[] | select(.lastSyncStatus != "synced") | {name, status, delta: .rowCountDelta}'
fi

echo ""
echo "=========================================="
echo "8. PERFORMANCE METRICS VALIDATION"
echo "=========================================="

# Check cache performance
echo -n "Checking cache performance metrics... "
CACHE_METRICS=$(curl -sf $BASE_URL/monitoring/cache/invalidation-metrics)

AVG_GET_TIME=$(echo "$CACHE_METRICS" | jq -r '.performance.avgGetTime')
AVG_SET_TIME=$(echo "$CACHE_METRICS" | jq -r '.performance.avgSetTime')

echo ""
echo "  GET time: ${AVG_GET_TIME}ms"
echo "  SET time: ${AVG_SET_TIME}ms"

if (( $(echo "$AVG_GET_TIME < 50" | bc -l) )); then
  echo -e "  ${GREEN}✓ Excellent performance${NC}"
  ((PASSED++))
elif (( $(echo "$AVG_GET_TIME < 100" | bc -l) )); then
  echo -e "  ${YELLOW}⚠ Acceptable performance${NC}"
  ((PASSED++))
else
  echo -e "  ${RED}✗ Poor performance${NC}"
  ((FAILED++))
fi

echo ""
echo "=========================================="
echo "9. REPLICA HEALTH VALIDATION"
echo "=========================================="

REPLICAS_ENABLED=$(curl -sf $BASE_URL/database/info | jq -r '.replicasEnabled')

if [ "$REPLICAS_ENABLED" = "true" ]; then
  echo -n "Checking replica lag... "
  REPLICA_LAG=$(curl -sf $BASE_URL/database/replica/lag)
  
  MAX_LAG=$(echo "$REPLICA_LAG" | jq -r '.maxLag')
  
  if (( $(echo "$MAX_LAG < 10" | bc -l) )); then
    echo -e "${GREEN}✓ ${MAX_LAG}s${NC}"
    ((PASSED++))
  elif (( $(echo "$MAX_LAG < 30" | bc -l) )); then
    echo -e "${YELLOW}⚠ ${MAX_LAG}s${NC}"
    ((PASSED++))
  else
    echo -e "${RED}✗ ${MAX_LAG}s (too high)${NC}"
    ((FAILED++))
  fi
else
  echo "Replicas not enabled, skipping replica checks"
fi

echo ""
echo "=========================================="
echo "10. MONITORING INTEGRATION TEST"
echo "=========================================="

# Simulate a monitoring workflow
echo "Simulating monitoring workflow..."

echo -n "  1. Check system health... "
HEALTH=$(curl -sf $BASE_URL/monitoring/unified/health | jq -r '.status')
echo "$HEALTH"

echo -n "  2. Get critical alert count... "
CRITICAL=$(curl -sf $BASE_URL/monitoring/unified/metrics | jq -r '.alerts.critical')
echo "$CRITICAL"

echo -n "  3. Check cache availability... "
CACHE_AVAIL=$(curl -sf $BASE_URL/monitoring/cache/invalidation-metrics | jq -r '.cacheAvailable')
echo "$CACHE_AVAIL"

echo -n "  4. Check partition readiness... "
SWITCHOVER=$(curl -sf $BASE_URL/monitoring/partitions/metrics | jq -r '.switchoverReadiness.ready')
echo "$SWITCHOVER"

if [ "$HEALTH" = "healthy" ] && [ "$CRITICAL" -eq 0 ]; then
  echo -e "${GREEN}✓ Monitoring workflow successful${NC}"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠ System has issues${NC}"
fi

echo ""
echo "=========================================="
echo "11. CONTINUOUS MONITORING READINESS"
echo "=========================================="

# Check if endpoints are suitable for continuous monitoring
echo "Testing monitoring endpoint performance..."

START_TIME=$(date +%s%3N)
curl -sf $BASE_URL/monitoring/unified/metrics > /dev/null
END_TIME=$(date +%s%3N)
RESPONSE_TIME=$((END_TIME - START_TIME))

echo -n "  Unified metrics response time: ${RESPONSE_TIME}ms... "
if [ $RESPONSE_TIME -lt 1000 ]; then
  echo -e "${GREEN}✓${NC}"
  ((PASSED++))
elif [ $RESPONSE_TIME -lt 3000 ]; then
  echo -e "${YELLOW}⚠ Slow${NC}"
else
  echo -e "${RED}✗ Too slow for continuous monitoring${NC}"
  ((FAILED++))
fi

echo ""
echo "=========================================="
echo " OBSERVABILITY VALIDATION SUMMARY"
echo "=========================================="
echo -e "${GREEN}Passed:${NC} $PASSED"
echo -e "${RED}Failed:${NC} $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ OBSERVABILITY INFRASTRUCTURE VALIDATED${NC}"
  echo "All monitoring endpoints are functional and performant"
  exit 0
else
  echo -e "${RED}✗ OBSERVABILITY VALIDATION FAILED${NC}"
  echo "Some monitoring endpoints have issues"
  exit 1
fi

