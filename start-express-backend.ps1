# PowerShell script to start Express.js backend
Write-Host "🚀 Starting Express.js Backend for Hospitality Management Platform" -ForegroundColor Green

# Navigate to backend directory
Set-Location -Path "backend"

# Copy the Express package.json
Write-Host "📦 Setting up Express backend..." -ForegroundColor Yellow
Copy-Item "package-express.json" "package.json" -Force

# Install dependencies
Write-Host "📥 Installing dependencies..." -ForegroundColor Yellow
npm install

# Copy environment file if it doesn't exist
if (-not (Test-Path ".env")) {
    Write-Host "📝 Creating .env file..." -ForegroundColor Yellow
    Copy-Item "../env.example" ".env" -Force
}

# Start the server
Write-Host "🎯 Starting Express server..." -ForegroundColor Green
Write-Host "Backend will be available at: http://localhost:4000" -ForegroundColor Cyan
Write-Host "Health check: http://localhost:4000/health" -ForegroundColor Cyan
Write-Host "" 
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

npm run dev
