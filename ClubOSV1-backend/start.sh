#!/bin/bash
# Start script for Railway deployment
echo "🚀 Starting ClubOS Backend..."

# Set environment variables
export NODE_ENV=production
export LOG_LEVEL=debug

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm ci --only=production
fi

# Build the application
echo "🔨 Building application..."
npm run build || echo "Build failed, continuing anyway..."

# Start the application with error recovery
echo "🏃 Starting server..."
while true; do
  npm start
  echo "⚠️ Server crashed, restarting in 5 seconds..."
  sleep 5
done