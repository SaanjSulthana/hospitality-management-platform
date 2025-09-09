#!/bin/bash
# Database Access Helper Script
# This script ensures you always use the correct database connection

echo "🔍 Accessing Encore Database..."
echo "📊 This connects to the APPLICATION database with proper context"
echo "⚠️  DO NOT use Docker direct connection - it shows different data!"
echo ""

# Change to backend directory
cd backend

# Connect to Encore database
echo "🚀 Connecting to Encore database shell..."
encore db shell hospitality
