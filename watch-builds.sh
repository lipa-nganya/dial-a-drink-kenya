#!/bin/bash
# Watch Cloud Build logs in real-time

PROJECT_ID="dialadrink-production"

echo "🔍 Watching Cloud Build Logs"
echo "============================="
echo ""

# Get the latest build ID
LATEST_BUILD_ID=$(gcloud builds list --project "$PROJECT_ID" --limit 1 --format="value(id)" 2>/dev/null)

if [ -z "$LATEST_BUILD_ID" ]; then
    echo "❌ No builds found"
    exit 1
fi

echo "Latest Build ID: $LATEST_BUILD_ID"
echo "Streaming logs... (Press Ctrl+C to stop)"
echo ""

# Stream the logs
gcloud builds log "$LATEST_BUILD_ID" --project "$PROJECT_ID" --stream
