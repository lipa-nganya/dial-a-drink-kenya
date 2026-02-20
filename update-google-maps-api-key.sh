#!/bin/bash
# Script to update Google Maps API key in all local .env files
# Usage: ./update-google-maps-api-key.sh

set -e

GOOGLE_MAPS_API_KEY="AIzaSyBYs413EeQVcChjlgrOMFd7U2dy60xiirk"

echo "🔑 Updating Google Maps API Key..."
echo "   Key: $GOOGLE_MAPS_API_KEY"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Update backend/.env
if [ -f "backend/.env" ]; then
    echo -e "${GREEN}✓${NC} Updating backend/.env"
    if grep -q "GOOGLE_MAPS_API_KEY" backend/.env; then
        sed -i.bak "s|GOOGLE_MAPS_API_KEY=.*|GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}|g" backend/.env
        rm -f backend/.env.bak
    else
        echo "GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}" >> backend/.env
    fi
else
    echo -e "${YELLOW}⚠${NC}  backend/.env not found, creating it..."
    echo "GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}" > backend/.env
fi

# Update frontend/.env
if [ -f "frontend/.env" ]; then
    echo -e "${GREEN}✓${NC} Updating frontend/.env"
    if grep -q "REACT_APP_GOOGLE_MAPS_API_KEY" frontend/.env; then
        sed -i.bak "s|REACT_APP_GOOGLE_MAPS_API_KEY=.*|REACT_APP_GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}|g" frontend/.env
        rm -f frontend/.env.bak
    else
        echo "REACT_APP_GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}" >> frontend/.env
    fi
else
    echo -e "${YELLOW}⚠${NC}  frontend/.env not found, creating it..."
    echo "REACT_APP_GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}" > frontend/.env
fi

# Update admin-frontend/.env
if [ -f "admin-frontend/.env" ]; then
    echo -e "${GREEN}✓${NC} Updating admin-frontend/.env"
    if grep -q "REACT_APP_GOOGLE_MAPS_API_KEY" admin-frontend/.env; then
        sed -i.bak "s|REACT_APP_GOOGLE_MAPS_API_KEY=.*|REACT_APP_GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}|g" admin-frontend/.env
        rm -f admin-frontend/.env.bak
    else
        echo "REACT_APP_GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}" >> admin-frontend/.env
    fi
else
    echo -e "${YELLOW}⚠${NC}  admin-frontend/.env not found, creating it..."
    echo "REACT_APP_GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}" > admin-frontend/.env
fi

echo ""
echo "✅ Google Maps API Key updated in all local .env files"
echo ""
echo "📝 Next steps:"
echo "   - Restart your development servers to pick up the new API key"
echo "   - Backend: Restart Node.js server"
echo "   - Frontend: Restart React dev server (npm start)"
echo "   - Admin Frontend: Restart React dev server (npm start)"
echo ""
echo "🌐 For Cloud Run deployments:"
echo "   - Development: Run ./deploy-backend-dev.sh"
echo "   - Production: Run ./deploy-to-production-complete.sh"
echo "   - Frontends: Will use API key from cloudbuild.yaml on next deployment"
echo ""
