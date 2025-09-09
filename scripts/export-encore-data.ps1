# Export Data from Encore Database
# This script exports all data from Encore database to SQL files

Write-Host "🔄 Exporting Data from Encore Database..." -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

# Create export directory
$exportDir = "data-exports"
if (!(Test-Path $exportDir)) {
    New-Item -ItemType Directory -Path $exportDir
}

Write-Host "📁 Export directory: $exportDir" -ForegroundColor Yellow

# Change to backend directory
Set-Location "backend"

Write-Host ""
Write-Host "📊 Exporting table data..." -ForegroundColor Cyan

# Export users table
Write-Host "👥 Exporting users..."
encore db shell hospitality -c "COPY (SELECT * FROM users) TO STDOUT WITH CSV HEADER" > "../$exportDir/users.csv"

# Export tasks table
Write-Host "📋 Exporting tasks..."
encore db shell hospitality -c "COPY (SELECT * FROM tasks) TO STDOUT WITH CSV HEADER" > "../$exportDir/tasks.csv"

# Export expenses table
Write-Host "💰 Exporting expenses..."
encore db shell hospitality -c "COPY (SELECT * FROM expenses) TO STDOUT WITH CSV HEADER" > "../$exportDir/expenses.csv"

# Export revenues table
Write-Host "💵 Exporting revenues..."
encore db shell hospitality -c "COPY (SELECT * FROM revenues) TO STDOUT WITH CSV HEADER" > "../$exportDir/revenues.csv"

# Export properties table
Write-Host "🏢 Exporting properties..."
encore db shell hospitality -c "COPY (SELECT * FROM properties) TO STDOUT WITH CSV HEADER" > "../$exportDir/properties.csv"

# Export staff table
Write-Host "👨‍💼 Exporting staff..."
encore db shell hospitality -c "COPY (SELECT * FROM staff) TO STDOUT WITH CSV HEADER" > "../$exportDir/staff.csv"

# Export organizations table
Write-Host "🏢 Exporting organizations..."
encore db shell hospitality -c "COPY (SELECT * FROM organizations) TO STDOUT WITH CSV HEADER" > "../$exportDir/organizations.csv"

Write-Host ""
Write-Host "✅ Data export completed!" -ForegroundColor Green
Write-Host "📁 Check the '$exportDir' folder for exported CSV files" -ForegroundColor Yellow
