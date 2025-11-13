# 💰 Setup Budget Cap ($300 USD) with Service Suspension

This guide will help you set up a budget cap that automatically suspends all services when the $300 limit is reached.

## 🎯 Goal

- **Budget Cap**: $300 USD
- **Action**: Suspend all Cloud Run services when budget is exceeded
- **Protection**: Prevent unexpected charges

## 📋 Prerequisites

- Google Cloud Project: `drink-suite`
- Active billing account
- Cloud Run services deployed

## 🚀 Step-by-Step Setup

### Step 1: Enable Required APIs

```bash
gcloud config set project drink-suite

# Enable required APIs
gcloud services enable cloudbilling.googleapis.com
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable pubsub.googleapis.com
gcloud services enable run.googleapis.com
```

### Step 2: Get Billing Account ID

```bash
# List billing accounts
gcloud billing accounts list

# Note the billing account ID (format: 01XXXX-XXXXXX-XXXXXX)
BILLING_ACCOUNT_ID=$(gcloud billing accounts list --format="value(name)" --filter="open=true" | head -1 | cut -d'/' -f2)
echo "Billing Account ID: $BILLING_ACCOUNT_ID"
```

### Step 3: Create Budget via Console (Recommended)

1. **Go to Billing Budgets**
   - Visit: https://console.cloud.google.com/billing/budgets
   - Select your billing account

2. **Create Budget**
   - Click **"Create Budget"**
   - **Budget name**: `Dial A Drink Budget Cap`
   - **Budget scope**: `Single project` → Select `drink-suite`
   - **Budget amount**: `$300 USD`
   - **Period**: `Monthly`

3. **Set Thresholds**
   - Add alerts at: `50%`, `75%`, `90%`, `100%`
   - Email notifications: Add your email

4. **Configure Actions** (Important!)
   - Scroll to **"Actions"** section
   - Click **"Add Action"**
   - **Action type**: `Disable billing for this project`
   - **Trigger**: `100% of budget`
   - **Save**

### Step 4: Create Budget via CLI (Alternative)

```bash
# Get billing account ID
BILLING_ACCOUNT=$(gcloud billing accounts list --format="value(name)" --filter="open=true" | head -1)

# Create budget
gcloud billing budgets create \
  --billing-account=$BILLING_ACCOUNT \
  --display-name="Dial A Drink Budget Cap" \
  --budget-amount=300USD \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=75 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100 \
  --projects=drink-suite
```

**Note**: Budget actions (suspending services) must be configured via Console, not CLI.

### Step 5: Set Up Cloud Function to Suspend Services

Create a Cloud Function that suspends services when budget is exceeded:

```bash
# Create function directory
mkdir -p cloud-functions/suspend-services
cd cloud-functions/suspend-services
```

Create `index.js`:

```javascript
const {CloudRunServiceClient} = require('@google-cloud/run');

exports.suspendServices = async (pubsubMessage) => {
  const data = JSON.parse(Buffer.from(pubsubMessage.data, 'base64').toString());
  
  // Only act on 100% threshold
  if (data.alertThresholdExceeded !== 1.0) {
    console.log(`Threshold ${data.alertThresholdExceeded} exceeded, but not 100%`);
    return;
  }
  
  const client = new CloudRunServiceClient();
  const projectId = 'drink-suite';
  const region = 'us-central1';
  const services = [
    'dialadrink-backend',
    'dialadrink-customer',
    'dialadrink-admin'
  ];
  
  for (const serviceName of services) {
    try {
      const [service] = await client.getService({
        name: `projects/${projectId}/locations/${region}/services/${serviceName}`
      });
      
      // Update service to 0 instances (suspend)
      await client.updateService({
        service: {
          ...service,
          template: {
            ...service.template,
            scaling: {
              minInstanceCount: 0,
              maxInstanceCount: 0
            }
          }
        }
      });
      
      console.log(`✅ Suspended service: ${serviceName}`);
    } catch (error) {
      console.error(`❌ Failed to suspend ${serviceName}:`, error.message);
    }
  }
};
```

