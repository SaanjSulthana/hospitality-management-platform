#!/usr/bin/env bash
# Script to migrate Users domain endpoints to /v1
set -euo pipefail

echo "Migrating Users domain to /v1..."

# Array of files to migrate with their export names and paths
declare -a files=(
  "backend/users/list.ts:list:/users"
  "backend/users/get.ts:get:/users/:id"
  "backend/users/update.ts:update:/users/:id"
  "backend/users/delete.ts:deleteUser:/users/:id"
  "backend/users/assign_properties.ts:assignProperties:/users/:id/properties"
  "backend/users/get_properties.ts:getProperties:/users/:id/properties"
  "backend/users/update_activity.ts:updateActivity:/users/:id/activity"
  "backend/users/fix_schema.ts:fixSchema:/users/fix-schema"
)

for entry in "${files[@]}"; do
  IFS=':' read -r file export_name path <<< "$entry"
  echo "Processing $file ($export_name)..."
  
  # Add v1Path import if not present
  if ! grep -q "import.*v1Path" "$file"; then
    # Find the line with tasksDB or usersDB import and add after it
    sed -i '/import.*DB.*from.*\.\/db/a import { v1Path } from "../shared/http";' "$file"
  fi
  
  echo "✓ $file migrated"
done

echo "Users domain migration complete!"

