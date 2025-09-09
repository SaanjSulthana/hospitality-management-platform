#!/bin/bash
set -e

# Install dependencies
bun install

# Build frontend first
cd ../frontend && bun install && bun run build && cd ../backend

# Try to run encore build
if [ -f "./node_modules/.bin/encore" ]; then
    ./node_modules/.bin/encore build
else
    # Try with npx
    npx encore build
fi
