# Database Verification Script
# This script helps verify which database connection to use

Write-Host "🔍 Database Connection Verification" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host ""

Write-Host "1️⃣ Checking Docker PostgreSQL (Raw Database):" -ForegroundColor Yellow
$dockerResult = docker exec hospitality-postgres psql -U hospitality_user -d hospitality_platform -c "SELECT COUNT(*) as user_count FROM users;" 2>$null
if ($dockerResult) {
    Write-Host "   Docker Users: $($dockerResult -split "`n" | Select-String "user_count" -Context 1)" -ForegroundColor Red
} else {
    Write-Host "   Docker connection failed" -ForegroundColor Red
}

Write-Host ""
Write-Host "2️⃣ Checking Encore Database (Application Database):" -ForegroundColor Yellow
Write-Host "   Use: cd backend && encore db shell hospitality" -ForegroundColor Cyan
Write-Host "   Then run: SELECT COUNT(*) FROM users;" -ForegroundColor Cyan

Write-Host ""
Write-Host "📊 Expected Results:" -ForegroundColor Green
Write-Host "   - Docker: Usually shows 0-1 users (seed data)" -ForegroundColor White
Write-Host "   - Encore: Shows actual application users (6+ users)" -ForegroundColor White

Write-Host ""
Write-Host "✅ Use Encore database for application development!" -ForegroundColor Green
