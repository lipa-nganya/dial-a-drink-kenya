#!/bin/bash

# Script to start ngrok and check/update the API URL

echo "🔗 Starting ngrok for Dial A Drink backend..."
echo ""

# Check if backend is running
if ! lsof -ti:5001 &> /dev/null; then
    echo "❌ Backend server is not running on port 5001"
    echo "   Please start it first: cd backend && npm start"
    exit 1
fi

echo "✅ Backend server is running on port 5001"
echo ""

# Check if ngrok is already running
if pgrep -f "ngrok http" > /dev/null; then
    echo "⚠️  ngrok appears to be already running"
    echo "   Checking ngrok API for current URL..."
    
    # Try to get current ngrok URL from local API
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ ! -z "$NGROK_URL" ]; then
        echo "✅ Current ngrok URL: $NGROK_URL"
        echo ""
        echo "📱 Update your Android app's API URL to: $NGROK_URL"
        echo "   Or rebuild with: ./gradlew assembleDebug -PAPI_BASE_URL=$NGROK_URL"
    else
        echo "   Could not get ngrok URL. Starting new ngrok session..."
        echo ""
    fi
else
    echo "🚀 Starting ngrok..."
    echo ""
    echo "📋 Instructions:"
    echo "   1. After ngrok starts, copy the HTTPS URL (e.g., https://abc123.ngrok-free.app)"
    echo "   2. Update driver-app-native/app/build.gradle line 52 with the new URL"
    echo "   3. Or rebuild with: ./gradlew assembleDebug -PAPI_BASE_URL=<your-ngrok-url>"
    echo ""
    echo "   Press Ctrl+C to stop ngrok"
    echo ""
    
    # Start ngrok
    ngrok http 5001
fi
