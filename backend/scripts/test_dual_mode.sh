#!/bin/bash

# Dual-Mode Test Runner
# Runs tests in both legacy and partitioned modes to verify compatibility

set -e

echo "======================================================================"
echo "Dual-Mode Test Runner"
echo "======================================================================"
echo ""
echo "This script runs tests in both legacy and partitioned table modes"
echo "to ensure the application works correctly with either configuration."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results tracking
LEGACY_TESTS_PASSED=false
PARTITIONED_TESTS_PASSED=false

echo "======================================================================"
echo "Phase 1: Running tests in LEGACY mode (USE_PARTITIONED_TABLES=false)"
echo "======================================================================"
echo ""

export USE_PARTITIONED_TABLES=false
export LOG_PARTITION_ROUTING=true

if npm test -- --testPathPattern="(partition_routing|dual_mode)" --silent; then
    echo -e "${GREEN}✅ Legacy mode tests PASSED${NC}"
    LEGACY_TESTS_PASSED=true
else
    echo -e "${RED}❌ Legacy mode tests FAILED${NC}"
    LEGACY_TESTS_PASSED=false
fi

echo ""
echo "======================================================================"
echo "Phase 2: Running tests in PARTITIONED mode (USE_PARTITIONED_TABLES=true)"
echo "======================================================================"
echo ""

export USE_PARTITIONED_TABLES=true
export LOG_PARTITION_ROUTING=true

if npm test -- --testPathPattern="(partition_routing|dual_mode)" --silent; then
    echo -e "${GREEN}✅ Partitioned mode tests PASSED${NC}"
    PARTITIONED_TESTS_PASSED=true
else
    echo -e "${RED}❌ Partitioned mode tests FAILED${NC}"
    PARTITIONED_TESTS_PASSED=false
fi

echo ""
echo "======================================================================"
echo "Test Results Summary"
echo "======================================================================"
echo ""

if [ "$LEGACY_TESTS_PASSED" = true ]; then
    echo -e "${GREEN}✅ Legacy Mode: PASSED${NC}"
else
    echo -e "${RED}❌ Legacy Mode: FAILED${NC}"
fi

if [ "$PARTITIONED_TESTS_PASSED" = true ]; then
    echo -e "${GREEN}✅ Partitioned Mode: PASSED${NC}"
else
    echo -e "${RED}❌ Partitioned Mode: FAILED${NC}"
fi

echo ""

# Final result
if [ "$LEGACY_TESTS_PASSED" = true ] && [ "$PARTITIONED_TESTS_PASSED" = true ]; then
    echo -e "${GREEN}======================================================================"
    echo -e "🎉 SUCCESS: All tests passed in both modes!"
    echo -e "======================================================================${NC}"
    exit 0
else
    echo -e "${RED}======================================================================"
    echo -e "❌ FAILURE: Some tests failed!"
    echo -e "======================================================================${NC}"
    exit 1
fi

