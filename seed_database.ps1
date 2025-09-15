# Script to seed the database with demo data
Write-Host "🌱 Seeding database with demo data..." -ForegroundColor Green

try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:4000/seed/data" -Method POST -ContentType "application/json" -Body "{}"
    Write-Host "✅ $($response.message)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Demo credentials:" -ForegroundColor Cyan
    Write-Host "• Admin: admin@example.com / password123" -ForegroundColor White
    Write-Host "• Manager: manager@example.com / password123" -ForegroundColor White
    Write-Host "• Property Manager: property@example.com / password123" -ForegroundColor White
    Write-Host "• Department Head: dept@example.com / password123" -ForegroundColor White
    Write-Host "• Staff 1: staff1@example.com / password123" -ForegroundColor White
    Write-Host "• Staff 2: staff2@example.com / password123" -ForegroundColor White
} catch {
    Write-Host "❌ Failed to seed database: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Make sure the backend is running on http://127.0.0.1:4000" -ForegroundColor Yellow
}





