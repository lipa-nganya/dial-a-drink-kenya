#!/bin/bash

echo "🛑 Stopping backend server..."
pkill -9 -f "node.*server.js" 2>/dev/null
pkill -9 -f "node.*backend" 2>/dev/null
sleep 2

echo "🚀 Starting backend server on port 5001..."
cd backend
PORT=5001 node server.js

