#!/bin/bash

echo "🧹 Cleaning Next.js cache and temporary files..."

# Remove .next directory
if [ -d ".next" ]; then
    echo "Removing .next directory..."
    rm -rf .next
fi

# Remove node_modules cache
if [ -d "node_modules/.cache" ]; then
    echo "Removing node_modules cache..."
    rm -rf node_modules/.cache
fi

# Remove any lock files that might be causing issues
if [ -f ".next/cache/webpack/client-development-fallback/0.pack.gz_" ]; then
    echo "Removing incomplete cache files..."
    find .next -name "*.pack.gz_" -delete 2>/dev/null || true
fi

# Clear npm cache (optional)
echo "Clearing npm cache..."
npm cache clean --force

echo "✅ Cleanup complete!"
echo ""
echo "You can now run 'npm run dev' to start the development server."
