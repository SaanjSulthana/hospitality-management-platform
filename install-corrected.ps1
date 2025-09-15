# Hospitality Management Platform Installation Script for Windows
# Run this script in PowerShell as Administrator

Write-Host "🚀 Setting up Hospitality Management Platform..." -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
    
    # Check Node.js version
    $majorVersion = [int]($nodeVersion -replace 'v', '' -split '\.')[0]
    if ($majorVersion -lt 18) {
        Write-Host "❌ Node.js version 18+ is required. Current version: $nodeVersion" -ForegroundColor Red
        Write-Host "   Download from: https://nodejs.org/" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18+ first." -ForegroundColor Red
    Write-Host "   Download from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check if Bun is installed
try {
    $bunVersion = bun --version
    Write-Host "✅ Bun is already installed: $bunVersion" -ForegroundColor Green
} catch {
    Write-Host "📦 Installing Bun package manager..." -ForegroundColor Yellow
    try {
        Invoke-WebRequest -Uri "https://bun.sh/install.ps1" -OutFile "install-bun.ps1"
        & .\install-bun.ps1
        Remove-Item "install-bun.ps1"
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        Write-Host "✅ Bun installed successfully" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to install Bun. Please install manually from: https://bun.sh/" -ForegroundColor Red
        exit 1
    }
}

# Check if Encore CLI is installed
try {
    $encoreVersion = encore version
    Write-Host "✅ Encore CLI is already installed: $encoreVersion" -ForegroundColor Green
} catch {
    Write-Host "📦 Installing Encore CLI..." -ForegroundColor Yellow
    try {
        Invoke-WebRequest -Uri "https://encore.dev/install.ps1" -OutFile "install-encore.ps1"
        & .\install-encore.ps1
        Remove-Item "install-encore.ps1"
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        Write-Host "✅ Encore CLI installed successfully" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to install Encore CLI. Please install manually from: https://encore.dev/docs/install" -ForegroundColor Red
        exit 1
    }
}

# Check if Docker is running
try {
    $dockerVersion = docker --version
    Write-Host "✅ Docker is installed: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Docker is not installed. Please install Docker Desktop from: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    Write-Host "   Docker is required for database services." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow

# Install root dependencies
Write-Host "Installing root dependencies..." -ForegroundColor Cyan
bun install

# Install backend dependencies
Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
Set-Location backend
bun install
Set-Location ..

# Install frontend dependencies
Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
Set-Location frontend
bun install
Set-Location ..

Write-Host ""
Write-Host "🔧 Setting up environment..." -ForegroundColor Yellow

# Copy environment file if it doesn't exist
if (-not (Test-Path ".env")) {
    Copy-Item "env.example" ".env"
    Write-Host "✅ Created .env file from template" -ForegroundColor Green
    Write-Host "⚠️  Please edit .env file with your actual configuration values" -ForegroundColor Yellow
} else {
    Write-Host "✅ .env file already exists" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎉 Installation completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Install Docker Desktop if not already installed" -ForegroundColor White
Write-Host "2. Start Docker services: docker-compose up -d postgres redis" -ForegroundColor White
Write-Host "3. Start the backend: bun run dev:backend" -ForegroundColor White
Write-Host "4. Start the frontend: bun run dev:frontend" -ForegroundColor White
Write-Host "5. Or run both: bun run dev" -ForegroundColor White
Write-Host ""
Write-Host "Backend will be available at: http://localhost:4000" -ForegroundColor White
Write-Host "Frontend will be available at: http://localhost:5173" -ForegroundColor White
Write-Host ""
Write-Host "Happy coding! 🚀" -ForegroundColor Green