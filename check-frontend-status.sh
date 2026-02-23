#!/bin/bash
# Check Frontend Deployment Status

PROJECT_ID="dialadrink-production"
REGION="us-central1"

echo "🔍 Frontend Deployment Status"
echo "============================="
echo ""

echo "📦 Ongoing Builds:"
ONGOING=$(gcloud builds list --project "$PROJECT_ID" --ongoing --format="value(id)" 2>/dev/null | wc -l | tr -d ' ')
if [ "$ONGOING" -gt 0 ]; then
    gcloud builds list --project "$PROJECT_ID" --ongoing --format="table(id,status,createTime,source.repoSource.branchName)" 2>&1
else
    echo "✅ No ongoing builds"
fi
echo ""

echo "📋 Recent Builds (last 5):"
gcloud builds list --project "$PROJECT_ID" --limit 5 --format="table(id,status,createTime,finishTime)" 2>&1
echo ""

echo "☁️  Service Status:"
echo "-------------------"
for service in deliveryos-admin-frontend deliveryos-customer-frontend; do
    echo ""
    echo "--- $service ---"
    URL=$(gcloud run services describe "$service" \
        --region "$REGION" \
        --project "$PROJECT_ID" \
        --format="value(status.url)" 2>/dev/null || echo "Not found")
    REVISION=$(gcloud run services describe "$service" \
        --region "$REGION" \
        --project "$PROJECT_ID" \
        --format="value(status.latestReadyRevisionName)" 2>/dev/null || echo "Not found")
    CREATED=$(gcloud run services describe "$service" \
        --region "$REGION" \
        --project "$PROJECT_ID" \
        --format="value(metadata.creationTimestamp)" 2>/dev/null || echo "Not found")
    
    echo "  URL: $URL"
    echo "  Latest Revision: $REVISION"
    echo "  Created: $CREATED"
done
echo ""

echo "💡 To watch build logs:"
echo "  BUILD_ID=\$(gcloud builds list --project $PROJECT_ID --limit 1 --format='value(id)')"
echo "  gcloud builds log \$BUILD_ID --project $PROJECT_ID --stream"
echo ""
