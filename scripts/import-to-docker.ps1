# Import Data to Docker PostgreSQL
# This script imports exported data into Docker PostgreSQL

Write-Host "📥 Importing Data to Docker PostgreSQL..." -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

# Check if Docker PostgreSQL is running
Write-Host "🔍 Checking Docker PostgreSQL..." -ForegroundColor Yellow
$postgresRunning = docker ps --filter "name=hospitality-postgres" --format "table {{.Names}}" | Select-String "hospitality-postgres"

if (!$postgresRunning) {
    Write-Host "❌ Docker PostgreSQL not running. Starting it..." -ForegroundColor Red
    docker-compose up -d postgres
    Start-Sleep -Seconds 5
}

Write-Host "✅ Docker PostgreSQL is running" -ForegroundColor Green

# Import data from CSV files
$exportDir = "data-exports"
if (!(Test-Path $exportDir)) {
    Write-Host "❌ Export directory not found. Run export script first." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📊 Importing data..." -ForegroundColor Cyan

# Import users
if (Test-Path "$exportDir/users.csv") {
    Write-Host "👥 Importing users..."
    docker exec -i hospitality-postgres psql -U hospitality_user -d hospitality_platform -c "COPY users FROM STDIN WITH CSV HEADER" < "$exportDir/users.csv"
}

# Import organizations
if (Test-Path "$exportDir/organizations.csv") {
    Write-Host "🏢 Importing organizations..."
    docker exec -i hospitality-postgres psql -U hospitality_user -d hospitality_platform -c "COPY organizations FROM STDIN WITH CSV HEADER" < "$exportDir/organizations.csv"
}

# Import properties
if (Test-Path "$exportDir/properties.csv") {
    Write-Host "🏢 Importing properties..."
    docker exec -i hospitality-postgres psql -U hospitality_user -d hospitality_platform -c "COPY properties FROM STDIN WITH CSV HEADER" < "$exportDir/properties.csv"
}

# Import staff
if (Test-Path "$exportDir/staff.csv") {
    Write-Host "👨‍💼 Importing staff..."
    docker exec -i hospitality-postgres psql -U hospitality_user -d hospitality_platform -c "COPY staff FROM STDIN WITH CSV HEADER" < "$exportDir/staff.csv"
}

# Import tasks
if (Test-Path "$exportDir/tasks.csv") {
    Write-Host "📋 Importing tasks..."
    docker exec -i hospitality-postgres psql -U hospitality_user -d hospitality_platform -c "COPY tasks FROM STDIN WITH CSV HEADER" < "$exportDir/tasks.csv"
}

# Import expenses
if (Test-Path "$exportDir/expenses.csv") {
    Write-Host "💰 Importing expenses..."
    docker exec -i hospitality-postgres psql -U hospitality_user -d hospitality_platform -c "COPY expenses FROM STDIN WITH CSV HEADER" < "$exportDir/expenses.csv"
}

# Import revenues
if (Test-Path "$exportDir/revenues.csv") {
    Write-Host "💵 Importing revenues..."
    docker exec -i hospitality-postgres psql -U hospitality_user -d hospitality_platform -c "COPY revenues FROM STDIN WITH CSV HEADER" < "$exportDir/revenues.csv"
}

Write-Host ""
Write-Host "✅ Data import completed!" -ForegroundColor Green
Write-Host "🔍 Verifying data..." -ForegroundColor Yellow

# Verify data
docker exec hospitality-postgres psql -U hospitality_user -d hospitality_platform -c "SELECT COUNT(*) as user_count FROM users;"
docker exec hospitality-postgres psql -U hospitality_user -d hospitality_platform -c "SELECT COUNT(*) as task_count FROM tasks;"
docker exec hospitality-postgres psql -U hospitality_user -d hospitality_platform -c "SELECT COUNT(*) as property_count FROM properties;"
