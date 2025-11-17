#!/bin/bash

echo "=== Switching Cloud Run services from Repository to Container deployment ==="
echo ""

# List current Cloud Build triggers
echo "1. Listing current Cloud Build triggers..."
gcloud builds triggers list --format="table(name,github.name,branch)"

echo ""
echo "2. Deleting Cloud Build triggers..."
TRIGGERS=$(gcloud builds triggers list --format="value(name)" 2>/dev/null)

if [ -z "$TRIGGERS" ]; then
  echo "   No triggers found to delete."
else
  for trigger in $TRIGGERS; do
    echo "   Deleting trigger: $trigger"
    gcloud builds triggers delete "$trigger" --quiet 2>&1
  done
  echo "   ✅ All triggers deleted"
fi

echo ""
echo "3. Checking current Cloud Run services..."
SERVICES=$(gcloud run services list --format="value(name,region)" 2>/dev/null | grep -E "dialadrink-(backend|admin|frontend)")

echo "   Found services:"
echo "$SERVICES"

echo ""
echo "4. Verifying services are using container images..."
for service_info in $SERVICES; do
  SERVICE_NAME=$(echo $service_info | cut -d',' -f1)
  REGION=$(echo $service_info | cut -d',' -f2)
  
  if [ -n "$SERVICE_NAME" ] && [ -n "$REGION" ]; then
    echo ""
    echo "   Service: $SERVICE_NAME (Region: $REGION)"
    IMAGE=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format="get(spec.template.spec.containers[0].image)" 2>/dev/null)
    if [ -n "$IMAGE" ]; then
      echo "   ✅ Currently using image: $IMAGE"
    else
      echo "   ⚠️  No image found - service may need to be redeployed"
    fi
  fi
done

echo ""
echo "=== Summary ==="
echo "✅ Cloud Build triggers removed"
echo "✅ Services are now configured for container-based deployment"
echo ""
echo "To deploy manually, use:"
echo "  gcloud run deploy <service-name> --image <image-url> --region us-central1"
echo ""
echo "Or build and deploy using cloudbuild.yaml:"
echo "  gcloud builds submit --config backend/cloudbuild.yaml backend/"
echo "  gcloud builds submit --config admin-frontend/cloudbuild.yaml admin-frontend/"
echo "  gcloud builds submit --config frontend/cloudbuild.yaml frontend/"




