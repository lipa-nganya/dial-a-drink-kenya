#!/bin/bash
# Setup PesaPal Sandbox Credentials for Dev Environment
# This configures PesaPal sandbox credentials and URLs for testing

set -e

echo "🔧 Setting up PesaPal Sandbox for Dev Environment..."
echo ""

# Sandbox credentials
PESAPAL_CONSUMER_KEY="qkio1BGGYAXTu2JOfm7XSXNruoZsrqEW"
PESAPAL_CONSUMER_SECRET="osGQ364R49cXKeOYSpaOnT++rHs="
PESAPAL_ENVIRONMENT="sandbox"

# URLs
BACKEND_URL="https://deliveryos-backend-p6bkgryxqa-uc.a.run.app"
FRONTEND_URL="https://dialadrink.thewolfgang.tech"
IPN_CALLBACK_URL="${BACKEND_URL}/api/pesapal/ipn"

echo "📋 Configuration:"
echo "   Environment: ${PESAPAL_ENVIRONMENT}"
echo "   Consumer Key: ${PESAPAL_CONSUMER_KEY:0:20}..."
echo "   Backend URL: ${BACKEND_URL}"
echo "   Frontend URL: ${FRONTEND_URL}"
echo "   IPN Callback: ${IPN_CALLBACK_URL}"
echo ""

# Get existing environment variables
echo "📊 Retrieving existing environment variables..."
EXISTING_ENV_RAW=$(gcloud run services describe deliveryos-backend --region us-central1 --format="get(spec.template.spec.containers[0].env)" --project drink-suite 2>/dev/null || echo "")
EXISTING_FRONTEND_URL=$(echo "$EXISTING_ENV_RAW" | grep -oP "FRONTEND_URL.*?value': '\K[^']*" || echo "")
EXISTING_ADMIN_URL=$(echo "$EXISTING_ENV_RAW" | grep -oP "ADMIN_URL.*?value': '\K[^']*" || echo "")

FRONTEND_URL_VALUE="${EXISTING_FRONTEND_URL:-${FRONTEND_URL}}"
ADMIN_URL_VALUE="${EXISTING_ADMIN_URL:-https://dialadrink-admin.thewolfgang.tech}"

echo "   FRONTEND_URL: ${FRONTEND_URL_VALUE}"
echo "   ADMIN_URL: ${ADMIN_URL_VALUE}"
echo ""

echo "🚀 Updating Cloud Run environment variables..."
gcloud run services update deliveryos-backend \
  --region us-central1 \
  --project drink-suite \
  --update-env-vars "PESAPAL_CONSUMER_KEY=${PESAPAL_CONSUMER_KEY},PESAPAL_CONSUMER_SECRET=${PESAPAL_CONSUMER_SECRET},PESAPAL_ENVIRONMENT=${PESAPAL_ENVIRONMENT},PESAPAL_IPN_CALLBACK_URL=${IPN_CALLBACK_URL},CUSTOMER_FRONTEND_URL=${FRONTEND_URL_VALUE},FRONTEND_URL=${FRONTEND_URL_VALUE},ADMIN_URL=${ADMIN_URL_VALUE}" \
  --quiet

echo ""
echo "✅ PesaPal Sandbox credentials configured!"
echo ""
echo "📋 Next Steps:"
echo "   1. Configure IPN URL in PesaPal Dashboard:"
echo "      URL: ${IPN_CALLBACK_URL}"
echo "      (Even though using sandbox, configure in Production credentials section)"
echo ""
echo "   2. Configure Website URL in PesaPal Dashboard:"
echo "      URL: ${FRONTEND_URL_VALUE}"
echo ""
echo "   3. Test the payment flow:"
echo "      - Create an order on: ${FRONTEND_URL_VALUE}"
echo "      - Select 'Card' payment method"
echo "      - Complete payment on PesaPal sandbox"
echo ""
echo "   4. Monitor IPN callbacks:"
echo "      gcloud logging read \"resource.type=cloud_run_revision AND resource.labels.service_name=deliveryos-backend AND textPayload=~'pesapal'\" --limit 50 --project drink-suite"
echo ""
