#!/bin/bash
# Script to sync environment variables from .env file to Cloud Run
# This preserves existing variables and only updates/adds new ones

set -e

PROJECT_ID="drink-suite"
REGION="us-central1"
SERVICE_NAME="dialadrink-backend"
ENV_FILE="backend/.env"

echo "🔄 Syncing environment variables from .env to Cloud Run..."
echo ""

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: $ENV_FILE not found!"
    echo ""
    echo "Please create $ENV_FILE with your environment variables."
    echo "You can copy from backend/.env.example as a template:"
    echo "  cp backend/.env.example backend/.env"
    echo "  # Then edit backend/.env with your actual values"
    exit 1
fi

echo "📋 Reading environment variables from $ENV_FILE..."
echo ""

# Get current environment variables from Cloud Run
echo "📥 Fetching current Cloud Run environment variables..."
CURRENT_ENV=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="get(spec.template.spec.containers[0].env)" 2>&1)

if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to fetch current environment variables"
    echo "   Make sure the service exists and you have permissions"
    exit 1
fi

# Parse .env file and build env vars string
# Skip comments and empty lines, handle quoted values
# Note: This will update variables, but critical production vars like DATABASE_URL
# should be set correctly in .env for production use

ENV_VARS=""
while IFS= read -r line || [ -n "$line" ]; do
    # Skip comments and empty lines
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// }" ]] && continue
    
    # Remove leading/trailing whitespace
    line=$(echo "$line" | xargs)
    
    # Skip if line doesn't contain =
    [[ ! "$line" =~ = ]] && continue
    
    # Extract key and value
    key=$(echo "$line" | cut -d'=' -f1 | xargs)
    value=$(echo "$line" | cut -d'=' -f2- | xargs)
    
    # Remove quotes if present
    value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
    
    # Skip if key or value is empty
    [[ -z "$key" ]] && continue
    [[ -z "$value" ]] && continue
    
    # Add to ENV_VARS string
    if [ -z "$ENV_VARS" ]; then
        ENV_VARS="${key}=${value}"
    else
        ENV_VARS="${ENV_VARS},${key}=${value}"
    fi
done < "$ENV_FILE"

if [ -z "$ENV_VARS" ]; then
    echo "⚠️  Warning: No valid environment variables found in $ENV_FILE"
    echo "   Make sure your .env file has KEY=VALUE pairs"
    exit 1
fi

echo "✅ Found environment variables to sync"
echo ""

# Count variables
VAR_COUNT=$(echo "$ENV_VARS" | tr ',' '\n' | wc -l | xargs)
echo "📊 Total variables to sync: $VAR_COUNT"
echo ""

# Show what will be updated (without sensitive values)
echo "🔍 Variables to sync (values hidden for security):"
echo "$ENV_VARS" | tr ',' '\n' | sed 's/=.*/=***/' | head -10
if [ "$VAR_COUNT" -gt 10 ]; then
    echo "... and $((VAR_COUNT - 10)) more"
fi
echo ""

# Auto-confirm if running non-interactively, otherwise ask
if [ -t 0 ]; then
    # Running interactively - ask for confirmation
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Cancelled"
        exit 1
    fi
else
    # Running non-interactively - auto-confirm
    echo "🤖 Non-interactive mode - proceeding automatically..."
fi

# Update Cloud Run service with environment variables
# Using --update-env-vars to merge with existing vars (preserves existing ones)
echo "🚀 Updating Cloud Run service with environment variables..."
echo ""

gcloud run services update $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --update-env-vars "$ENV_VARS" \
  --quiet

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Environment variables synced successfully!"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Wait for the new revision to deploy (~1-2 minutes)"
    echo "   2. Check logs: gcloud run services logs read $SERVICE_NAME --region=$REGION --project=$PROJECT_ID --limit=20"
    echo "   3. Test your application"
    echo ""
    echo "💡 Tip: These variables will persist across deployments unless explicitly changed"
else
    echo ""
    echo "❌ Error: Failed to update environment variables"
    exit 1
fi

