#!/usr/bin/env bash
# Batch migration script for adding /v1 dual exports to Encore endpoints
# This script automates the pattern of:
# 1. Adding v1Path import
# 2. Extracting handler function
# 3. Creating dual exports (legacy + v1)

set -euo pipefail

echo "========================================"
echo " API /v1 Batch Migration Script"
echo "========================================"
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Counter
MIGRATED=0
SKIPPED=0
ERRORS=0

# Function to migrate a single file
migrate_file() {
    local file="$1"
    local domain="$2"
    
    echo -n "Migrating: $(basename "$file")... "
    
    # Check if already migrated (contains v1Path usage)
    if grep -q "v1Path(" "$file" 2>/dev/null; then
        echo -e "${YELLOW}SKIPPED${NC} (already has v1Path)"
        ((SKIPPED++))
        return
    fi
    
    # Check if file contains api exports
    if ! grep -q "export const.*= api<" "$file" 2>/dev/null; then
        echo -e "${YELLOW}SKIPPED${NC} (no API exports found)"
        ((SKIPPED++))
        return
    fi
    
    # Create backup
    cp "$file" "$file.bak"
    
    # This is a placeholder - actual transformation would be done via sed/awk
    # For now, just report what needs manual migration
    echo -e "${GREEN}NEEDS MANUAL MIGRATION${NC}"
    ((MIGRATED++))
    
    # Restore backup (since we're not actually doing auto-migration yet)
    mv "$file.bak" "$file"
}

# Tasks domain files
echo "=== Tasks Domain ==="
for file in backend/tasks/{create,list,update,delete,assign,update_status,update_hours,add_attachment}.ts; do
    if [ -f "$file" ]; then
        migrate_file "$file" "tasks"
    fi
done
echo ""

# Users domain files  
echo "=== Users Domain ==="
for file in backend/users/{create,list,get,update,delete,assign_properties,get_properties,update_activity}.ts; do
    if [ -f "$file" ]; then
        migrate_file "$file" "users"
    fi
done
echo ""

# Finance domain files (remaining)
echo "=== Finance Domain (Remaining CRUD) ==="
for file in backend/finance/{add_revenue,add_expense,get_revenue_by_id,get_expense_by_id,update_revenue,update_expense,delete_revenue,delete_expense,approve_revenue,approve_expense,approve_revenue_by_id,approve_expense_by_id,financial_summary,pending_approvals}.ts; do
    if [ -f "$file" ]; then
        migrate_file "$file" "finance"
    fi
done
echo ""

# Staff domain files (core only)
echo "=== Staff Domain (Core Operations) ==="
for file in backend/staff/{create,list,update,delete,assign_property}.ts; do
    if [ -f "$file" ]; then
        migrate_file "$file" "staff"
    fi
done
echo ""

echo "========================================"
echo " Migration Summary"
echo "========================================"
echo -e "Migrated: ${GREEN}${MIGRATED}${NC}"
echo -e "Skipped:  ${YELLOW}${SKIPPED}${NC}"
echo -e "Errors:   ${RED}${ERRORS}${NC}"
echo ""
echo "NOTE: This script marks files for migration but doesn't transform them."
echo "Files need manual migration following the pattern in:"
echo "  scripts/migrate-remaining-v1-endpoints.md"
echo ""
echo "After manual migration, run:"
echo "  npm run ci:check-versioned-paths"
echo ""

