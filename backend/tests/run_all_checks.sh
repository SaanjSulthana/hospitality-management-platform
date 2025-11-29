#!/bin/bash
# Comprehensive Test Runner
# Runs all smoke tests and observability checks

set -e

ENVIRONMENT=${1:-development}
BASE_URL=${BASE_URL:-http://localhost:4000}

echo "=========================================="
echo " Running Comprehensive Checks"
echo " Environment: $ENVIRONMENT"
echo " Base URL: $BASE_URL"
echo "=========================================="
echo ""

# Track overall success
ALL_PASSED=true

# Run smoke tests
echo "=========================================="
echo "STEP 1: Running Smoke Tests"
echo "=========================================="
if bash $(dirname $0)/smoke_tests.sh $ENVIRONMENT; then
  echo -e "\n✓ Smoke tests passed\n"
else
  echo -e "\n✗ Smoke tests failed\n"
  ALL_PASSED=false
fi

# Run observability checks
echo "=========================================="
echo "STEP 2: Running Observability Checks"
echo "=========================================="
if bash $(dirname $0)/observability_checks.sh; then
  echo -e "\n✓ Observability checks passed\n"
else
  echo -e "\n✗ Observability checks failed\n"
  ALL_PASSED=false
fi

echo "=========================================="
echo " FINAL RESULT"
echo "=========================================="

if $ALL_PASSED; then
  echo "✓ ALL CHECKS PASSED"
  echo "System is ready for deployment to $ENVIRONMENT"
  exit 0
else
  echo "✗ SOME CHECKS FAILED"
  echo "Review failures above before deployment"
  exit 1
fi

