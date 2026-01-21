#!/bin/bash

# Firebase Credentials Setup Script
# This script helps configure Firebase credentials for push notifications

set -e

echo "🔥 Firebase Credentials Setup"
echo "============================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if .env file exists
ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating one...${NC}"
    touch "$ENV_FILE"
fi

echo -e "${BLUE}Step 1: Get Firebase Service Account JSON${NC}"
echo "---------------------------------------------------"
echo ""
echo "1. Go to: https://console.firebase.google.com/"
echo "2. Select your project: drink-suite"
echo "3. Go to Project Settings (⚙️) → Service accounts"
echo "4. Click 'Generate new private key'"
echo "5. Download the JSON file"
echo ""
read -p "Press Enter when you have downloaded the JSON file..."

echo ""
echo -e "${BLUE}Step 2: Configure Credentials${NC}"
echo "--------------------------------------"
echo ""
echo "Choose configuration method:"
echo "1. Use JSON file (recommended for local development)"
echo "2. Use environment variables (recommended for Cloud Run)"
read -p "Enter choice (1 or 2): " choice

if [ "$choice" == "1" ]; then
    # Option 1: Use JSON file
    echo ""
    read -p "Enter path to the downloaded JSON file: " json_path
    
    if [ ! -f "$json_path" ]; then
        echo -e "${RED}❌ File not found: $json_path${NC}"
        exit 1
    fi
    
    # Copy to backend directory
    cp "$json_path" "firebase-service-account.json"
    echo -e "${GREEN}✅ Copied JSON file to: firebase-service-account.json${NC}"
    
    # Add to .gitignore
    if ! grep -q "firebase-service-account.json" .gitignore 2>/dev/null; then
        echo "firebase-service-account.json" >> .gitignore
        echo -e "${GREEN}✅ Added to .gitignore${NC}"
    fi
    
    # Extract project ID from JSON
    PROJECT_ID=$(grep -o '"project_id": "[^"]*' firebase-service-account.json | cut -d'"' -f4)
    
    # Add to .env
    if ! grep -q "GOOGLE_APPLICATION_CREDENTIALS" "$ENV_FILE"; then
        echo "" >> "$ENV_FILE"
        echo "# Firebase Configuration" >> "$ENV_FILE"
        echo "GOOGLE_APPLICATION_CREDENTIALS=$(pwd)/firebase-service-account.json" >> "$ENV_FILE"
        echo -e "${GREEN}✅ Added GOOGLE_APPLICATION_CREDENTIALS to .env${NC}"
    else
        echo -e "${YELLOW}⚠️  GOOGLE_APPLICATION_CREDENTIALS already exists in .env${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}✅ Configuration complete!${NC}"
    echo ""
    echo "The backend will use: $(pwd)/firebase-service-account.json"
    echo "Project ID: $PROJECT_ID"
    
elif [ "$choice" == "2" ]; then
    # Option 2: Use environment variables
    echo ""
    read -p "Enter path to the downloaded JSON file: " json_path
    
    if [ ! -f "$json_path" ]; then
        echo -e "${RED}❌ File not found: $json_path${NC}"
        exit 1
    fi
    
    # Extract values from JSON
    PROJECT_ID=$(grep -o '"project_id": "[^"]*' "$json_path" | cut -d'"' -f4)
    CLIENT_EMAIL=$(grep -o '"client_email": "[^"]*' "$json_path" | cut -d'"' -f4)
    PRIVATE_KEY=$(grep -o '"private_key": "[^"]*' "$json_path" | sed 's/"private_key": "//;s/"$//' | sed 's/\\n/\n/g')
    
    # Convert private key to single line with \n
    PRIVATE_KEY_ESCAPED=$(echo "$PRIVATE_KEY" | sed ':a;N;$!ba;s/\n/\\n/g')
    
    echo ""
    echo -e "${BLUE}Extracted values:${NC}"
    echo "Project ID: $PROJECT_ID"
    echo "Client Email: $CLIENT_EMAIL"
    echo ""
    
    # Add to .env
    if ! grep -q "FIREBASE_PROJECT_ID" "$ENV_FILE"; then
        echo "" >> "$ENV_FILE"
        echo "# Firebase Configuration" >> "$ENV_FILE"
        echo "FIREBASE_PROJECT_ID=$PROJECT_ID" >> "$ENV_FILE"
        echo "FIREBASE_CLIENT_EMAIL=$CLIENT_EMAIL" >> "$ENV_FILE"
        echo "FIREBASE_PRIVATE_KEY=\"$PRIVATE_KEY_ESCAPED\"" >> "$ENV_FILE"
        echo -e "${GREEN}✅ Added Firebase credentials to .env${NC}"
    else
        echo -e "${YELLOW}⚠️  Firebase credentials already exist in .env${NC}"
        read -p "Overwrite? (y/N): " overwrite
        if [ "$overwrite" == "y" ] || [ "$overwrite" == "Y" ]; then
            # Remove old values
            sed -i.bak '/^FIREBASE_PROJECT_ID=/d' "$ENV_FILE"
            sed -i.bak '/^FIREBASE_CLIENT_EMAIL=/d' "$ENV_FILE"
            sed -i.bak '/^FIREBASE_PRIVATE_KEY=/d' "$ENV_FILE"
            # Add new values
            echo "FIREBASE_PROJECT_ID=$PROJECT_ID" >> "$ENV_FILE"
            echo "FIREBASE_CLIENT_EMAIL=$CLIENT_EMAIL" >> "$ENV_FILE"
            echo "FIREBASE_PRIVATE_KEY=\"$PRIVATE_KEY_ESCAPED\"" >> "$ENV_FILE"
            echo -e "${GREEN}✅ Updated Firebase credentials in .env${NC}"
        fi
    fi
    
    echo ""
    echo -e "${GREEN}✅ Configuration complete!${NC}"
    echo ""
    echo "For Cloud Run deployment, add these environment variables:"
    echo "  FIREBASE_PROJECT_ID=$PROJECT_ID"
    echo "  FIREBASE_CLIENT_EMAIL=$CLIENT_EMAIL"
    echo "  FIREBASE_PRIVATE_KEY=\"$PRIVATE_KEY_ESCAPED\""
    
else
    echo -e "${RED}❌ Invalid choice${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 3: Verify Configuration${NC}"
echo "-----------------------------------"
echo ""
echo "1. Restart your backend server"
echo "2. Check logs for: ${GREEN}✅ Firebase Admin SDK initialized${NC}"
echo "3. Test push notifications from admin panel"
echo ""
echo -e "${GREEN}Setup complete!${NC}"


