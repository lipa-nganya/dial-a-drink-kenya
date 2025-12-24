#!/bin/bash

# DD Driver APK Build Script
# This script automates the process of building the APK using Expo EAS

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  DD Driver APK Build Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Check if EAS CLI is installed
echo -e "${YELLOW}[1/5] Checking EAS CLI installation...${NC}"
if ! command -v eas &> /dev/null; then
    echo -e "${RED}❌ EAS CLI not found. Installing...${NC}"
    npm install -g eas-cli
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to install EAS CLI. Please install manually:${NC}"
        echo "   npm install -g eas-cli"
        exit 1
    fi
    echo -e "${GREEN}✅ EAS CLI installed${NC}"
else
    echo -e "${GREEN}✅ EAS CLI is installed${NC}"
    eas --version
fi
echo ""

# Step 2: Check if user is logged in
echo -e "${YELLOW}[2/5] Checking Expo login status...${NC}"
if ! eas whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Expo${NC}"
    echo -e "${BLUE}Please login to Expo:${NC}"
    echo ""
    echo "If you don't have an account:"
    echo "  1. Go to https://expo.dev"
    echo "  2. Click 'Sign Up' (free account)"
    echo "  3. Create your account"
    echo ""
    read -p "Press Enter to continue with login..."
    eas login
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Login failed. Please try again: eas login${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Logged in successfully${NC}"
else
    USER=$(eas whoami 2>/dev/null | head -1)
    echo -e "${GREEN}✅ Logged in as: ${USER}${NC}"
fi
echo ""

# Step 3: Verify project configuration
echo -e "${YELLOW}[3/5] Verifying project configuration...${NC}"
if [ ! -f "eas.json" ]; then
    echo -e "${RED}❌ eas.json not found. Please ensure you're in the correct directory.${NC}"
    exit 1
fi

if [ ! -f "app.json" ]; then
    echo -e "${RED}❌ app.json not found. Please ensure you're in the correct directory.${NC}"
    exit 1
fi

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found. Please ensure you're in the correct directory.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Project configuration verified${NC}"
echo ""

# Step 4: Check if dependencies are installed
echo -e "${YELLOW}[4/5] Checking dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules not found. Installing dependencies...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${GREEN}✅ Dependencies found${NC}"
fi
echo ""

# Step 5: Build the APK
echo -e "${YELLOW}[5/5] Starting APK build...${NC}"
echo ""
echo -e "${BLUE}This will:${NC}"
echo "  • Upload your project to Expo's servers"
echo "  • Build the APK in the cloud (takes 10-20 minutes)"
echo "  • Send you an email when complete"
echo ""
read -p "Continue with build? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Build cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}Starting build...${NC}"
echo ""

eas build --platform android --profile preview

BUILD_STATUS=$?

if [ $BUILD_STATUS -eq 0 ]; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✅ Build process started successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "  1. Wait for email notification (usually 10-20 minutes)"
    echo "  2. Or check build status: ${YELLOW}eas build:list${NC}"
    echo "  3. Download APK when ready: ${YELLOW}eas build:download${NC}"
    echo ""
    echo -e "${BLUE}Useful commands:${NC}"
    echo "  • Check build status: ${YELLOW}eas build:list${NC}"
    echo "  • Download latest build: ${YELLOW}eas build:download${NC}"
    echo "  • View build details: ${YELLOW}eas build:view [BUILD_ID]${NC}"
    echo ""
else
    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}❌ Build failed${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
    echo -e "${YELLOW}Troubleshooting:${NC}"
    echo "  • Check internet connection"
    echo "  • Verify app.json is valid"
    echo "  • Check build logs: eas build:list"
    echo ""
    exit 1
fi

























