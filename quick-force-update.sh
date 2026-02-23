#!/bin/bash
# Quick Force Update - Direct Commands

PROJECT_ID="dialadrink-production"
REGION="us-central1"

echo "🔍 Checking Service Last Update Times"
echo "======================================"
echo ""

# Backend
echo "Backend:"
gcloud run services describe deliveryos-production-backend \
    --region us-central1 \
    --project dialadrink-production \
    --format="value(metadata.creationTimestamp,status.latestReadyRevisionName)" 2>&1
echo ""

# Admin Frontend
echo "Admin Frontend:"
gcloud run services describe deliveryos-admin-frontend \
    --region us-central1 \
    --project dialadrink-production \
    --format="value(metadata.creationTimestamp,status.latestReadyRevisionName)" 2>&1
echo ""

# Customer Frontend
echo "Customer Frontend:"
gcloud run services describe deliveryos-customer-frontend \
    --region us-central1 \
    --project dialadrink-production \
    --format="value(metadata.creationTimestamp,status.latestReadyRevisionName)" 2>&1
echo ""

echo "📋 Recent Builds:"
gcloud builds list --project dialadrink-production --limit 5 --format="table(id,status,createTime,finishTime)" 2>&1
echo ""

echo "💡 To force update, run the deployment commands from DEPLOY_NOW.md"
echo ""
