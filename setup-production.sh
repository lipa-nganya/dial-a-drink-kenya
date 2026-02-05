#!/bin/bash
# Production Setup Script for Dial A Drink
# This script sets up the complete production environment on Google Cloud Platform

set -e

# Production Configuration
PROJECT_ID="dialadrink-production"
REGION="us-central1"
ZONE="us-central1-a"
SERVICE_NAME="dialadrink-backend-prod"
INSTANCE_NAME="dialadrink-db-prod"
DB_NAME="dialadrink_prod"
DB_USER="dialadrink_app"
DB_PASSWORD=""  # Will be generated or provided

echo "🚀 Dial A Drink Production Setup"
echo "=================================="
echo ""
echo "📋 Configuration:"
echo "   Project ID: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Zone: $ZONE"
echo "   Service: $SERVICE_NAME"
echo "   Database Instance: $INSTANCE_NAME"
echo ""

# Step 1: Authenticate with Google Cloud
echo "🔐 Step 1: Authenticating with Google Cloud..."
echo "   Please authenticate with: dialadrinkkenya254@gmail.com"
echo ""
gcloud auth login dialadrinkkenya254@gmail.com --no-launch-browser || {
    echo "⚠️  Interactive login required. Please run:"
    echo "   gcloud auth login dialadrinkkenya254@gmail.com"
    exit 1
}

# Step 2: Create or select project
echo ""
echo "📦 Step 2: Setting up GCP project..."
if gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
    echo "   ✅ Project $PROJECT_ID already exists"
else
    echo "   📝 Creating project $PROJECT_ID..."
    gcloud projects create "$PROJECT_ID" --name="Dial A Drink Production"
    echo "   ✅ Project created"
fi

gcloud config set project "$PROJECT_ID"
gcloud config set compute/region "$REGION"
gcloud config set compute/zone "$ZONE"

# Step 3: Enable billing (manual step required)
echo ""
echo "💰 Step 3: Billing Account"
echo "   ⚠️  Please link a billing account in the Google Cloud Console:"
echo "   https://console.cloud.google.com/billing?project=$PROJECT_ID"
read -p "   Press Enter after billing account is linked..."

# Step 4: Enable required APIs
echo ""
echo "🔧 Step 4: Enabling required APIs..."
APIS=(
    "serviceusage.googleapis.com"
    "cloudresourcemanager.googleapis.com"
    "iam.googleapis.com"
    "compute.googleapis.com"
    "run.googleapis.com"
    "sqladmin.googleapis.com"
    "artifactregistry.googleapis.com"
    "logging.googleapis.com"
    "monitoring.googleapis.com"
    "cloudbuild.googleapis.com"
    "secretmanager.googleapis.com"
    "containerregistry.googleapis.com"
)

for api in "${APIS[@]}"; do
    echo "   Enabling $api..."
    gcloud services enable "$api" --project="$PROJECT_ID" 2>/dev/null || true
done
echo "   ✅ APIs enabled"

# Step 5: Create Cloud SQL instance
echo ""
echo "🗄️  Step 5: Creating Cloud SQL instance..."
if gcloud sql instances describe "$INSTANCE_NAME" --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo "   ✅ Cloud SQL instance $INSTANCE_NAME already exists"
else
    echo "   📝 Creating Cloud SQL instance (this may take 5-10 minutes)..."
    gcloud sql instances create "$INSTANCE_NAME" \
        --database-version=POSTGRES_15 \
        --tier=db-f1-micro \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --storage-type=SSD \
        --storage-size=10GB \
        --backup-start-time=03:00 \
        --enable-bin-log \
        --maintenance-window-day=SUN \
        --maintenance-window-hour=4 \
        --network=default \
        --no-assign-ip || {
        echo "   ⚠️  Instance creation may have failed. Check console for details."
        exit 1
    }
    echo "   ✅ Cloud SQL instance created"
fi

# Step 6: Set database password
echo ""
echo "🔑 Step 6: Setting database password..."
if [ -z "$DB_PASSWORD" ]; then
    # Generate a secure password
    DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    echo "   Generated password: $DB_PASSWORD"
    echo "   ⚠️  SAVE THIS PASSWORD SECURELY!"
    echo ""
    read -p "   Press Enter to continue or Ctrl+C to cancel..."
else
    echo "   Using provided password"
fi

# Create database user if it doesn't exist
echo "   Creating database user..."
gcloud sql users create "$DB_USER" \
    --instance="$INSTANCE_NAME" \
    --password="$DB_PASSWORD" \
    --project="$PROJECT_ID" 2>/dev/null || {
    echo "   User may already exist, updating password..."
    gcloud sql users set-password "$DB_USER" \
        --instance="$INSTANCE_NAME" \
        --password="$DB_PASSWORD" \
        --project="$PROJECT_ID"
}

# Step 7: Create database
echo ""
echo "📊 Step 7: Creating database..."
gcloud sql databases create "$DB_NAME" \
    --instance="$INSTANCE_NAME" \
    --project="$PROJECT_ID" 2>/dev/null || {
    echo "   Database may already exist, continuing..."
}

# Step 8: Get connection name
CONNECTION_NAME=$(gcloud sql instances describe "$INSTANCE_NAME" --project="$PROJECT_ID" --format="value(connectionName)")
echo ""
echo "✅ Cloud SQL Setup Complete!"
echo ""
echo "📋 Connection Details:"
echo "   Connection Name: $CONNECTION_NAME"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo "   Password: $DB_PASSWORD"
echo ""
echo "🔗 DATABASE_URL:"
echo "   postgresql://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${CONNECTION_NAME}"
echo ""
echo "📝 Next Steps:"
echo "   1. Save the database password securely"
echo "   2. Run migrations: ./backend/scripts/run-production-migrations.sh"
echo "   3. Deploy backend: ./deploy-backend-production.sh"
echo "   4. Set up Netlify production sites"
echo "   5. Build Android production app"
echo ""
echo "💾 Saving connection details to production-config.env..."
cat > production-config.env <<EOF
# Production Configuration
PROJECT_ID=$PROJECT_ID
REGION=$REGION
SERVICE_NAME=$SERVICE_NAME
INSTANCE_NAME=$INSTANCE_NAME
CONNECTION_NAME=$CONNECTION_NAME
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${CONNECTION_NAME}
EOF

echo "✅ Configuration saved to production-config.env"
echo "   ⚠️  Keep this file secure and add it to .gitignore!"
