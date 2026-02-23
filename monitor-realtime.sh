#!/bin/bash
# Real-time Deployment Monitoring

PROJECT_ID="dialadrink-production"
REGION="us-central1"
BACKEND_SERVICE="deliveryos-production-backend"
ADMIN_FRONTEND_SERVICE="deliveryos-admin-frontend"
CUSTOMER_FRONTEND_SERVICE="deliveryos-customer-frontend"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

clear
echo -e "${BLUE}🔍 Real-time Deployment Monitoring${NC}"
echo "======================================"
echo -e "Project: ${CYAN}$PROJECT_ID${NC}"
echo -e "Region: ${CYAN}$REGION${NC}"
echo ""
echo "Press Ctrl+C to stop monitoring"
echo ""

# Function to get build status
get_build_status() {
    gcloud builds list --project "$PROJECT_ID" --limit 1 --format="value(status)" 2>/dev/null || echo "UNKNOWN"
}

# Function to get latest build info
get_latest_build() {
    gcloud builds list --project "$PROJECT_ID" --limit 1 --format="table(id,status,createTime,logUrl)" 2>/dev/null
}

# Function to check service status
check_service() {
    local service=$1
    local status=$(gcloud run services describe "$service" \
        --region "$REGION" \
        --project "$PROJECT_ID" \
        --format="value(status.conditions[0].status)" 2>/dev/null || echo "NOT_FOUND")
    local url=$(gcloud run services describe "$service" \
        --region "$REGION" \
        --project "$PROJECT_ID" \
        --format="value(status.url)" 2>/dev/null || echo "")
    
    if [ "$status" = "True" ]; then
        echo -e "${GREEN}✓${NC} $service: ${GREEN}READY${NC}"
        if [ -n "$url" ]; then
            echo -e "  URL: ${CYAN}$url${NC}"
        fi
    elif [ "$status" = "False" ]; then
        echo -e "${RED}✗${NC} $service: ${RED}NOT READY${NC}"
    elif [ "$status" = "NOT_FOUND" ]; then
        echo -e "${YELLOW}⚠${NC} $service: ${YELLOW}NOT FOUND${NC}"
    else
        echo -e "${YELLOW}?${NC} $service: ${YELLOW}$status${NC}"
    fi
}

# Function to get ongoing builds count
get_ongoing_builds() {
    gcloud builds list --project "$PROJECT_ID" --ongoing --format="value(id)" 2>/dev/null | wc -l | tr -d ' '
}

# Main monitoring loop
while true; do
    # Clear screen and show header
    clear
    echo -e "${BLUE}🔍 Real-time Deployment Monitoring${NC}"
    echo "======================================"
    echo -e "Project: ${CYAN}$PROJECT_ID${NC} | Region: ${CYAN}$REGION${NC}"
    echo -e "Time: ${CYAN}$(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo ""
    
    # Check ongoing builds
    ONGOING=$(get_ongoing_builds)
    if [ "$ONGOING" -gt 0 ]; then
        echo -e "${YELLOW}📦 Ongoing Builds: ${ONGOING}${NC}"
        echo "-------------------"
        get_latest_build
        echo ""
        
        # Get latest build ID and show streaming logs link
        LATEST_BUILD_ID=$(gcloud builds list --project "$PROJECT_ID" --limit 1 --format="value(id)" 2>/dev/null)
        if [ -n "$LATEST_BUILD_ID" ]; then
            LATEST_BUILD_STATUS=$(gcloud builds list --project "$PROJECT_ID" --limit 1 --format="value(status)" 2>/dev/null)
            echo -e "Latest Build: ${CYAN}$LATEST_BUILD_ID${NC} - ${LATEST_BUILD_STATUS}"
            echo ""
        fi
    else
        echo -e "${GREEN}✓ No ongoing builds${NC}"
        echo ""
    fi
    
    # Service Status
    echo -e "${BLUE}☁️  Cloud Run Services Status:${NC}"
    echo "-------------------------------"
    check_service "$BACKEND_SERVICE"
    check_service "$ADMIN_FRONTEND_SERVICE"
    check_service "$CUSTOMER_FRONTEND_SERVICE"
    echo ""
    
    # Recent build history
    echo -e "${BLUE}📋 Recent Build History (last 3):${NC}"
    echo "-------------------------------"
    gcloud builds list --project "$PROJECT_ID" --limit 3 --format="table(id,status,createTime,duration)" 2>/dev/null || echo "No builds found"
    echo ""
    
    # Instructions
    echo -e "${CYAN}💡 Tips:${NC}"
    echo "  - View build logs: gcloud builds log [BUILD_ID] --project $PROJECT_ID"
    echo "  - View service logs: gcloud run services logs tail [SERVICE] --region $REGION --project $PROJECT_ID"
    echo "  - Press Ctrl+C to stop monitoring"
    echo ""
    
    # Wait before next update
    sleep 5
done
