#!/bin/bash
# Script to set M-Pesa credentials in Cloud Run

set -e

PROJECT_ID="drink-suite"
REGION="us-central1"
SERVICE_NAME="dialadrink-backend"

echo "🔧 Setting up M-Pesa credentials for Cloud Run..."
echo ""

# Check if all required credentials are provided
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ] || [ -z "$4" ]; then
    echo "❌ Error: All M-Pesa credentials are required"
    echo ""
    echo "Usage: $0 <MPESA_CONSUMER_KEY> <MPESA_CONSUMER_SECRET> <MPESA_SHORTCODE> <MPESA_PASSKEY>"
    echo ""
    echo "Example:"
    echo "  $0 'your_consumer_key' 'your_consumer_secret' '174379' 'your_passkey'"
    echo ""
    echo "To get your M-Pesa credentials:"
    echo "  1. Go to https://developer.safaricom.co.ke/"
    echo "  2. Log in to your account"
    echo "  3. Navigate to 'My Apps'"
    echo "  4. Select your app"
    echo "  5. Copy the Consumer Key, Consumer Secret, Shortcode, and Passkey"
    echo ""
    exit 1
fi

MPESA_CONSUMER_KEY="$1"
MPESA_CONSUMER_SECRET="$2"
MPESA_SHORTCODE="$3"
MPESA_PASSKEY="$4"

echo "📋 Configuration:"
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Service: $SERVICE_NAME"
echo "   Shortcode: $MPESA_SHORTCODE"
echo ""

# Set callback URL (production URL)
MPESA_CALLBACK_URL="https://dialadrink-backend-910510650031.us-central1.run.app/api/mpesa/callback"

echo "🔗 Callback URL: $MPESA_CALLBACK_URL"
echo ""

# Update Cloud Run service with M-Pesa credentials
echo "🚀 Updating Cloud Run service with M-Pesa credentials..."
gcloud run services update $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --update-env-vars "MPESA_CONSUMER_KEY=$MPESA_CONSUMER_KEY,MPESA_CONSUMER_SECRET=$MPESA_CONSUMER_SECRET,MPESA_SHORTCODE=$MPESA_SHORTCODE,MPESA_PASSKEY=$MPESA_PASSKEY,MPESA_CALLBACK_URL=$MPESA_CALLBACK_URL" \
  --quiet

echo ""
echo "✅ M-Pesa credentials configured successfully!"
echo ""
echo "📝 Next steps:"
echo "   1. Wait for the new revision to deploy"
echo "   2. Check logs: gcloud run services logs read $SERVICE_NAME --region=$REGION --project=$PROJECT_ID"
echo "   3. Test payment initiation from admin dashboard"
echo ""
echo "⚠️  Important:"
echo "   - Make sure your M-Pesa app is configured to use production environment"
echo "   - Verify the callback URL is whitelisted in your M-Pesa app settings"
echo "   - Test with a small amount first"

