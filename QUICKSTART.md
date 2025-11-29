# 🚀 Quick Start Guide

Get your Hospitality Management Platform running in minutes!

## 📚 Development Resources
- **[DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)** - Comprehensive development rules and patterns
- **[QUICK_CHECKLIST.md](./QUICK_CHECKLIST.md)** - Quick reference checklist for developers
- **This file** - Setup and quick start instructions

## Prerequisites

- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Bun** - Fast package manager (will be installed automatically)
- **Encore CLI** - Backend framework (will be installed automatically)
- **Docker** - For database services (optional but recommended)

## 🎯 Option 1: One-Click Installation (Recommended)

### Windows Users
```powershell
# Run PowerShell as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\install.ps1
```

### macOS/Linux Users
```bash
# Make script executable
chmod +x install.sh

# Run installation
./install.sh
```

## 🎯 Option 2: Manual Installation

### 1. Install Dependencies

```bash
# Install Bun (if not already installed)
npm install -g bun

# Install Encore CLI
# macOS
brew install encoredev/tap/encore

# Linux
curl -L https://encore.dev/install.sh | bash

# Windows
iwr https://encore.dev/install.ps1 | iex
```

### 2. Install Project Dependencies

```bash
# Root dependencies
bun install

# Backend dependencies
cd backend
bun install
cd ..

# Frontend dependencies
cd frontend
bun install
cd ..
```

### 3. Set Up Database

```bash
# Start database services with Docker
docker-compose up -d postgres redis

# Or use your existing PostgreSQL installation
# Make sure it's running on localhost:5432
```

### 4. Configure Environment

```bash
# Copy environment template
cp env.example .env

# Edit .env with your database credentials
# Update DATABASE_URL, JWT_SECRET, etc.
```

### 5. Run Database Migrations

```bash
cd backend
encore db migrate
encore db seed
cd ..
```

## 🚀 Start Development

### Start Both Services
```bash
# Run backend and frontend simultaneously
bun run dev
```

### Start Services Separately
```bash
# Backend only (http://localhost:4000)
bun run dev:backend

# Frontend only (http://localhost:5173)
bun run dev:frontend
```

## 🌐 Access Your Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:4000
- **Database**: localhost:5432
- **pgAdmin**: http://localhost:5050 (admin@hospitality.com / admin123)

## 🔧 Development Commands

```bash
# Generate frontend client from backend
bun run gen:client

# Database operations
bun run db:migrate    # Run migrations
bun run db:reset      # Reset database
bun run db:seed       # Seed demo data

# Build for production
bun run build
```

## 📁 Project Structure

```
hospitality-management-platform/
├── backend/                 # Encore.ts backend
│   ├── auth/               # Authentication services
│   ├── properties/         # Property management
│   ├── staff/              # Staff management
│   ├── tasks/              # Task management
│   ├── finance/            # Financial tracking
│   └── analytics/          # Reporting & analytics
├── frontend/               # React frontend
│   ├── components/         # Reusable UI components
│   ├── pages/              # Application pages
│   ├── contexts/           # React contexts
│   └── lib/                # Utility functions
└── docker-compose.yml      # Development services
```

## 🐛 Troubleshooting

### Common Issues

**1. Port Already in Use**
```bash
# Kill process using port 4000
lsof -ti:4000 | xargs kill -9

# Kill process using port 5173
lsof -ti:5173 | xargs kill -9
```

**2. Database Connection Failed**
```bash
# Check if PostgreSQL is running
docker-compose ps

# Restart database services
docker-compose restart postgres
```

**3. Dependencies Installation Failed**
```bash
# Clear cache and reinstall
bun cache rm
rm -rf node_modules
bun install
```

**4. Encore CLI Not Found**
```bash
# Restart terminal or reload shell
source ~/.bashrc  # Linux/macOS
# Or restart PowerShell on Windows
```

### Getting Help

- Check the [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed setup
- Review [README.md](./README.md) for project overview
- Visit [Encore Documentation](https://encore.dev/docs)

## 🎉 Next Steps

1. **Explore the Dashboard** - Navigate to http://localhost:5173
2. **Create an Organization** - Set up your first hotel/resort
3. **Add Properties** - Create rooms and units
4. **Invite Staff** - Add team members
5. **Customize Branding** - Update colors and logos

Happy coding! 🚀

first docker desktop and start docker services
docker-compose up -d postgres redis


cd backend
encore run

cd frontend
bun run dev

kill backend running to restart backend : taskkill /F /IM encore.exe

database commands
cd backend
encore db shell hospitality

⚠️ IMPORTANT: Database Connection Method
- ALWAYS use: encore db shell hospitality
- NEVER use: docker exec hospitality-postgres psql...
- Reason: Encore manages application data with proper context
- Docker connection shows raw PostgreSQL (different data)

Quick database access:
Windows: .\scripts\db-access.ps1
Linux/Mac: ./scripts/db-access.sh

see the errors 
cd, npx tsc --noEmit

docker-compose up -d postgres

check backend errors
npx tsc --noEmit --skipLibCheck

## 🔎 Staging: Legacy Usage Logging for /v1 Migration

Enable structured logging for legacy (non-/v1) paths in staging:

```
# keep legacy paths with deprecation headers
ENABLE_LEGACY_ROUTES=true
# do not redirect yet (switch to true after ~2 weeks)
LEGACY_REDIRECT_308=false
# emit JSON log line for each legacy hit
LOG_LEGACY_USAGE=true
```

If using Encore environments:

```
encore env set staging ENABLE_LEGACY_ROUTES true
encore env set staging LEGACY_REDIRECT_308 false
encore env set staging LOG_LEGACY_USAGE true
```

Example log line emitted by `backend/server.cjs`:

```json
{
  "timestamp": "2025-12-01T10:00:00.000Z",
  "type": "legacy_route_access",
  "path": "/finance/revenues",
  "method": "GET",
  "target": "/v1/finance/revenues",
  "userAgent": "Mozilla/5.0 ...",
  "ip": "203.0.113.10"
}
```

Quick dashboard ideas:
- Legacy requests per day: filter `type="legacy_route_access"` and count per day.
- Top legacy paths: group by `path`.
- Top user agents: group by `userAgent`.

Cutover:
```
# enable redirects after ~2 weeks
encore env set staging LEGACY_REDIRECT_308 true

# after ~60–90 days remove legacy
encore env set staging ENABLE_LEGACY_ROUTES false
```