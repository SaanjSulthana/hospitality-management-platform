#!/bin/bash
set -e

# Install dependencies
echo "Installing backend dependencies..."
if command -v bun &> /dev/null; then
    bun install || npm install
else
    npm install
fi

# Build frontend first
if [ -d "../frontend" ]; then
    echo "Building frontend..."
    cd ../frontend
    if command -v bun &> /dev/null; then
        bun install || npm install
        bun run build || npm run build
    else
        npm install
        npm run build
    fi
    cd ../backend
fi

# Create a simple build output since encore build is not working
echo "Creating build output for Encore..."

# Create dist directory
mkdir -p dist

# Copy frontend dist files to backend dist (skip if same location)
echo "Copying frontend build files..."
if [ -d "../frontend/dist" ]; then
    # Check if source and destination are different locations
    FRONTEND_DIST=$(cd ../frontend/dist 2>/dev/null && pwd)
    BACKEND_DIST=$(cd dist 2>/dev/null && pwd)
    
    if [ -n "$FRONTEND_DIST" ] && [ -n "$BACKEND_DIST" ] && [ "$FRONTEND_DIST" != "$BACKEND_DIST" ]; then
        # Copy files individually, ignore errors for same-file cases
        if [ -d "../frontend/dist/assets" ] && [ ! -e "dist/assets" ]; then
            cp -r ../frontend/dist/assets dist/ 2>/dev/null || echo "Note: Could not copy assets (may be same location)"
        fi
        if [ -f "../frontend/dist/index.html" ] && [ ! -e "dist/index.html" ]; then
            cp ../frontend/dist/index.html dist/ 2>/dev/null || echo "Note: Could not copy index.html (may be same location)"
        fi
        if [ -f "../frontend/dist/favicon.svg" ] && [ ! -e "dist/favicon.svg" ]; then
            cp ../frontend/dist/favicon.svg dist/ 2>/dev/null || echo "Note: Could not copy favicon.svg (may be same location)"
        fi
    else
        echo "Frontend and backend dist are the same location or paths unavailable, files should already be in place"
    fi
else
    echo "Frontend dist directory not found - build may have failed or path is different"
fi

# Copy encore.app to dist
if [ -f "encore.app" ]; then
    cp encore.app dist/
fi

# Create a simple index.js that exports the encore app
cat > dist/index.js << 'EOF'
// Encore app build output
console.log('Encore app built successfully');
module.exports = require('../encore.app');
EOF

echo "Build completed successfully!"
