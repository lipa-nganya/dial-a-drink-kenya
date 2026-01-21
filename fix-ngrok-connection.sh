#!/bin/bash

# Script to diagnose and fix ngrok connection issues

echo "🔍 Diagnosing ngrok connection issue..."
echo ""

# Check if backend is running
if lsof -ti:5001 &> /dev/null; then
    echo "✅ Backend server is running on port 5001"
else
    echo "❌ Backend server is NOT running on port 5001"
    echo "   Please start it first: cd backend && npm start"
    exit 1
fi

# Check if ngrok is running
if pgrep -f "ngrok http" > /dev/null; then
    echo "✅ ngrok process is running"
    
    # Try to get ngrok URL from local API
    echo "📋 Checking ngrok status..."
    NGROK_INFO=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null)
    
    if [ ! -z "$NGROK_INFO" ]; then
        NGROK_URL=$(echo "$NGROK_INFO" | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
        NGROK_TARGET=$(echo "$NGROK_INFO" | grep -o '"config":{"addr":"http://[^"]*"' | head -1 | cut -d'"' -f4)
        
        if [ ! -z "$NGROK_URL" ]; then
            echo "✅ Current ngrok URL: $NGROK_URL"
            echo "✅ Forwarding to: $NGROK_TARGET"
            
            # Check if it matches expected URL
            if [[ "$NGROK_URL" == *"homiest-psychopharmacologic-anaya.ngrok-free.dev"* ]]; then
                echo "✅ ngrok URL matches expected domain!"
                
                # Test the connection
                echo ""
                echo "🧪 Testing connection..."
                TEST_RESPONSE=$(curl -s -H "ngrok-skip-browser-warning: true" "$NGROK_URL/api/health" 2>&1)
                
                if [[ "$TEST_RESPONSE" == *"status"* ]] || [[ "$TEST_RESPONSE" == *"OK"* ]]; then
                    echo "✅ Connection test successful!"
                    echo ""
                    echo "🎉 Everything is working correctly!"
                    echo "   Your app should be able to connect to: $NGROK_URL"
                else
                    echo "⚠️  Connection test failed"
                    echo "   Response: $TEST_RESPONSE"
                    echo ""
                    echo "   This might mean:"
                    echo "   1. Backend is not responding correctly"
                    echo "   2. ngrok tunnel needs to be restarted"
                fi
            else
                echo "⚠️  ngrok URL doesn't match expected domain"
                echo "   Expected: homiest-psychopharmacologic-anaya.ngrok-free.dev"
                echo "   Current: $NGROK_URL"
                echo ""
                echo "   You may need to:"
                echo "   1. Stop ngrok: pkill -f 'ngrok http'"
                echo "   2. Start with static domain: ngrok http 5001 --domain=homiest-psychopharmacologic-anaya.ngrok-free.dev"
                echo "   OR update the app's API URL to: $NGROK_URL"
            fi
        else
            echo "⚠️  Could not determine ngrok URL"
            echo "   Check ngrok dashboard: http://localhost:4040"
        fi
    else
        echo "⚠️  Could not connect to ngrok API (port 4040)"
        echo "   ngrok might be running but not accessible"
    fi
else
    echo "❌ ngrok is NOT running"
    echo ""
    echo "🚀 To start ngrok:"
    echo ""
    echo "   Option 1: Start with static domain (if you have paid plan):"
    echo "   ngrok http 5001 --domain=homiest-psychopharmacologic-anaya.ngrok-free.dev"
    echo ""
    echo "   Option 2: Start normally (will get new URL):"
    echo "   ngrok http 5001"
    echo ""
    echo "   After starting, if URL changes, update driver-app-native/app/build.gradle"
    echo "   line 52 with the new URL, then rebuild the app."
    echo ""
    echo "   Or rebuild with: ./gradlew assembleDebug -PAPI_BASE_URL=<new-ngrok-url>"
fi

echo ""
echo "📱 Current app configuration expects:"
echo "   https://homiest-psychopharmacologic-anaya.ngrok-free.dev"
echo ""
echo "💡 Tip: View ngrok dashboard at http://localhost:4040"
