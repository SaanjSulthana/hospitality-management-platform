# Create Docker-Only Backend Setup
# This script creates a standalone backend that uses only Docker

Write-Host "🐳 Creating Docker-Only Backend Setup..." -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Green

# Create docker-backend directory
$dockerBackendDir = "docker-backend"
if (!(Test-Path $dockerBackendDir)) {
    New-Item -ItemType Directory -Path $dockerBackendDir
}

Write-Host "📁 Creating docker-backend directory..." -ForegroundColor Yellow

# Create package.json for Docker backend
$packageJson = @"
{
  "name": "hospitality-docker-backend",
  "version": "1.0.0",
  "description": "Standalone Docker backend for Hospitality Management",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "build": "tsc",
    "migrate": "node scripts/migrate.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "dotenv": "^16.3.1",
    "multer": "^1.4.5-lts.1",
    "redis": "^4.6.10"
  },
  "devDependencies": {
    "@types/node": "^20.8.0",
    "@types/express": "^4.17.20",
    "@types/pg": "^8.10.7",
    "@types/bcryptjs": "^2.4.5",
    "@types/jsonwebtoken": "^9.0.4",
    "@types/cors": "^2.8.15",
    "@types/multer": "^1.4.9",
    "nodemon": "^3.0.1",
    "typescript": "^5.2.2"
  }
}
"@

$packageJson | Out-File -FilePath "$dockerBackendDir/package.json" -Encoding UTF8

# Create TypeScript config
$tsConfig = @"
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
"@

$tsConfig | Out-File -FilePath "$dockerBackendDir/tsconfig.json" -Encoding UTF8

# Create environment file
$envFile = @"
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hospitality_platform
DB_USER=hospitality_user
DB_PASSWORD=hospitality_password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=4000
NODE_ENV=development

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
"@

$envFile | Out-File -FilePath "$dockerBackendDir/.env" -Encoding UTF8

Write-Host "✅ Docker backend structure created!" -ForegroundColor Green
Write-Host "📁 Check the '$dockerBackendDir' folder" -ForegroundColor Yellow