Create `package.json`:

```json
{
  "name": "suspend-services",
  "version": "1.0.0",
  "dependencies": {
    "@google-cloud/run": "^3.0.0"
  }
}
```

Deploy function:

```bash
gcloud functions deploy suspendServices \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --source=. \
  --entry-point=suspendServices \
  --trigger-topic=budget-alerts \
  --service-account=[YOUR_SERVICE_ACCOUNT]@[PROJECT_ID].iam.gserviceaccount.com
```

### Step 6: Grant Permissions

The Cloud Function needs permission to update Cloud Run services:

```bash
# Get service account
SERVICE_ACCOUNT="suspend-services@drink-suite.iam.gserviceaccount.com"

# Grant Cloud Run Admin
gcloud projects add-iam-policy-binding drink-suite \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/run.admin"
```

## 🔔 Step 7: Configure Budget Actions (Console Method)

**This is the easiest and most reliable method:**

1. **Go to Budget**
   - Visit: https://console.cloud.google.com/billing/budgets
   - Click on your budget

2. **Add Action**
   - Scroll to **"Actions"** section
   - Click **"Add Action"**
   - **Action type**: `Disable billing for this project`
   - **Trigger**: `100% of budget`
   - **Save**

3. **What This Does**
   - When budget reaches 100%, billing is disabled
   - All billable services are automatically suspended
   - Services remain suspended until you re-enable billing

## ✅ Verify Setup

### Check Budget Status

```bash
# List budgets
gcloud billing budgets list --billing-account=$(gcloud billing accounts list --format="value(name)" --filter="open=true" | head -1)
```

### Check Current Spending

```bash
# View current month's spending
gcloud billing projects describe drink-suite --format="value(billingAccountName)"
```

Or visit: https://console.cloud.google.com/billing

## 🚨 What Happens When Budget is Exceeded

1. **At 100% threshold**:
   - Billing is automatically disabled for the project
   - All billable services are suspended:
     - Cloud Run services stop
     - Cloud SQL instances stop (if applicable)
     - Other billable resources are disabled

2. **Services remain suspended** until you:
   - Re-enable billing in GCP Console
   - Or increase the budget cap

## 🔓 Re-enabling Services After Budget Cap

### Option 1: Via Console

1. **Go to Billing**
   - Visit: https://console.cloud.google.com/billing
   - Select your billing account

2. **Re-enable Billing**
   - Find your project: `drink-suite`
   - Click **"Re-enable billing"**
   - Confirm

3. **Restart Services**
   - Services will automatically restart
   - Or manually restart via Cloud Run console

### Option 2: Via CLI

```bash
# Re-enable billing (requires billing account admin)
gcloud billing projects link drink-suite \
  --billing-account=$(gcloud billing accounts list --format="value(name)" --filter="open=true" | head -1)
```

## 📊 Monitoring Budget

### Set Up Email Alerts

1. **In Budget Configuration**
   - Add email addresses for alerts
   - You'll receive emails at: 50%, 75%, 90%, 100%

### Check Spending Regularly

- **Console**: https://console.cloud.google.com/billing
- **CLI**: `gcloud billing projects describe drink-suite`

## 🎯 Recommended Setup

**Simplest Approach** (Recommended):

1. ✅ Create budget via Console with $300 cap
2. ✅ Set action: "Disable billing" at 100%
3. ✅ Add email alerts at 50%, 75%, 90%, 100%
4. ✅ Monitor spending via email alerts

This automatically suspends all services when budget is exceeded, no Cloud Function needed!

## 📝 Notes

- **Budget resets monthly** (based on billing cycle)
- **Suspended services** don't incur charges
- **Data is preserved** when services are suspended
- **Re-enabling billing** restores services automatically

## 🔗 Useful Links

- **Billing Dashboard**: https://console.cloud.google.com/billing
- **Budget Management**: https://console.cloud.google.com/billing/budgets
- **Current Spending**: https://console.cloud.google.com/billing/projects

