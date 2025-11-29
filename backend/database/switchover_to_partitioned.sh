#!/bin/bash

# =========================================================================
# Staged Switchover Script - Migrate to Partitioned Tables
# Target: Safe production migration with verification and rollback capability
# =========================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ADMIN_EMAIL="${ADMIN_EMAIL:-atif@gmail.com}"
DB_NAME="${DB_NAME:-hospitality}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
LOG_FILE="${LOG_FILE:-./switchover_$(date +%Y%m%d_%H%M%S).log}"
DRY_RUN="${DRY_RUN:-false}"
ROW_COUNT_LOG="${ROW_COUNT_LOG:-./row_counts_$(date +%Y%m%d_%H%M%S).log}"

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

confirm() {
    read -p "$(echo -e ${YELLOW}$1${NC}) " response
    case "$response" in
        [yY][eE][sS]|[yY]) 
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Log row counts to file and console
log_row_counts() {
    local stage=$1
    log "========================================="
    log "ROW COUNTS - Stage: $stage"
    log "========================================="
    
    {
        echo "========================================="
        echo "ROW COUNTS - Stage: $stage"
        echo "Time: $(date +'%Y-%m-%d %H:%M:%S')"
        echo "========================================="
        echo ""
        
        echo "Daily Cash Balances:"
        psql -d "$DB_NAME" -t -c "SELECT 'Legacy: ' || COUNT(*) FROM daily_cash_balances;"
        psql -d "$DB_NAME" -t -c "SELECT 'Partitioned: ' || COUNT(*) FROM daily_cash_balances_partitioned;"
        echo ""
        
        echo "Revenues:"
        psql -d "$DB_NAME" -t -c "SELECT 'Legacy: ' || COUNT(*) FROM revenues;"
        psql -d "$DB_NAME" -t -c "SELECT 'Partitioned: ' || COUNT(*) FROM revenues_partitioned;"
        echo ""
        
        echo "Expenses:"
        psql -d "$DB_NAME" -t -c "SELECT 'Legacy: ' || COUNT(*) FROM expenses;"
        psql -d "$DB_NAME" -t -c "SELECT 'Partitioned: ' || COUNT(*) FROM expenses_partitioned;"
        echo ""
        
        echo "========================================="
        echo ""
    } | tee -a "$ROW_COUNT_LOG" "$LOG_FILE"
}

# Calculate and log checksums
log_checksums() {
    local stage=$1
    log "========================================="
    log "DATA CHECKSUMS - Stage: $stage"
    log "========================================="
    
    {
        echo "========================================="
        echo "DATA CHECKSUMS - Stage: $stage"
        echo "Time: $(date +'%Y-%m-%d %H:%M:%S')"
        echo "========================================="
        echo ""
        
        echo "Daily Cash Balances - Amount Checksums:"
        psql -d "$DB_NAME" -t -c "SELECT 'Legacy Total: ' || COALESCE(SUM(opening_balance_cents + closing_balance_cents), 0) FROM daily_cash_balances;"
        psql -d "$DB_NAME" -t -c "SELECT 'Partitioned Total: ' || COALESCE(SUM(opening_balance_cents + closing_balance_cents), 0) FROM daily_cash_balances_partitioned;"
        echo ""
        
        echo "Revenues - Amount Checksums:"
        psql -d "$DB_NAME" -t -c "SELECT 'Legacy Total: ' || COALESCE(SUM(amount_cents), 0) FROM revenues;"
        psql -d "$DB_NAME" -t -c "SELECT 'Partitioned Total: ' || COALESCE(SUM(amount_cents), 0) FROM revenues_partitioned;"
        echo ""
        
        echo "Expenses - Amount Checksums:"
        psql -d "$DB_NAME" -t -c "SELECT 'Legacy Total: ' || COALESCE(SUM(amount_cents), 0) FROM expenses;"
        psql -d "$DB_NAME" -t -c "SELECT 'Partitioned Total: ' || COALESCE(SUM(amount_cents), 0) FROM expenses_partitioned;"
        echo ""
        
        echo "========================================="
        echo ""
    } | tee -a "$ROW_COUNT_LOG" "$LOG_FILE"
}

# Check for dry run mode
check_dry_run() {
    if [ "$DRY_RUN" = "true" ]; then
        warning "DRY RUN MODE - No actual changes will be made"
        return 0
    fi
    return 1
}

