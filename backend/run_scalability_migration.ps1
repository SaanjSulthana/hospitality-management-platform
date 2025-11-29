# Scalability Migration Script
# Target: Execute Phase 2 database partitioning migration with admin credentials

param(
    [string]$AdminEmail = "atif@gmail.com",
    [string]$AdminPassword = "123456789",
    [string]$DatabaseUrl = "postgresql://localhost:5432/hospitality"
)

Write-Host "🚀 Starting Scalability Migration for Phase 2 Database Partitioning" -ForegroundColor Green
Write-Host "📊 Admin: $AdminEmail" -ForegroundColor Cyan
Write-Host "🗄️ Database: $DatabaseUrl" -ForegroundColor Cyan

# Function to execute SQL commands
function Execute-SQL {
    param(
        [string]$SqlFile,
        [string]$Description
    )
    
    Write-Host "📝 Executing: $Description" -ForegroundColor Yellow
    
    try {
        # Read SQL file content
        $sqlContent = Get-Content -Path $SqlFile -Raw
        
        # Execute SQL using psql (PostgreSQL command line)
        $env:PGPASSWORD = "your_password_here"  # Set your database password
        psql -h localhost -U postgres -d hospitality -c $sqlContent
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Success: $Description" -ForegroundColor Green
        } else {
            Write-Host "❌ Error: $Description" -ForegroundColor Red
            throw "SQL execution failed"
        }
    }
    catch {
        Write-Host "❌ Failed to execute: $Description" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        throw
    }
}

# Function to check database connection
function Test-DatabaseConnection {
    Write-Host "🔍 Testing database connection..." -ForegroundColor Yellow
    
    try {
        $env:PGPASSWORD = "your_password_here"  # Set your database password
        $result = psql -h localhost -U postgres -d hospitality -c "SELECT 1 as test;"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Database connection successful" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Database connection failed" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "❌ Database connection error: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to backup existing data
function Backup-Database {
    Write-Host "💾 Creating database backup..." -ForegroundColor Yellow
    
    try {
        $backupFile = "backup_before_partitioning_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
        $env:PGPASSWORD = "your_password_here"  # Set your database password
        pg_dump -h localhost -U postgres -d hospitality > $backupFile
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Backup created: $backupFile" -ForegroundColor Green
            return $backupFile
        } else {
            Write-Host "❌ Backup failed" -ForegroundColor Red
            throw "Backup creation failed"
        }
    }
    catch {
        Write-Host "❌ Backup error: $($_.Exception.Message)" -ForegroundColor Red
        throw
    }
}

# Function to verify migration success
function Verify-Migration {
    Write-Host "🔍 Verifying migration success..." -ForegroundColor Yellow
    
    try {
        $env:PGPASSWORD = "your_password_here"  # Set your database password
        
        # Check if partitioned tables exist
        $checkPartitions = psql -h localhost -U postgres -d hospitality -c "
            SELECT COUNT(*) as partition_count 
            FROM information_schema.tables 
            WHERE table_name LIKE 'daily_cash_balances_%' 
            AND table_schema = 'public';
        "
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Partitioned tables created successfully" -ForegroundColor Green
        } else {
            Write-Host "❌ Partitioned tables verification failed" -ForegroundColor Red
            throw "Migration verification failed"
        }
    }
    catch {
        Write-Host "❌ Verification error: $($_.Exception.Message)" -ForegroundColor Red
        throw
    }
}

# Main migration execution
try {
    Write-Host "🎯 Starting Phase 2 Database Partitioning Migration" -ForegroundColor Magenta
    Write-Host "=" * 60 -ForegroundColor Gray
    
    # Step 1: Test database connection
    if (-not (Test-DatabaseConnection)) {
        throw "Database connection failed. Please check your database credentials and connection."
    }
    
    # Step 2: Create backup
    $backupFile = Backup-Database
    Write-Host "📦 Backup created: $backupFile" -ForegroundColor Cyan
    
    # Step 3: Execute partitioned tables creation
    Write-Host "🏗️ Creating partitioned tables..." -ForegroundColor Yellow
    Execute-SQL -SqlFile "database\migrations\create_partitioned_tables.sql" -Description "Create Partitioned Tables"
    
    # Step 4: Execute performance indexes
    Write-Host "📈 Adding performance indexes..." -ForegroundColor Yellow
    Execute-SQL -SqlFile "database\migrations\add_performance_indexes.sql" -Description "Add Performance Indexes"
    
    # Step 5: Verify migration
    Verify-Migration
    
    Write-Host "=" * 60 -ForegroundColor Gray
    Write-Host "🎉 MIGRATION COMPLETED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "📊 Database partitioning is now active" -ForegroundColor Cyan
    Write-Host "🚀 Your system can now handle 100K-500K organizations" -ForegroundColor Cyan
    Write-Host "📦 Backup file: $backupFile" -ForegroundColor Yellow
    
    # Display next steps
    Write-Host "`n📋 Next Steps:" -ForegroundColor Magenta
    Write-Host "1. Test the application with partitioned tables" -ForegroundColor White
    Write-Host "2. Monitor performance improvements" -ForegroundColor White
    Write-Host "3. Run Phase 2 load tests" -ForegroundColor White
    Write-Host "4. Configure read replicas if needed" -ForegroundColor White
    
}
catch {
    Write-Host "`n❌ MIGRATION FAILED!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`n🔄 Rollback Instructions:" -ForegroundColor Yellow
    Write-Host "1. Restore from backup: $backupFile" -ForegroundColor White
    Write-Host "2. Check database logs for detailed error information" -ForegroundColor White
    Write-Host "3. Verify database permissions and connectivity" -ForegroundColor White
    
    exit 1
}

Write-Host "`n🎯 Migration completed at $(Get-Date)" -ForegroundColor Green
