#!/bin/bash

# Script to update Google Maps API key in Cloud Run and Netlify
# Usage: ./update-api-key-env-vars.sh

set -e

NEW_KEY="AIzaSyAM8GoxzNvr0LN2mgVp-mzHzQ_hFIa6AhE"

echo "🔑 Updating Google Maps API Key in Cloud Run and Netlify"
echo "=========================================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if gcloud is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n1 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Not authenticated with gcloud${NC}"
    echo "Please run: gcloud auth login"
    echo ""
fi

# Try to detect project
PROJECT_DEV="drink-suite"
PROJECT_PROD="dialadrink-production"
REGION="us-central1"

# Development service names (try both)
DEV_SERVICE_1="deliveryos-development-backend"
DEV_SERVICE_2="deliveryos-backend"

# Production service names (try both)
PROD_SERVICE_1="deliveryos-production-backend"
PROD_SERVICE_2="deliveryos-backend-prod"

echo -e "${BLUE}📋 Updating Cloud Run Services...${NC}"
echo ""

# Function to update a Cloud Run service
update_cloud_run_service() {
    local project=$1
    local service=$2
    local env_name=$3
    
    echo -e "${BLUE}Attempting to update: ${service} in project ${project}${NC}"
    
    if gcloud run services describe "$service" --region "$REGION" --project "$project" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Found service: ${service}"
        echo "   Updating ${env_name}..."
        
        # Update the environment variable
        if gcloud run services update "$service" \
            --region "$REGION" \
            --project "$project" \
            --update-env-vars "${env_name}=${NEW_KEY}" \
            --quiet; then
            echo -e "${GREEN}✓${NC} Successfully updated ${service}"
            return 0
        else
            echo -e "${YELLOW}⚠${NC}  Failed to update ${service}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠${NC}  Service ${service} not found in project ${project}"
        return 1
    fi
}

# Update Development Backend
echo "🔧 Development Backend:"
DEV_UPDATED=false
if update_cloud_run_service "$PROJECT_DEV" "$DEV_SERVICE_1" "GOOGLE_MAPS_API_KEY"; then
    DEV_UPDATED=true
elif update_cloud_run_service "$PROJECT_DEV" "$DEV_SERVICE_2" "GOOGLE_MAPS_API_KEY"; then
    DEV_UPDATED=true
elif update_cloud_run_service "$PROJECT_PROD" "$DEV_SERVICE_1" "GOOGLE_MAPS_API_KEY"; then
    DEV_UPDATED=true
elif update_cloud_run_service "$PROJECT_PROD" "$DEV_SERVICE_2" "GOOGLE_MAPS_API_KEY"; then
    DEV_UPDATED=true
fi

if [ "$DEV_UPDATED" = false ]; then
    echo -e "${YELLOW}⚠${NC}  Could not find development service. Please update manually:"
    echo "   gcloud run services update <service-name> \\"
    echo "     --region us-central1 \\"
    echo "     --project <project-id> \\"
    echo "     --update-env-vars GOOGLE_MAPS_API_KEY=${NEW_KEY}"
    echo ""
fi

echo ""

# Update Production Backend
echo "🔧 Production Backend:"
PROD_UPDATED=false
if update_cloud_run_service "$PROJECT_PROD" "$PROD_SERVICE_1" "GOOGLE_MAPS_API_KEY"; then
    PROD_UPDATED=true
elif update_cloud_run_service "$PROJECT_PROD" "$PROD_SERVICE_2" "GOOGLE_MAPS_API_KEY"; then
    PROD_UPDATED=true
elif update_cloud_run_service "$PROJECT_DEV" "$PROD_SERVICE_1" "GOOGLE_MAPS_API_KEY"; then
    PROD_UPDATED=true
elif update_cloud_run_service "$PROJECT_DEV" "$PROD_SERVICE_2" "GOOGLE_MAPS_API_KEY"; then
    PROD_UPDATED=true
fi

if [ "$PROD_UPDATED" = false ]; then
    echo -e "${YELLOW}⚠${NC}  Could not find production service. Please update manually:"
    echo "   gcloud run services update <service-name> \\"
    echo "     --region us-central1 \\"
    echo "     --project <project-id> \\"
    echo "     --update-env-vars GOOGLE_MAPS_API_KEY=${NEW_KEY}"
    echo ""
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo -e "${BLUE}📋 Netlify Environment Variables${NC}"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Netlify environment variables must be updated manually via the web interface:"
echo ""
echo -e "${GREEN}Customer Site:${NC}"
echo "   1. Go to: https://app.netlify.com/sites/dialadrink-customer/configuration/env"
echo "   2. Add/Update environment variable:"
echo "      Key: REACT_APP_GOOGLE_MAPS_API_KEY"
echo "      Value: ${NEW_KEY}"
echo "   3. Click 'Save'"
echo "   4. Go to: https://app.netlify.com/sites/dialadrink-customer/deploys"
echo "   5. Click 'Trigger deploy' → 'Deploy site'"
echo ""
echo -e "${GREEN}Admin Site:${NC}"
echo "   1. Go to: https://app.netlify.com/sites/dialadrink-admin/configuration/env"
echo "   2. Add/Update environment variable:"
echo "      Key: REACT_APP_GOOGLE_MAPS_API_KEY"
echo "      Value: ${NEW_KEY}"
echo "   3. Click 'Save'"
echo "   4. Go to: https://app.netlify.com/sites/dialadrink-admin/deploys"
echo "   5. Click 'Trigger deploy' → 'Deploy site'"
echo ""
echo "═══════════════════════════════════════════════════════"
echo ""
