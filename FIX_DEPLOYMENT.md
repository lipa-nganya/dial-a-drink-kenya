# Fix: Services Not Updating

The services show old update times because the deployments didn't actually update them. Run these commands to force update:

## Step 1: Check Current Status

```bash
# Check when services were last updated
gcloud run services describe deliveryos-production-backend \
    --region us-central1 \
    --project dialadrink-production \
    --format="value(metadata.creationTimestamp)"

gcloud run services describe deliveryos-admin-frontend \
    --region us-central1 \
    --project dialadrink-production \
    --format="value(metadata.creationTimestamp)"

gcloud run services describe deliveryos-customer-frontend \
    --region us-central1 \
    --project dialadrink-production \
    --format="value(metadata.creationTimestamp)"

# Check recent builds
gcloud builds list --project dialadrink-production --limit 5
```

## Step 2: Force Update Backend

```bash
cd /Users/maria/dial-a-drink/backend

# Build new image with unique tag
IMAGE_TAG="gcr.io/dialadrink-production/deliveryos-backend-prod:force-$(date +%s)"
echo "Building: $IMAGE_TAG"

# Build
gcloud builds submit --tag "$IMAGE_TAG" .

# Get current env vars
CURRENT_ENV=$(gcloud run services describe deliveryos-production-backend \
    --region us-central1 \
    --project dialadrink-production \
    --format="get(spec.template.spec.containers[0].env)")

# Extract values
FRONTEND_URL=$(echo "$CURRENT_ENV" | grep -oP "FRONTEND_URL.*?value': '\K[^']*" || echo "https://ruakadrinksdelivery.co.ke")
ADMIN_URL=$(echo "$CURRENT_ENV" | grep -oP "ADMIN_URL.*?value': '\K[^']*" || echo "https://dial-a-drink-admin.netlify.app")

# Deploy - this will create a NEW revision
gcloud run deploy deliveryos-production-backend \
    --image "$IMAGE_TAG" \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --add-cloudsql-instances dialadrink-production:us-central1:dialadrink-db-prod \
    --set-env-vars "NODE_ENV=production,DATABASE_URL=postgresql://dialadrink_app:E7A3IIa60hFD3bkGH1XAiryvB@/dialadrink_prod?host=/cloudsql/dialadrink-production:us-central1:dialadrink-db-prod,FRONTEND_URL=${FRONTEND_URL},ADMIN_URL=${ADMIN_URL},GOOGLE_CLOUD_PROJECT=dialadrink-production,GCP_PROJECT=dialadrink-production,HOST=0.0.0.0" \
    --memory 512Mi \
    --timeout 300 \
    --max-instances 10 \
    --min-instances 0 \
    --cpu 1 \
    --project dialadrink-production

# Verify new revision was created
echo "New revision:"
gcloud run revisions list --service deliveryos-production-backend \
    --region us-central1 \
    --project dialadrink-production \
    --limit 1

cd ..
```

## Step 3: Force Update Admin Frontend

```bash
cd /Users/maria/dial-a-drink/admin-frontend

SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || date +%s | sha256sum | head -c 8)
echo "Using SHORT_SHA: $SHORT_SHA"

# Try to get API key
GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY:-$(gcloud secrets versions access latest --secret=google-maps-api-key --project=dialadrink-production 2>/dev/null || echo '')}"

if [ -n "$GOOGLE_MAPS_API_KEY" ]; then
    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions=SHORT_SHA=$SHORT_SHA,_GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY \
        --project dialadrink-production .
else
    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions=SHORT_SHA=$SHORT_SHA \
        --project dialadrink-production .
fi

# Verify
echo "New revision:"
gcloud run revisions list --service deliveryos-admin-frontend \
    --region us-central1 \
    --project dialadrink-production \
    --limit 1

cd ..
```

## Step 4: Force Update Customer Frontend

```bash
cd /Users/maria/dial-a-drink/frontend

SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || date +%s | sha256sum | head -c 8)
echo "Using SHORT_SHA: $SHORT_SHA"

if [ -n "$GOOGLE_MAPS_API_KEY" ]; then
    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions=SHORT_SHA=$SHORT_SHA,_GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY \
        --project dialadrink-production .
else
    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions=SHORT_SHA=$SHORT_SHA \
        --project dialadrink-production .
fi

# Verify
echo "New revision:"
gcloud run revisions list --service deliveryos-customer-frontend \
    --region us-central1 \
    --project dialadrink-production \
    --limit 1

cd ..
```

## Step 5: Verify All Updates

```bash
echo "=== Final Status ==="
for service in deliveryos-production-backend deliveryos-admin-frontend deliveryos-customer-frontend; do
    echo ""
    echo "--- $service ---"
    gcloud run services describe "$service" \
        --region us-central1 \
        --project dialadrink-production \
        --format="value(metadata.creationTimestamp,status.url)"
done
```

## Troubleshooting

**If builds are failing:**
```bash
# Check latest build logs
BUILD_ID=$(gcloud builds list --project dialadrink-production --limit 1 --format="value(id)")
gcloud builds log $BUILD_ID --project dialadrink-production
```

**If service shows old revision:**
```bash
# List all revisions
gcloud run revisions list --service deliveryos-production-backend \
    --region us-central1 \
    --project dialadrink-production

# Manually route traffic to latest revision
LATEST_REVISION=$(gcloud run revisions list --service deliveryos-production-backend \
    --region us-central1 \
    --project dialadrink-production \
    --limit 1 \
    --format="value(metadata.name)")

gcloud run services update-traffic deliveryos-production-backend \
    --region us-central1 \
    --project dialadrink-production \
    --to-revisions=$LATEST_REVISION=100
```
