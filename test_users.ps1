# Script to verify demo users
Write-Host "Verifying demo users..." -ForegroundColor Green

$demoUsers = @(
    "admin@example.com",
    "manager@example.com", 
    "property@example.com",
    "dept@example.com",
    "staff1@example.com",
    "staff2@example.com"
)

$successCount = 0
$totalCount = $demoUsers.Count

foreach ($email in $demoUsers) {
    try {
        $loginData = @{ email = $email; password = "password123" } | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:4000/auth/login" -Method POST -ContentType "application/json" -Body $loginData
        
        if ($response.accessToken) {
            Write-Host "SUCCESS: $email" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "FAILED: $email - No token" -ForegroundColor Red
        }
    } catch {
        Write-Host "FAILED: $email - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Summary: $successCount/$totalCount users working" -ForegroundColor Cyan

if ($successCount -eq $totalCount) {
    Write-Host "All demo users are working!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Access your application:" -ForegroundColor Cyan
    Write-Host "Frontend: http://localhost:5173" -ForegroundColor White
    Write-Host "Backend API: http://127.0.0.1:4000" -ForegroundColor White
    Write-Host "Development Dashboard: http://127.0.0.1:9400/hospitality-management-platform-cr8i" -ForegroundColor White
    Write-Host ""
    Write-Host "Demo Credentials (all use password123):" -ForegroundColor Cyan
    Write-Host "admin@example.com" -ForegroundColor White
    Write-Host "manager@example.com" -ForegroundColor White
    Write-Host "property@example.com" -ForegroundColor White
    Write-Host "dept@example.com" -ForegroundColor White
    Write-Host "staff1@example.com" -ForegroundColor White
    Write-Host "staff2@example.com" -ForegroundColor White
} else {
    Write-Host "Some users are not working. Check the errors above." -ForegroundColor Yellow
}




