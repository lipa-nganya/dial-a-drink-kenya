# Admin Frontend Deployment (GCP)

The admin dashboard is another React SPA. Deployment mirrors the customer site:

## 1. Build the bundle

```bash
cd admin-frontend
npm ci
npm run build
```

Artifacts land in `admin-frontend/build`.

## 2. Upload to Cloud Storage

```bash
PROJECT_ID=drink-suite
BUCKET_NAME=${PROJECT_ID}-admin-web
REGION=us

gcloud storage buckets create gs://${BUCKET_NAME} --project=${PROJECT_ID} --location=${REGION} --uniform-bucket-level-access
gsutil -m rsync -r build gs://${BUCKET_NAME}
gsutil iam ch allUsers:objectViewer gs://${BUCKET_NAME}
gsutil web set -m index.html -e index.html gs://${BUCKET_NAME}
```

## 3. (Optional) Place behind Cloud CDN

Reuse the instructions from the customer guide with different resource names, for example:

```bash
gcloud compute backend-buckets create admin-site-backend \
  --gcs-bucket-name=${BUCKET_NAME} \
  --enable-cdn
# Continue with url-map, proxy, forwarding rule, SSL certificate, etc.
```

## 4. Continuous deployment

You can reuse the sample Cloud Build pipeline:

```yaml
steps:
  - name: 'gcr.io/cloud-builders/npm'
    dir: admin-frontend
    args: ['ci']
  - name: 'gcr.io/cloud-builders/npm'
    dir: admin-frontend
    args: ['run', 'build']
  - name: 'gcr.io/cloud-builders/gsutil'
    dir: admin-frontend/build
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        gsutil -m rsync -r . gs://${BUCKET_NAME}
```

Trigger on `main` to keep the admin UI up-to-date.


