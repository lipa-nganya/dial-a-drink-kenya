# Backend Deployment to Cloud Run

This repository now includes a Dockerfile that builds the API into a container suitable for Google Cloud Run. Below is a simple end-to-end flow:

## 1. Build and test locally (optional but recommended)

```bash
cd backend
docker build -t dialadrink-backend .
docker run --rm -p 8080:8080 \
  --env-file ../.env \
  dialadrink-backend
```

Open http://localhost:8080 (or the appropriate endpoint) to verify.

## 2. Push the image and deploy to Cloud Run

Replace the variables in brackets with your own values.

```bash
# authenticate if needed
gcloud auth login
gcloud auth configure-docker

# set project and region if not already configured
gcloud config set project drink-suite
gcloud config set run/region us-central1

# build and push using Cloud Build
gcloud builds submit --tag gcr.io/drink-suite/dialadrink-backend ./backend

# deploy to Cloud Run
gcloud run deploy dialadrink-backend \
  --image gcr.io/drink-suite/dialadrink-backend \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "PORT=8080"
```

If you are using Cloud SQL, add `--set-cloudsql-instances=PROJECT:REGION:INSTANCE` and ensure the service account has `roles/cloudsql.client`.

## 3. Manage secrets

Create secrets in Secret Manager and mount them as environment variables or volumes when deploying. Example:

```bash
gcloud secrets create dialadrink-env --data-file=backend/.env.production
gcloud run deploy dialadrink-backend \
  --image gcr.io/drink-suite/dialadrink-backend \
  --update-secrets "MPESA_CONSUMER_KEY=dialadrink-env:mpesa_consumer_key"
```

## 4. Update clients

Once deployed, note the service URL returned by Cloud Run. Update frontend and mobile clients to use the new domain.


