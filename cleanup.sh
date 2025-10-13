#!/bin/bash

echo "🧹 Cleaning up unnecessary files..."

# Remove test directories
rm -rf backend/__tests__
rm -rf frontend/__tests__

# Remove test config files
rm -f backend/jest.config.cjs
rm -f frontend/jest.config.cjs
rm -f frontend/setupTests.ts
rm -f frontend/tsconfig.test.json

# Remove database check/test scripts
rm -f check_database_data.sql
rm -f check_database_users.ps1
rm -f check_database.ps1
rm -f check_db.ps1
rm -f check_users.sql
rm -f create-test-user.sql
rm -f test_users.ps1
rm -f verify_demo_users.ps1

# Remove development/debug files
rm -f backend/debug_daily_report.html
rm -f backend/test_daily_report.html
rm -f backend/test_delete_revenue.js
rm -f backend/test_migrations.cjs
rm -f backend/test-static.js
rm -f backend/tsconfig.tsbuildinfo

# Remove migration/fix scripts
rm -f backend/add_missing_staff_fields.sql
rm -f backend/add_payment_columns.sql
rm -f backend/add_staff_columns.sql
rm -f backend/apply_finance_fix.cjs
rm -f backend/apply_finance_fix.js
rm -f backend/call_migration.js
rm -f backend/check_and_create_tables.sql
rm -f backend/check_schema.sql
rm -f backend/check_staff_schema.sql
rm -f backend/clear_migration_state.cjs
rm -f backend/create_missing_tables.sql
rm -f backend/ensure-task-attachments-table.js
rm -f backend/fix_attendance_table.sql
rm -f backend/fix_database_tables.sql
rm -f backend/fix_expense_schema.sql
rm -f backend/fix_finance_migrations.html
rm -f backend/fix_revenue_status.sql
rm -f backend/fix_user_schema_issues.ts
rm -f backend/force_migration_reset.cjs
rm -f backend/reset_finance_migrations.cjs
rm -f backend/run_complete_migration.html
rm -f backend/run_migration.html
rm -f backend/run_migration.sql
rm -f backend/run_payment_migration_direct.ts
rm -f backend/run_reports_migration.html
rm -f backend/run_revenue_status_migration.cjs
rm -f backend/run_revenue_status_migration.js
rm -f backend/run_schema_fix.js
rm -f backend/run_staff_schema_fix.html
rm -f backend/setup_database.ps1
rm -f backend/setup-all-tables.sql
rm -f backend/setup-files-table.sql
rm -f backend/verify_staff_fields.sql

# Remove installation/fix scripts
rm -f fix-all-auth-endpoints.ps1
rm -f fix-all-remaining-errors.ps1
rm -f fix-auth-endpoints.ps1
rm -f install-corrected.ps1
rm -f install-final.ps1
rm -f install-fixed.ps1
rm -f install.ps1
rm -f install.sh
rm -f run_migration.ps1
rm -f seed_database.ps1
rm -f start-express-backend.ps1

# Remove documentation files (keep only essential)
rm -f DEVELOPMENT_GUIDE.md
rm -f DEVELOPMENT.md
rm -f FINANCE_FIX_APPLIED.md
rm -f MICROSERVICE_DEVELOPMENT_GUIDE.md
rm -f QUICK_CHECKLIST.md
rm -f USER_SCHEMA_FIXES_SUMMARY.md
rm -rf docs/

# Remove build/generated files
rm -rf backend/dist/
rm -rf frontend/dist/
rm -rf backend/encore.gen/
rm -rf node_modules/

# Remove lock files (can be regenerated)
rm -f bun.lock
rm -f package-lock.json

# Remove development scripts
rm -rf scripts/

echo "✅ Cleanup completed! Your project is now cleaner and ready for production."
echo "📝 Remember to run 'npm install' or 'bun install' to regenerate dependencies."
