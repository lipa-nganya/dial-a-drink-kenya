# Manual Production Deployment - Step by Step

Run these commands in your terminal to deploy to production and track logs.

## Step 1: Configure gcloud
```bash
cd /Users/maria/dial-a-drink
gcloud config set project dialadrink-production
gcloud config set account dialadrinkkenya254@gmail.com
```

## Step 2: Check Current Status
```bash
# Check existing services
gcloud run services list --region us-central1 --project dialadrink-production

# Check ongoing builds
gcloud builds list --project dialadrink-production --ongoing
```

## Step 3: Deploy Backend
```bash
cd backend

# Build Docker image
IMAGE_TAG="gcr.io/dialadrink-production/deliveryos-backend-prod:$(date +%s)"
echo "Building: $IMAGE_TAG"
gcloud builds submit --tag "$IMAGE_TAG" .

# Get existing env vars
EXISTING_ENV=$(gcloud run services describe deliveryos-production-backend \
    --region us-central1 \
    --project dialadrink-production \
    --format="get(spec.template.spec.containers[0].env)" 2>/dev/null)

EXISTING_FRONTEND_URL=$(echo "$EXISTING_ENV" | grep -o "FRONTEND_URL.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "https://ruakadrinksdelivery.co.ke")
EXISTING_ADMIN_URL=$(echo "$EXISTING_ENV" | grep -o "ADMIN_URL.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "https://dial-a-drink-admin.netlify.app")

# Deploy
gcloud run deploy deliveryos-production-backend \
    --image "$IMAGE_TAG" \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --add-cloudsql-instances dialadrink-production:us-central1:dialadrink-db-prod \
    --set-env-vars "NODE_ENV=production,DATABASE_URL=postgresql://dialadrink_app:E7A3IIa60hFD3bkGH1XAiryvB@/dialadrink_prod?host=/cloudsql/dialadrink-production:us-central1:dialadrink-db-prod,FRONTEND_URL=${EXISTING_FRONTEND_URL},ADMIN_URL=${EXISTING_ADMIN_URL},GOOGLE_CLOUD_PROJECT=dialadrink-production,GCP_PROJECT=dialadrink-production,HOST=0.0.0.0" \
    --memory 512Mi \
    --timeout 300 \
    --max-instances 10 \
    --min-instances 0 \
    --cpu 1 \
    --project dialadrink-production

# Verify
BACKEND_URL=$(gcloud run services describe deliveryos-production-backend \
    --region us-central1 \
    --project dialadrink-production \
    --format "value(status.url)")
echo "✅ Backend deployed: $BACKEND_URL"

cd ..
```

## Step 4: Deploy Admin Frontend
```bash
cd admin-frontend

SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || date +%s | sha256sum | head -c 8)
echo "Using SHORT_SHA: $SHORT_SHA"

# Try to get Google Maps API key (optional)
GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY:-$(gcloud secrets versions access latest --secret=google-maps-api-key --project=dialadrink-production 2>/dev/null || echo '')}"

if [ -n "$GOOGLE_MAPS_API_KEY" ]; then
    echo "Building with API key..."
    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions=SHORT_SHA=$SHORT_SHA,_GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY \
        --project dialadrink-production .
else
    echo "Building without API key..."
    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions=SHORT_SHA=$SHORT_SHA \
        --project dialadrink-production .
fi

# Verify
ADMIN_URL=$(gcloud run services describe deliveryos-admin-frontend \
    --region us-central1 \
    --project dialadrink-production \
    --format "value(status.url)" 2>/dev/null)
echo "✅ Admin frontend deployed: ${ADMIN_URL:-'Check status manually'}"

cd ..
```

## Step 5: Deploy Customer Frontend
```bash
cd frontend

SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || date +%s | sha256sum | head -c 8)
echo "Using SHORT_SHA: $SHORT_SHA"

if [ -n "$GOOGLE_MAPS_API_KEY" ]; then
    echo "Building with API key..."
    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions=SHORT_SHA=$SHORT_SHA,_GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY \
        --project dialadrink-production .
else
    echo "Building without API key..."
    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions=SHORT_SHA=$SHORT_SHA \
        --project dialadrink-production .
fi

# Verify
CUSTOMER_URL=$(gcloud run services describe deliveryos-customer-frontend \
    --region us-central1 \
    --project dialadrink-production \
    --format "value(status.url)" 2>/dev/null)
echo "✅ Customer frontend deployed: ${CUSTOMER_URL:-'Check status manually'}"

cd ..
```

## Monitor Builds in Real-Time

**Watch latest build:**
```bash
BUILD_ID=$(gcloud builds list --project dialadrink-production --limit 1 --format="value(id)")
gcloud builds log $BUILD_ID --project dialadrink-production --stream
```

**Check build status:**
```bash
gcloud builds list --project dialadrink-production --limit 5
```

**Watch service status:**
```bash
watch -n 5 'gcloud run services list --region us-central1 --project dialadrink-production'
```

## Troubleshooting

**If build fails:**
```bash
# Get build logs
BUILD_ID=$(gcloud builds list --project dialadrink-production --limit 1 --format="value(id)")
gcloud builds log $BUILD_ID --project dialadrink-production

# Check service logs
gcloud run services logs read deliveryos-production-backend --region us-central1 --project dialadrink-production --limit 50
```

**If service not updating:**
```bash
# Force new revision
gcloud run services update deliveryos-production-backend \
    --region us-central1 \
    --project dialadrink-production \
    --no-traffic
```

**Check service revisions:**
```bash
gcloud run revisions list --service deliveryos-production-backend \
    --region us-central1 \
    --project dialadrink-production
```
