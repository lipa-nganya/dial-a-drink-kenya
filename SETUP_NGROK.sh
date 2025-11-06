#!/bin/bash

# Quick ngrok setup script for Dial A Drink

echo "🔗 Setting up ngrok for M-Pesa callbacks..."
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed."
    echo "📥 Install it with: brew install ngrok/ngrok/ngrok"
    echo "   Or download from: https://ngrok.com/download"
    exit 1
fi

echo "✅ ngrok is installed"
echo ""

# Check if backend is running
if ! lsof -ti:5001 &> /dev/null; then
    echo "⚠️  Backend server is not running on port 5001"
    echo "   Please start it first: cd backend && npm start"
    exit 1
fi

echo "✅ Backend server is running on port 5001"
echo ""

echo "🚀 Starting ngrok..."
echo "   This will forward https://your-url.ngrok.io -> http://localhost:5001"
echo ""
echo "📋 After ngrok starts:"
echo "   1. Copy the HTTPS URL (e.g., https://abc123.ngrok-free.app)"
echo "   2. Update backend/.env: MPESA_CALLBACK_URL=https://your-url.ngrok.io/api/mpesa/callback"
echo "   3. Restart the backend server"
echo ""

# Start ngrok
ngrok http 5001






