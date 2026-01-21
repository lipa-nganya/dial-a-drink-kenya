#!/bin/bash

# Script to ensure ngrok is running and PesaPal IPN URL is configured

echo "🔗 Ensuring ngrok is running for PesaPal IPN callbacks..."
echo ""

# Check if backend is running
if ! lsof -ti:5001 &> /dev/null; then
    echo "❌ Backend server is not running on port 5001"
    echo "   Please start it first: cd backend && npm run dev"
    exit 1
fi

echo "✅ Backend server is running on port 5001"
echo ""

# Check if ngrok is already running
NGROK_PID=$(pgrep -f "ngrok http 5001" || pgrep -f "ngrok http")
if [ ! -z "$NGROK_PID" ]; then
    echo "✅ ngrok is already running (PID: $NGROK_PID)"
    echo "   Getting current ngrok URL..."
    
    # Wait a moment for ngrok API to be ready
    sleep 2
    
    # Try to get current ngrok URL from local API
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    tunnels = data.get('tunnels', [])
    for tunnel in tunnels:
        if tunnel.get('proto') == 'https':
            print(tunnel.get('public_url', ''))
            break
except:
    pass
" 2>/dev/null)
    
    if [ -z "$NGROK_URL" ]; then
        # Try alternative method
        NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
    fi
    
    if [ ! -z "$NGROK_URL" ]; then
        echo "✅ Current ngrok URL: $NGROK_URL"
    else
        echo "⚠️  Could not get ngrok URL from API. Checking logs..."
        NGROK_URL=""
    fi
else
    echo "⚠️  ngrok is not running"
    echo "   Starting ngrok in background..."
    
    # Start ngrok in background
    ngrok http 5001 > ngrok.log 2>&1 &
    NGROK_PID=$!
    echo "   ngrok started (PID: $NGROK_PID)"
    
    # Wait for ngrok to start
    echo "   Waiting for ngrok to initialize..."
    sleep 5
    
    # Get ngrok URL
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    tunnels = data.get('tunnels', [])
    for tunnel in tunnels:
        if tunnel.get('proto') == 'https':
            print(tunnel.get('public_url', ''))
            break
except:
    pass
" 2>/dev/null)
    
    if [ -z "$NGROK_URL" ]; then
        # Try alternative method
        NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
    fi
    
    if [ ! -z "$NGROK_URL" ]; then
        echo "✅ ngrok URL obtained: $NGROK_URL"
    else
        echo "❌ Could not get ngrok URL. Check ngrok.log for errors"
        echo "   You may need to start ngrok manually: ngrok http 5001"
        exit 1
    fi
fi

if [ -z "$NGROK_URL" ]; then
    echo "❌ Could not determine ngrok URL"
    exit 1
fi

# Construct IPN URL
IPN_URL="${NGROK_URL}/api/pesapal/ipn"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "📋 PesaPal IPN Configuration"
echo "═══════════════════════════════════════════════════════"
echo "✅ ngrok URL: $NGROK_URL"
echo "✅ IPN Callback URL: $IPN_URL"
echo ""

# Update backend .env.local file
ENV_FILE="backend/.env.local"
if [ ! -f "$ENV_FILE" ]; then
    ENV_FILE="backend/.env"
fi

echo "📝 Updating $ENV_FILE..."

# Check if NGROK_URL is already set
if grep -q "^NGROK_URL=" "$ENV_FILE" 2>/dev/null; then
    # Update existing NGROK_URL
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|^NGROK_URL=.*|NGROK_URL=$NGROK_URL|" "$ENV_FILE"
    else
        # Linux
        sed -i "s|^NGROK_URL=.*|NGROK_URL=$NGROK_URL|" "$ENV_FILE"
    fi
    echo "   ✅ Updated NGROK_URL"
else
    # Add NGROK_URL
    echo "" >> "$ENV_FILE"
    echo "# ngrok URL for local development (auto-updated by ensure-ngrok-pesapal.sh)" >> "$ENV_FILE"
    echo "NGROK_URL=$NGROK_URL" >> "$ENV_FILE"
    echo "   ✅ Added NGROK_URL"
fi

# Check if PESAPAL_IPN_CALLBACK_URL is set
if grep -q "^PESAPAL_IPN_CALLBACK_URL=" "$ENV_FILE" 2>/dev/null; then
    # Update existing PESAPAL_IPN_CALLBACK_URL
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|^PESAPAL_IPN_CALLBACK_URL=.*|PESAPAL_IPN_CALLBACK_URL=$IPN_URL|" "$ENV_FILE"
    else
        # Linux
        sed -i "s|^PESAPAL_IPN_CALLBACK_URL=.*|PESAPAL_IPN_CALLBACK_URL=$IPN_URL|" "$ENV_FILE"
    fi
    echo "   ✅ Updated PESAPAL_IPN_CALLBACK_URL"
else
    # Add PESAPAL_IPN_CALLBACK_URL
    echo "" >> "$ENV_FILE"
    echo "# PesaPal IPN callback URL (auto-updated by ensure-ngrok-pesapal.sh)" >> "$ENV_FILE"
    echo "PESAPAL_IPN_CALLBACK_URL=$IPN_URL" >> "$ENV_FILE"
    echo "   ✅ Added PESAPAL_IPN_CALLBACK_URL"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ Configuration Complete!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Restart the backend server to load the new environment variables:"
echo "   cd backend && npm run dev"
echo ""
echo "2. Configure PesaPal Dashboard:"
echo "   - Go to: https://developer.pesapal.com/"
echo "   - Navigate to: Settings > IPN Settings"
echo "   - Add/Update IPN URL:"
echo "     $IPN_URL"
echo "   - IPN Notification Type: GET"
echo ""
echo "3. Verify the configuration:"
echo "   - Check backend logs for: '✅ Using IPN callback URL from environment'"
echo "   - The URL should match: $IPN_URL"
echo ""
echo "═══════════════════════════════════════════════════════"
