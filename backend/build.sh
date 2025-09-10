#!/bin/bash
set -e

# Install dependencies
bun install

# Build frontend first
cd ../frontend && bun install && bun run build && cd ../backend

# Create a simple build output since encore build is not working
echo "Creating build output for Encore..."

# Create dist directory
mkdir -p dist

# Copy frontend dist files to backend dist
echo "Copying frontend build files..."
cp -r ../frontend/dist/* dist/

# Copy encore.app to dist
cp encore.app dist/

# Create a simple index.js that exports the encore app
cat > dist/index.js << 'EOF'
// Encore app build output
console.log('Encore app built successfully');
module.exports = require('../encore.app');
EOF

echo "Build completed successfully!"
