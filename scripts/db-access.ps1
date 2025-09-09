# Database Access Helper Script
# This script ensures you always use the correct database connection

Write-Host "🔍 Accessing Encore Database..." -ForegroundColor Green
Write-Host "📊 This connects to the APPLICATION database with proper context" -ForegroundColor Yellow
Write-Host "⚠️  DO NOT use Docker direct connection - it shows different data!" -ForegroundColor Red
Write-Host ""

# Change to backend directory
Set-Location "backend"

# Connect to Encore database
Write-Host "🚀 Connecting to Encore database shell..." -ForegroundColor Cyan
encore db shell hospitality
