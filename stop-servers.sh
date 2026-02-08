#!/bin/bash

# Script to stop backend, customer, admin, and ngrok servers

set -e

echo "🛑 Stopping all Dial a Drink servers..."
echo ""

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Function to kill processes by pattern
kill_processes() {
    local pattern=$1
    local name=$2
    
    echo -e "${YELLOW}Stopping ${name}...${NC}"
    pkill -f "$pattern" 2>/dev/null && echo -e "${GREEN}✅ ${name} stopped${NC}" || echo -e "${RED}⚠️  ${name} not running${NC}"
}

# Kill backend (port 5001)
kill_processes "node.*backend|PORT=5001.*npm start|node.*server.js" "Backend"

# Kill customer frontend (port 3000)
kill_processes "react-scripts.*3000|PORT=3000.*npm start" "Customer Frontend"

# Kill admin frontend (port 3001)
kill_processes "react-scripts.*3001|PORT=3001.*npm start" "Admin Frontend"

# Kill ngrok
kill_processes "ngrok" "ngrok"

# Also kill by port if processes are still running
echo ""
echo -e "${YELLOW}Cleaning up processes on ports...${NC}"

# Kill processes on port 5001 (backend)
lsof -ti:5001 2>/dev/null | xargs kill -9 2>/dev/null && echo -e "${GREEN}✅ Port 5001 cleared${NC}" || echo -e "${YELLOW}⚠️  Port 5001 already free${NC}"

# Kill processes on port 3000 (customer)
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null && echo -e "${GREEN}✅ Port 3000 cleared${NC}" || echo -e "${YELLOW}⚠️  Port 3000 already free${NC}"

# Kill processes on port 3001 (admin)
lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null && echo -e "${GREEN}✅ Port 3001 cleared${NC}" || echo -e "${YELLOW}⚠️  Port 3001 already free${NC}"

# Kill processes on port 4040 (ngrok web interface)
lsof -ti:4040 2>/dev/null | xargs kill -9 2>/dev/null && echo -e "${GREEN}✅ Port 4040 cleared${NC}" || echo -e "${YELLOW}⚠️  Port 4040 already free${NC}"

sleep 1

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ All servers stopped!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
