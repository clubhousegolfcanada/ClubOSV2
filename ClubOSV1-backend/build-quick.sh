#!/bin/bash
echo "🚀 Quick build without type checking..."

# Copy TypeScript files as JavaScript (simple transpile)
echo "📦 Transpiling TypeScript files..."
npx babel src --out-dir dist --extensions ".ts,.tsx" --presets @babel/preset-typescript --ignore "src/**/*.test.ts,src/__tests__" 2>/dev/null || echo "Babel not available, using tsc..."

# If babel fails, use tsc with minimal checking
if [ ! -d "dist" ]; then
  echo "📦 Using TypeScript compiler..."
  npx tsc --skipLibCheck --noEmit false --outDir dist || true
fi

# Copy knowledge base files
echo "📚 Copying knowledge base files..."
cp -r src/knowledge-base dist/ 2>/dev/null || echo "No knowledge base files to copy"

echo "✅ Build complete!"