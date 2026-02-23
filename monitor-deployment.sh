#!/bin/bash
# Monitor Production Deployment Progress

PROJECT_ID="dialadrink-production"
REGION="us-central1"
BACKEND_SERVICE="deliveryos-production-backend"
ADMIN_FRONTEND_SERVICE="deliveryos-admin-frontend"
CUSTOMER_FRONTEND_SERVICE="deliveryos-customer-frontend"

echo "🔍 Monitoring Production Deployment"
echo "===================================="
echo ""

# 1. Check Cloud Build status (recent builds)
echo "📦 Recent Cloud Builds:"
echo "----------------------"
gcloud builds list --project "$PROJECT_ID" --limit 5 --format="table(id,status,createTime,source.repoSource.branchName)" 2>/dev/null || echo "No recent builds found"
echo ""

# 2. Check Cloud Run service status
echo "☁️  Cloud Run Services Status:"
echo "-------------------------------"
echo ""
echo "Backend:"
gcloud run services describe "$BACKEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format="table(status.url,status.conditions[0].status,status.latestReadyRevisionName)" 2>/dev/null || echo "Service not found"
echo ""

echo "Admin Frontend:"
gcloud run services describe "$ADMIN_FRONTEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format="table(status.url,status.conditions[0].status,status.latestReadyRevisionName)" 2>/dev/null || echo "Service not found"
echo ""

echo "Customer Frontend:"
gcloud run services describe "$CUSTOMER_FRONTEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format="table(status.url,status.conditions[0].status,status.latestReadyRevisionName)" 2>/dev/null || echo "Service not found"
echo ""

# 3. Check service health
echo "🏥 Service Health Checks:"
echo "-------------------------"
BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)" 2>/dev/null)

if [ -n "$BACKEND_URL" ]; then
    echo "Backend Health:"
    curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" "$BACKEND_URL/api/health" || echo "Backend not responding"
    echo ""
fi

# 4. Recent logs
echo "📋 Recent Logs (last 5 entries):"
echo "--------------------------------"
echo ""
echo "Backend logs:"
gcloud run services logs read "$BACKEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --limit 5 \
    --format="table(timestamp,severity,textPayload)" 2>/dev/null || echo "No logs available"
echo ""

echo "Admin Frontend logs:"
gcloud run services logs read "$ADMIN_FRONTEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --limit 5 \
    --format="table(timestamp,severity,textPayload)" 2>/dev/null || echo "No logs available"
echo ""

echo "Customer Frontend logs:"
gcloud run services logs read "$CUSTOMER_FRONTEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --limit 5 \
    --format="table(timestamp,severity,textPayload)" 2>/dev/null || echo "No logs available"
echo ""

echo "✅ Monitoring complete!"
echo ""
echo "💡 Tips:"
echo "  - Run this script periodically: bash monitor-deployment.sh"
echo "  - Watch logs in real-time: gcloud run services logs tail [SERVICE_NAME] --region $REGION --project $PROJECT_ID"
echo "  - Check build progress: gcloud builds list --project $PROJECT_ID --ongoing"
echo ""
