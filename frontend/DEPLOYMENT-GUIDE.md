# Customer Frontend Deployment (GCP)

This React app can be deployed as static assets served from Google Cloud Storage with Cloud CDN in front. Steps:

## 1. Build the bundle

```bash
cd frontend
npm ci
npm run build
```

The optimized assets will be in `frontend/build`.

## 2. Create a storage bucket and upload

```bash
PROJECT_ID=drink-suite
BUCKET_NAME=${PROJECT_ID}-customer-web
REGION=us

gcloud storage buckets create gs://${BUCKET_NAME} --project=${PROJECT_ID} --location=${REGION} --uniform-bucket-level-access

# Upload build output
gsutil -m rsync -r build gs://${BUCKET_NAME}

# Make objects publicly readable
gsutil iam ch allUsers:objectViewer gs://${BUCKET_NAME}
```

## 3. Enable static website settings (optional)

```bash
gsutil web set -m index.html -e index.html gs://${BUCKET_NAME}
```

## 4. Front the bucket with Cloud CDN (optional but recommended)

```bash
gcloud compute backend-buckets create customer-site-backend \
  --gcs-bucket-name=${BUCKET_NAME} \
  --enable-cdn

gcloud compute url-maps create customer-site-map \
  --default-backend-bucket=customer-site-backend

gcloud compute target-http-proxies create customer-site-proxy \
  --url-map=customer-site-map

gcloud compute forwarding-rules create customer-site-forwarding-rule \
  --address=0.0.0.0 \
  --global \
  --target-http-proxy=customer-site-proxy \
  --ports=80
```

Replace the forwarding rule with an HTTPS load balancer and certificate (`gcloud compute ssl-certificates`) for production traffic.

## 5. Update DNS

Once the load balancer is ready, point your customer-facing domain at the provided IP or Cloud Run custom domain.

## 6. Automate

Create a Cloud Build trigger:

```yaml
# cloudbuild-frontend.yaml
steps:
  - name: 'gcr.io/cloud-builders/npm'
    dir: frontend
    args: ['ci']
  - name: 'gcr.io/cloud-builders/npm'
    dir: frontend
    args: ['run', 'build']
  - name: 'gcr.io/cloud-builders/gsutil'
    dir: frontend/build
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        gsutil -m rsync -r . gs://${BUCKET_NAME}
artifacts:
  objects:
    location: gs://${BUCKET_NAME}
    paths: ['**']
```

Trigger this on pushes to `main` to keep the site in sync.


