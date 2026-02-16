#!/bin/bash

# Script to update Google Maps API key in all .env files
# Usage: ./update-google-api-key.sh

set -e

NEW_KEY="AIzaSyAM8GoxzNvr0LN2mgVp-mzHzQ_hFIa6AhE"
OLD_KEY="AIzaSyBXZDQWV72dyfSCqm6Y8sr9Y2ze9Xm2eqc"

echo "🔑 Updating Google Maps API Key..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Update backend/.env
if [ -f "backend/.env" ]; then
    echo -e "${GREEN}✓${NC} Updating backend/.env"
    if grep -q "GOOGLE_MAPS_API_KEY" backend/.env; then
        sed -i.bak "s|GOOGLE_MAPS_API_KEY=.*|GOOGLE_MAPS_API_KEY=${NEW_KEY}|g" backend/.env
        # Also update REACT_APP_GOOGLE_MAPS_API_KEY if present
        sed -i.bak "s|REACT_APP_GOOGLE_MAPS_API_KEY=.*|REACT_APP_GOOGLE_MAPS_API_KEY=${NEW_KEY}|g" backend/.env
        rm -f backend/.env.bak
    else
        echo "GOOGLE_MAPS_API_KEY=${NEW_KEY}" >> backend/.env
    fi
else
    echo -e "${YELLOW}⚠${NC}  backend/.env not found (will be created if needed)"
fi

# Update frontend/.env
if [ -f "frontend/.env" ]; then
    echo -e "${GREEN}✓${NC} Updating frontend/.env"
    if grep -q "REACT_APP_GOOGLE_MAPS_API_KEY" frontend/.env; then
        sed -i.bak "s|REACT_APP_GOOGLE_MAPS_API_KEY=.*|REACT_APP_GOOGLE_MAPS_API_KEY=${NEW_KEY}|g" frontend/.env
        rm -f frontend/.env.bak
    else
        echo "REACT_APP_GOOGLE_MAPS_API_KEY=${NEW_KEY}" >> frontend/.env
    fi
else
    echo -e "${YELLOW}⚠${NC}  frontend/.env not found (will be created if needed)"
fi

# Update admin-frontend/.env
if [ -f "admin-frontend/.env" ]; then
    echo -e "${GREEN}✓${NC} Updating admin-frontend/.env"
    if grep -q "REACT_APP_GOOGLE_MAPS_API_KEY" admin-frontend/.env; then
        sed -i.bak "s|REACT_APP_GOOGLE_MAPS_API_KEY=.*|REACT_APP_GOOGLE_MAPS_API_KEY=${NEW_KEY}|g" admin-frontend/.env
        rm -f admin-frontend/.env.bak
    else
        echo "REACT_APP_GOOGLE_MAPS_API_KEY=${NEW_KEY}" >> admin-frontend/.env
    fi
else
    echo -e "${YELLOW}⚠${NC}  admin-frontend/.env not found (will be created if needed)"
fi

echo ""
echo -e "${GREEN}✅ Local .env files updated!${NC}"
echo ""
echo "⚠️  IMPORTANT: Next steps:"
echo ""
echo "1. Update Google Cloud Run environment variables:"
echo "   - Development: deliveryos-development-backend-805803410802.us-central1.run.app"
echo "   - Production: [your production service]"
echo "   - Set: GOOGLE_MAPS_API_KEY=${NEW_KEY}"
echo ""
echo "2. Update Netlify environment variables:"
echo "   - Customer: https://app.netlify.com/sites/dialadrink-customer/configuration/env"
echo "   - Admin: https://app.netlify.com/sites/dialadrink-admin/configuration/env"
echo "   - Set: REACT_APP_GOOGLE_MAPS_API_KEY=${NEW_KEY}"
echo ""
echo "3. Delete the old API key in Google Cloud Console:"
echo "   - Go to: https://console.cloud.google.com/apis/credentials"
echo "   - Delete: AIzaSyBXZDQWV72dyfSCqm6Y8sr9Y2ze9Xm2eqc"
echo ""
echo "4. Verify .env files are NOT committed to git:"
echo "   git status"
echo "   (You should NOT see .env files listed)"
echo ""
