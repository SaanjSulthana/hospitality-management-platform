# Script to check database status
Write-Host "🔍 Checking database status..." -ForegroundColor Green

try {
    # Check if backend is running
    $healthResponse = Invoke-RestMethod -Uri "http://127.0.0.1:4000/health" -Method GET
    Write-Host "✅ Backend is running" -ForegroundColor Green
    
    # Try to get organizations
    try {
        $orgsResponse = Invoke-RestMethod -Uri "http://127.0.0.1:4000/orgs" -Method GET
        Write-Host "✅ Organizations endpoint accessible" -ForegroundColor Green
        Write-Host "Organizations: $($orgsResponse | ConvertTo-Json -Depth 2)" -ForegroundColor Cyan
    } catch {
        Write-Host "⚠️  Organizations endpoint not accessible: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    # Try to get users
    try {
        $usersResponse = Invoke-RestMethod -Uri "http://127.0.0.1:4000/users" -Method GET
        Write-Host "✅ Users endpoint accessible" -ForegroundColor Green
        Write-Host "Users: $($usersResponse | ConvertTo-Json -Depth 2)" -ForegroundColor Cyan
    } catch {
        Write-Host "⚠️  Users endpoint not accessible: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Backend is not running or not accessible" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Make sure to run: cd backend; encore run" -ForegroundColor Yellow
}
