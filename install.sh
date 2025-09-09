#!/bin/bash

echo "🚀 Setting up Hospitality Management Platform..."
echo "================================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo "📦 Installing Bun package manager..."
    curl -fsSL https://bun.sh/install | bash
    source ~/.bashrc
else
    echo "✅ Bun is already installed: $(bun --version)"
fi

# Check if Encore CLI is installed
if ! command -v encore &> /dev/null; then
    echo "📦 Installing Encore CLI..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install encoredev/tap/encore
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        curl -L https://encore.dev/install.sh | bash
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        # Windows
        iwr https://encore.dev/install.ps1 | iex
    else
        echo "❌ Unsupported operating system. Please install Encore manually."
        echo "   Visit: https://encore.dev/docs/install"
        exit 1
    fi
else
    echo "✅ Encore CLI is already installed: $(encore version)"
fi

# Check if PostgreSQL is running
if ! pg_isready -q; then
    echo "⚠️  PostgreSQL is not running. Please start PostgreSQL service."
    echo "   On macOS: brew services start postgresql"
    echo "   On Linux: sudo systemctl start postgresql"
    echo "   On Windows: Start PostgreSQL service from Services"
fi

echo ""
echo "📦 Installing dependencies..."

# Install root dependencies
echo "Installing root dependencies..."
bun install

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend
bun install
cd ..

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend
bun install
cd ..

echo ""
echo "🔧 Setting up environment..."

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    cp env.example .env
    echo "✅ Created .env file from template"
    echo "⚠️  Please edit .env file with your actual configuration values"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "🗄️  Setting up database..."

# Run database migrations
cd backend
echo "Running database migrations..."
encore db migrate

echo ""
echo "🌱 Seeding database with demo data..."
encore db seed

cd ..

echo ""
echo "🎉 Installation completed successfully!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Start the backend: bun run dev:backend"
echo "3. Start the frontend: bun run dev:frontend"
echo "4. Or run both: bun run dev"
echo ""
echo "Backend will be available at: http://localhost:4000"
echo "Frontend will be available at: http://localhost:5173"
echo ""
echo "Happy coding! 🚀"
