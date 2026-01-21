#!/bin/bash

# Script to restart customer, admin, backend and ngrok servers

set -e

echo "🔄 Restarting servers..."

# Stop existing processes
echo "🛑 Stopping existing servers..."
pkill -f "react-scripts.*3000" || true
pkill -f "react-scripts.*3001" || true
pkill -f "node.*backend" || true
pkill -f "ngrok" || true
sleep 2

echo "✅ Stopped existing processes"
echo ""

# Start backend on port 5001
echo "📦 Starting Backend Server (port 5001)..."
cd backend
PORT=5001 npm start > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"
cd - > /dev/null
sleep 3

# Start ngrok for backend
echo "🌐 Starting ngrok (port 5001)..."
ngrok http 5001 --log=stdout > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!
echo "✅ ngrok started (PID: $NGROK_PID)"
sleep 3

# Start customer frontend on port 3000
echo "🎨 Starting Customer Frontend (port 3000)..."
cd frontend
npm start > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ Customer Frontend started (PID: $FRONTEND_PID)"
cd - > /dev/null
sleep 3

# Start admin frontend on port 3001
echo "👨‍💼 Starting Admin Frontend (port 3001)..."
cd admin-frontend
PORT=3001 npm start > /tmp/admin-frontend.log 2>&1 &
ADMIN_PID=$!
echo "✅ Admin Frontend started (PID: $ADMIN_PID)"
cd - > /dev/null
sleep 3

# Get ngrok URL
echo "📋 Fetching ngrok URL..."
sleep 2
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o 'https://[^"]*\.ngrok[^"]*' | head -1 || echo "")

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ All servers restarted successfully!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "📋 Server URLs:"
echo "   Backend:        http://localhost:5001"
echo "   Customer Site:  http://localhost:3000"
echo "   Admin Panel:    http://localhost:3001"
if [ -n "$NGROK_URL" ]; then
    echo "   ngrok:          $NGROK_URL"
else
    echo "   ngrok:          http://localhost:4040 (check for URL)"
fi
echo ""
echo "📊 Process IDs:"
echo "   Backend:        $BACKEND_PID"
echo "   Customer:       $FRONTEND_PID"
echo "   Admin:          $ADMIN_PID"
echo "   ngrok:          $NGROK_PID"
echo ""
echo "📊 Logs:"
echo "   Backend:        tail -f /tmp/backend.log"
echo "   Customer:       tail -f /tmp/frontend.log"
echo "   Admin:          tail -f /tmp/admin-frontend.log"
echo "   ngrok:          tail -f /tmp/ngrok.log"
echo ""
