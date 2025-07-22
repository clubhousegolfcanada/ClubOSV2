#!/bin/bash

# ClubOSV1 Setup Script

echo "🚀 Setting up ClubOSV1..."

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install Node.js first."
    exit 1
fi

echo "📦 Installing frontend dependencies..."
cd ClubOSV1-frontend
npm install

echo "📦 Installing backend dependencies..."
cd ../ClubOSV1-backend
npm install

echo "✅ Dependencies installed!"
echo ""
echo "⚠️  Important: Before running the application:"
echo "1. Edit ClubOSV1-backend/.env and add your OpenAI API key"
echo "2. Edit ClubOSV1-backend/.env and add your Slack webhook URL (optional)"
echo ""
echo "To start the application:"
echo "1. Backend: cd ClubOSV1-backend && npm run dev"
echo "2. Frontend: cd ClubOSV1-frontend && npm run dev"
echo ""
echo "The application will be available at http://localhost:3000"
