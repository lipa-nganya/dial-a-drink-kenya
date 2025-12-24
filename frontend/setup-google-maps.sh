#!/bin/bash

# Google Maps API Setup Script
# This script helps you set up Google Maps API key for address autocomplete

set -e

echo "🗺️  Google Maps API Setup Script"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if .env file exists
ENV_FILE=".env"
ENV_EXAMPLE=".env.example"

if [ -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠️  .env file already exists${NC}"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Keeping existing .env file. You can manually edit it to add the API key."
        exit 0
    fi
fi

echo ""
echo "Step 1: Google Cloud Console Setup"
echo "-----------------------------------"
echo ""
echo -e "${BLUE}Please follow these steps in Google Cloud Console:${NC}"
echo "1. Visit: https://console.cloud.google.com/"
echo "2. Create or select a project"
echo "3. Enable 'Places API' and 'Maps JavaScript API'"
echo "4. Go to APIs & Services > Credentials"
echo "5. Create an API Key"
echo ""
echo -e "${YELLOW}Need help? See GOOGLE_MAPS_SETUP.md for detailed instructions${NC}"
echo ""

# Prompt for API key
read -p "Enter your Google Maps API Key (or press Enter to skip): " API_KEY

if [ -z "$API_KEY" ]; then
    echo ""
    echo -e "${YELLOW}⚠️  No API key provided. Creating .env file with placeholder.${NC}"
    echo ""
    
    # Create .env file from .env.example if it exists
    if [ -f "$ENV_EXAMPLE" ]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        echo "Created .env file from .env.example template"
    else
        cat > "$ENV_FILE" << EOF
# API Configuration
REACT_APP_API_URL=http://localhost:5001/api

# Google Maps API Key (for address autocomplete)
# Get your API key from: https://console.cloud.google.com/
# Enable "Places API" and "Maps JavaScript API" for your project
REACT_APP_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
EOF
        echo "Created .env file with template"
    fi
    
    echo ""
    echo -e "${YELLOW}Please edit .env file and add your API key manually${NC}"
    echo "Then restart your development server with: npm start"
    exit 0
fi

# Validate API key format (basic check - should start with AIza)
if [[ ! $API_KEY =~ ^AIza[0-9A-Za-z_-]{35}$ ]]; then
    echo -e "${YELLOW}⚠️  Warning: API key format looks unusual${NC}"
    echo "Google Maps API keys typically start with 'AIza' and are 39 characters long"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled"
        exit 1
    fi
fi

# Create .env file
echo ""
echo "Creating .env file..."

# Check if .env.example exists and use it as base
if [ -f "$ENV_EXAMPLE" ]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    # Replace the placeholder with actual API key
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/your_google_maps_api_key_here/$API_KEY/g" "$ENV_FILE"
    else
        # Linux
        sed -i "s/your_google_maps_api_key_here/$API_KEY/g" "$ENV_FILE"
    fi
else
    # Create new .env file
    cat > "$ENV_FILE" << EOF
# API Configuration
REACT_APP_API_URL=http://localhost:5001/api

# Google Maps API Key (for address autocomplete)
REACT_APP_GOOGLE_MAPS_API_KEY=$API_KEY
EOF
fi

echo -e "${GREEN}✅ .env file created successfully!${NC}"
echo ""

# Verify the file was created correctly
if grep -q "REACT_APP_GOOGLE_MAPS_API_KEY=$API_KEY" "$ENV_FILE"; then
    echo -e "${GREEN}✅ API key verified in .env file${NC}"
else
    echo -e "${RED}❌ Error: API key not found in .env file${NC}"
    exit 1
fi

echo ""
echo "Step 2: Next Steps"
echo "------------------"
echo ""
echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "1. Restart your development server:"
echo "   ${BLUE}npm start${NC}"
echo ""
echo "2. Test the autocomplete:"
echo "   - Go to the Cart page"
echo "   - Start typing an address in 'Street Address' field"
echo "   - You should see Google Maps suggestions"
echo ""
echo "3. If deploying to production:"
echo "   - Add REACT_APP_GOOGLE_MAPS_API_KEY to your deployment platform"
echo "   - Update API key restrictions in Google Cloud Console"
echo ""
echo -e "${YELLOW}Note: Make sure billing is enabled in Google Cloud Console${NC}"
echo "Google Maps API offers $200 free credit per month"
echo ""
echo -e "${GREEN}🎉 You're all set!${NC}"


























