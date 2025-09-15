# Script to verify all demo users are working
Write-Host "🔍 Verifying demo users..." -ForegroundColor Green

$demoUsers = @(
    @{ email = "admin@example.com"; role = "ADMIN"; name = "Demo Administrator" },
    @{ email = "manager@example.com"; role = "MANAGER"; name = "Demo Manager" },
    @{ email = "property@example.com"; role = "MANAGER"; name = "Property Manager Demo" },
    @{ email = "dept@example.com"; role = "MANAGER"; name = "Department Head Demo" },
    @{ email = "staff1@example.com"; role = "MANAGER"; name = "Front Desk Staff Demo" },
    @{ email = "staff2@example.com"; role = "MANAGER"; name = "Housekeeping Staff Demo" }
)

$successCount = 0
$totalCount = $demoUsers.Count

foreach ($user in $demoUsers) {
    try {
        $loginData = @{ email = $user.email; password = "password123" } | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:4000/auth/login" -Method POST -ContentType "application/json" -Body $loginData
        
        if ($response.accessToken) {
            Write-Host "✅ $($user.name) ($($user.email)) - $($user.role)" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "❌ $($user.name) ($($user.email)) - No token received" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ $($user.name) ($($user.email)) - Login failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "📊 Summary: $successCount/$totalCount users working" -ForegroundColor Cyan

if ($successCount -eq $totalCount) {
    Write-Host "🎉 All demo users are working correctly!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 Access your application:" -ForegroundColor Cyan
    Write-Host "• Frontend: http://localhost:5173" -ForegroundColor White
    Write-Host "• Backend API: http://127.0.0.1:4000" -ForegroundColor White
    Write-Host "• Development Dashboard: http://127.0.0.1:9400/hospitality-management-platform-cr8i" -ForegroundColor White
    Write-Host ""
    Write-Host "🔑 Demo Credentials:" -ForegroundColor Cyan
    Write-Host "• Admin: admin@example.com / password123" -ForegroundColor White
    Write-Host "• Manager: manager@example.com / password123" -ForegroundColor White
    Write-Host "• Property Manager: property@example.com / password123" -ForegroundColor White
    Write-Host "• Department Head: dept@example.com / password123" -ForegroundColor White
    Write-Host "• Staff 1: staff1@example.com / password123" -ForegroundColor White
    Write-Host "• Staff 2: staff2@example.com / password123" -ForegroundColor White
} else {
    Write-Host "⚠️  Some users are not working. Check the errors above." -ForegroundColor Yellow
}