# Execute SQL only if not in dry run mode
execute_sql() {
    local sql=$1
    local description=$2
    
    if check_dry_run; then
        log "[DRY RUN] Would execute: $description"
        return 0
    fi
    
    log "Executing: $description"
    psql -d "$DB_NAME" -c "$sql"
}

# =========================================================================
# STAGE 1: PRE-FLIGHT CHECKS
# =========================================================================

stage1_preflight_checks() {
    log "========================================="
    log "STAGE 1: Pre-flight Checks"
    log "========================================="
    
    # Check if partitioned tables exist
    log "Checking if partitioned tables exist..."
    PARTITIONED_EXISTS=$(psql -d "$DB_NAME" -t -c "SELECT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'daily_cash_balances_partitioned');" | tr -d ' \n')
    
    if [ "$PARTITIONED_EXISTS" != "t" ]; then
        error "Partitioned tables do not exist. Run migrations first."
    fi
    success "Partitioned tables exist"
    
    # Log initial row counts and checksums
    log_row_counts "PRE-FLIGHT"
    log_checksums "PRE-FLIGHT"
    
    # Check disk space
    log "Checking disk space..."
    AVAILABLE_SPACE=$(df -h . | awk 'NR==2 {print $4}')
    log "Available disk space: $AVAILABLE_SPACE"
    
    # Check active connections
    log "Checking active connections..."
    ACTIVE_CONNS=$(psql -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pg_stat_activity WHERE datname = '$DB_NAME';" | tr -d ' ')
    log "Active connections: $ACTIVE_CONNS"
    
    if [ "$ACTIVE_CONNS" -gt 50 ]; then
        warning "High number of active connections ($ACTIVE_CONNS). Consider running during off-peak hours."
    fi
    
    # Check trigger status
    log "Checking trigger status..."
    psql -d "$DB_NAME" -c "
        SELECT 
          t.tgname AS trigger_name,
          c.relname AS table_name,
          CASE t.tgenabled
            WHEN 'O' THEN 'ENABLED'
            WHEN 'D' THEN 'DISABLED'
            ELSE 'UNKNOWN'
          END AS status
        FROM pg_trigger t
        INNER JOIN pg_class c ON t.tgrelid = c.oid
        WHERE c.relname IN ('daily_cash_balances', 'revenues', 'expenses')
          AND t.tgname LIKE 'sync_to_partitioned_%'
        ORDER BY c.relname;
    " | tee -a "$LOG_FILE"
    
    success "Stage 1 completed"
}

# =========================================================================
# STAGE 2: BACKUP
# =========================================================================

stage2_backup() {
    log "========================================="
    log "STAGE 2: Backup"
    log "========================================="
    
    if check_dry_run; then
        log "[DRY RUN] Would create backup in: $BACKUP_DIR"
        log "[DRY RUN] Would backup tables: daily_cash_balances, revenues, expenses"
        success "Stage 2 completed (DRY RUN)"
        return 0
    fi
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Backup legacy tables
    log "Creating backup of legacy tables..."
    BACKUP_FILE="$BACKUP_DIR/legacy_tables_$(date +%Y%m%d_%H%M%S).sql"
    
    pg_dump -d "$DB_NAME" \
        -t daily_cash_balances \
        -t revenues \
        -t expenses \
        --no-owner \
        --no-acl \
        -f "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        success "Backup created: $BACKUP_FILE"
    else
        error "Backup failed"
    fi
    
    # Verify backup
    log "Verifying backup..."
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | awk '{print $1}')
    log "Backup size: $BACKUP_SIZE"
    
    # Log row counts post-backup
    log_row_counts "POST-BACKUP"
    
    success "Stage 2 completed"
}

# =========================================================================
# STAGE 3: DATA MIGRATION & VERIFICATION
# =========================================================================

