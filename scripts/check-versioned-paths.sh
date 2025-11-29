#!/usr/bin/env bash
set -euo pipefail

# Simple guardrail to ensure all Encore api({ path }) declarations start with /v
# Usage: scripts/check-versioned-paths.sh

echo "Checking Encore path declarations for versioned prefix..."

# Find path: "..." in TS files, exclude those starting with /v
violations=$(grep -R --line-number --include="*.ts" -E 'path:\s*"[^\"]+"' backend | grep -v 'path:\s*"/v[0-9]')

if [[ -n "${violations}" ]]; then
  echo "ERROR: Found unversioned Encore path declarations:"
  echo "${violations}"
  echo
  echo "All Encore api({ path }) strings must start with /v{n} (e.g., /v1/...)."
  exit 1
fi

echo "OK: All Encore paths are versioned."


