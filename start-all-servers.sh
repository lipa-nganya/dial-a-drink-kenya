#!/bin/bash

# Script to start all local servers including ngrok

set -e

echo "🚀 Starting all LiquorOS local servers..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to start a server in background
start_server() {
    local name=$1
    local dir=$2
    local cmd=$3
    local port=$4
    
    echo -e "${BLUE}Starting ${name}...${NC}"
    cd "$dir"
    if [ -n "$port" ]; then
        PORT=$port $cmd > "/tmp/${name}.log" 2>&1 &
    else
        $cmd > "/tmp/${name}.log" 2>&1 &
    fi
    echo -e "${GREEN}✅ ${name} started (PID: $!)${NC}"
    sleep 2
    cd - > /dev/null
}

# Start backend on port 5001
echo -e "${YELLOW}📦 Starting Backend Server (port 5001)...${NC}"
cd backend
PORT=5001 npm start > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✅ Backend started (PID: $BACKEND_PID)${NC}"
cd - > /dev/null
sleep 3

# Start ngrok for backend
echo -e "${YELLOW}🌐 Starting ngrok (port 5001)...${NC}"
ngrok http 5001 --log=stdout > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!
echo -e "${GREEN}✅ ngrok started (PID: $NGROK_PID)${NC}"
sleep 3

# Get ngrok URL
echo -e "${BLUE}📋 Fetching ngrok URL...${NC}"
sleep 2
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*\.ngrok[^"]*' | head -1)
if [ -n "$NGROK_URL" ]; then
    echo -e "${GREEN}✅ ngrok URL: ${NGROK_URL}${NC}"
else
    echo -e "${YELLOW}⚠️  Could not fetch ngrok URL. Check http://localhost:4040${NC}"
fi

# Start frontend on port 3000
echo -e "${YELLOW}🎨 Starting Customer Frontend (port 3000)...${NC}"
cd frontend
npm start > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}✅ Customer Frontend started (PID: $FRONTEND_PID)${NC}"
cd - > /dev/null
sleep 3

# Start admin frontend on port 3001
echo -e "${YELLOW}👨‍💼 Starting Admin Frontend (port 3001)...${NC}"
cd admin-frontend
PORT=3001 npm start > /tmp/admin-frontend.log 2>&1 &
ADMIN_PID=$!
echo -e "${GREEN}✅ Admin Frontend started (PID: $ADMIN_PID)${NC}"
cd - > /dev/null

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ All servers started successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}📋 Server URLs:${NC}"
echo -e "   Backend:        http://localhost:5001"
echo -e "   Customer Site:  http://localhost:3000"
echo -e "   Admin Panel:    http://localhost:3001"
if [ -n "$NGROK_URL" ]; then
    echo -e "   ngrok:          ${NGROK_URL}"
fi
echo ""
echo -e "${BLUE}📊 Process IDs:${NC}"
echo -e "   Backend:        ${BACKEND_PID}"
echo -e "   Customer:       ${FRONTEND_PID}"
echo -e "   Admin:          ${ADMIN_PID}"
echo -e "   ngrok:          ${NGROK_PID}"
echo ""
echo -e "${YELLOW}💡 Logs are available in /tmp/:${NC}"
echo -e "   Backend:        /tmp/backend.log"
echo -e "   Customer:       /tmp/frontend.log"
echo -e "   Admin:          /tmp/admin-frontend.log"
echo -e "   ngrok:          /tmp/ngrok.log"
echo ""
echo -e "${YELLOW}🛑 To stop all servers, run:${NC}"
echo -e "   pkill -f 'node.*server.js'; pkill -f 'react-scripts'; pkill -f 'ngrok'"
echo ""