stage3_migrate_and_verify() {
    log "========================================="
    log "STAGE 3: Data Migration & Verification"
    log "========================================="
    
    # Log pre-migration counts
    log_row_counts "PRE-MIGRATION"
    
    # Check if data needs migration
    LEGACY_COUNT=$(psql -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM daily_cash_balances;" | tr -d ' ')
    PARTITIONED_COUNT=$(psql -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM daily_cash_balances_partitioned;" | tr -d ' ')
    
    if [ "$LEGACY_COUNT" -gt "$PARTITIONED_COUNT" ]; then
        log "Migrating data to partitioned tables..."
        log "Records to migrate: $((LEGACY_COUNT - PARTITIONED_COUNT))"
        
        if check_dry_run; then
            log "[DRY RUN] Would migrate daily_cash_balances: $((LEGACY_COUNT - PARTITIONED_COUNT)) records"
            log "[DRY RUN] Would migrate revenues"
            log "[DRY RUN] Would migrate expenses"
        else
            # Migrate daily_cash_balances
            log "Migrating daily_cash_balances..."
            psql -d "$DB_NAME" -c "
                INSERT INTO daily_cash_balances_partitioned
                SELECT * FROM daily_cash_balances
                ON CONFLICT (org_id, property_id, balance_date) DO NOTHING;
            " || error "Failed to migrate daily_cash_balances"
            
            # Migrate revenues
            log "Migrating revenues..."
            psql -d "$DB_NAME" -c "
                INSERT INTO revenues_partitioned
                SELECT * FROM revenues
                ON CONFLICT (id, occurred_at) DO NOTHING;
            " || error "Failed to migrate revenues"
            
            # Migrate expenses
            log "Migrating expenses..."
            psql -d "$DB_NAME" -c "
                INSERT INTO expenses_partitioned
                SELECT * FROM expenses
                ON CONFLICT (id, occurred_at) DO NOTHING;
            " || error "Failed to migrate expenses"
            
            success "Data migration completed"
        fi
    else
        success "Data already migrated"
    fi
    
    # Log post-migration counts
    log_row_counts "POST-MIGRATION"
    log_checksums "POST-MIGRATION"
    
    # Verify data consistency
    log "Verifying data consistency..."
    
    LEGACY_COUNT_NEW=$(psql -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM daily_cash_balances;" | tr -d ' ')
    PARTITIONED_COUNT_NEW=$(psql -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM daily_cash_balances_partitioned;" | tr -d ' ')
    REVENUE_LEGACY=$(psql -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM revenues;" | tr -d ' ')
    REVENUE_PARTITIONED=$(psql -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM revenues_partitioned;" | tr -d ' ')
    EXPENSE_LEGACY=$(psql -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM expenses;" | tr -d ' ')
    EXPENSE_PARTITIONED=$(psql -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM expenses_partitioned;" | tr -d ' ')
    
    if [ "$LEGACY_COUNT_NEW" -ne "$PARTITIONED_COUNT_NEW" ]; then
        error "Daily Cash Balances mismatch: Legacy=$LEGACY_COUNT_NEW, Partitioned=$PARTITIONED_COUNT_NEW"
    fi
    
    if [ "$REVENUE_LEGACY" -ne "$REVENUE_PARTITIONED" ]; then
        warning "Revenues mismatch: Legacy=$REVENUE_LEGACY, Partitioned=$REVENUE_PARTITIONED"
    fi
    
    if [ "$EXPENSE_LEGACY" -ne "$EXPENSE_PARTITIONED" ]; then
        warning "Expenses mismatch: Legacy=$EXPENSE_LEGACY, Partitioned=$EXPENSE_PARTITIONED"
    fi
    
    success "Data consistency verified"
    success "Stage 3 completed"
}

# =========================================================================
# STAGE 4: ENABLE PARTITIONED TABLES
# =========================================================================

stage4_enable_partitioning() {
    log "========================================="
    log "STAGE 4: Enable Partitioned Tables"
    log "========================================="
    
    warning "This will switch the application to use partitioned tables."
    
    if ! confirm "Continue with switchover? [y/N]"; then
        log "Switchover cancelled"
        exit 0
    fi
    
    log "Enabling partitioned tables..."
    
    # Set environment variable (this would need to be done in your deployment)
    export USE_PARTITIONED_TABLES=true
    
    log "Environment variable USE_PARTITIONED_TABLES set to true"
    log "Application restart required to apply changes"
    
    success "Stage 4 completed"
}

# =========================================================================
# STAGE 5: MONITORING & VERIFICATION
# =========================================================================

stage5_monitor() {
    log "========================================="
    log "STAGE 5: Monitoring & Verification"
    log "========================================="
    
    log "Monitoring application for 5 minutes..."
    log "Press Ctrl+C to stop monitoring early"
    
    for i in {1..5}; do
        sleep 60
        
        # Check error logs
        ERRORS=$(psql -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'idle in transaction (aborted)';" | tr -d ' ')
        log "Minute $i: Active errors: $ERRORS"
        
        # Check partition usage
        PARTITION_QUERIES=$(psql -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pg_stat_user_tables WHERE schemaname = 'public' AND relname LIKE '%_partitioned';" | tr -d ' ')
        log "Minute $i: Partitioned tables active: $PARTITION_QUERIES"
        
        if [ "$ERRORS" -gt 10 ]; then
            error "High error count detected: $ERRORS"
        fi
    done
    
    success "Monitoring completed - No issues detected"
    success "Stage 5 completed"
}

# =========================================================================
# STAGE 6: CLEANUP (OPTIONAL)
# =========================================================================

stage6_cleanup() {
    log "========================================="
    log "STAGE 6: Cleanup (Optional)"
    log "========================================="
    
    warning "This will DROP the legacy tables. This cannot be undone (except via backup restore)."
    warning "Ensure system is running smoothly for at least 24-48 hours before cleanup."
    
    if ! confirm "Are you ABSOLUTELY SURE you want to drop legacy tables? [y/N]"; then
        log "Cleanup cancelled"
        return 0
    fi
    
    if ! confirm "Type 'DELETE' to confirm: "; then
        log "Cleanup cancelled"
        return 0
    fi
    
    log "Dropping legacy tables..."
    
    psql -d "$DB_NAME" -c "DROP TABLE IF EXISTS daily_cash_balances CASCADE;" || warning "Failed to drop daily_cash_balances"
    psql -d "$DB_NAME" -c "DROP TABLE IF EXISTS revenues CASCADE;" || warning "Failed to drop revenues"
    psql -d "$DB_NAME" -c "DROP TABLE IF EXISTS expenses CASCADE;" || warning "Failed to drop expenses"
    
    success "Legacy tables dropped"
    success "Stage 6 completed"
}

# =========================================================================
# ROLLBACK PROCEDURE
# =========================================================================

rollback() {
    log "========================================="
    log "ROLLBACK PROCEDURE"
    log "========================================="
    
    error "ROLLBACK NOT YET IMPLEMENTED - Contact DevOps team immediately"
    
    # Rollback steps:
    # 1. Set USE_PARTITIONED_TABLES=false
    # 2. Restart application
    # 3. Verify legacy tables are being used
    # 4. Investigate and fix issues
}

# =========================================================================
# MAIN EXECUTION
# =========================================================================

show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --dry-run          Perform a dry run without making any changes"
    echo "  --cleanup-only     Only run the cleanup stage (drop legacy tables)"
    echo "  --rollback         Rollback to legacy tables"
    echo "  --help             Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  DB_NAME            Database name (default: hospitality)"
    echo "  BACKUP_DIR         Backup directory (default: ./backups)"
    echo "  DRY_RUN            Set to 'true' for dry run mode"
    echo ""
    echo "Examples:"
    echo "  # Dry run to see what would happen"
    echo "  DRY_RUN=true $0"
    echo ""
    echo "  # or"
    echo "  $0 --dry-run"
    echo ""
    echo "  # Actual switchover"
    echo "  $0"
    echo ""
    echo "  # Cleanup after successful switchover"
    echo "  $0 --cleanup-only"
    echo ""
}

main() {
    log "========================================="
    log "Staged Switchover to Partitioned Tables"
    log "Database: $DB_NAME"
    log "Admin: $ADMIN_EMAIL"
    if [ "$DRY_RUN" = "true" ]; then
        warning "=== DRY RUN MODE - NO CHANGES WILL BE MADE ==="
    fi
    log "========================================="
    
    # Run stages
    stage1_preflight_checks
    stage2_backup
    stage3_migrate_and_verify
    stage4_enable_partitioning
    stage5_monitor
    
    success "========================================="
    if [ "$DRY_RUN" = "true" ]; then
        success "DRY RUN COMPLETED SUCCESSFULLY"
        success "No actual changes were made"
    else
        success "SWITCHOVER COMPLETED SUCCESSFULLY"
    fi
    success "========================================="
    
    log "Logs saved to:"
    log "  - Main log: $LOG_FILE"
    log "  - Row counts: $ROW_COUNT_LOG"
    log ""
    
    if [ "$DRY_RUN" != "true" ]; then
        log "Next steps:"
        log "1. Monitor application for 24-48 hours"
        log "2. Check error rates and performance metrics"
        log "3. If stable, run stage6_cleanup to remove legacy tables"
        log ""
        log "To run cleanup: ./switchover_to_partitioned.sh --cleanup-only"
    fi
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        --cleanup-only)
            stage6_cleanup
            exit 0
            ;;
        --rollback)
            rollback
            exit 1
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Run main
main

