#!/bin/bash

# Trigger deployment by making a small change
echo "Triggering deployment..."

# Add a timestamp to force deployment
echo "<!-- Deployment triggered at $(date) -->" >> frontend/public/index.html

# Commit and push
git add frontend/public/index.html frontend/public/test-routing.html
git commit -m "Trigger deployment - $(date)"
git push origin main

echo "Deployment triggered successfully!"
