#!/bin/bash
cd /Users/maria/dial-a-drink

echo "=== Checking git status ==="
git status

echo ""
echo "=== Adding files ==="
git add backend/routes/admin.js backend/routes/mpesa.js admin-frontend/src/pages/Transactions.js admin-frontend/src/pages/AdminOverview.js admin-frontend/src/utils/chipStyles.js

echo ""
echo "=== Staged files ==="
git status --short

echo ""
echo "=== Committing ==="
git commit -m "Fix: Transaction type display and STK push for Cloud Run

- Add transaction type normalization in backend endpoints
- Fix frontend transaction type display with proper fallbacks
- Fix STK push to detect Cloud Run and send real payments
- Ensure all transactions display proper types"

echo ""
echo "=== Pushing to GitHub ==="
git push origin main

echo ""
echo "=== Latest commit ==="
git log --oneline -1

echo ""
echo "=== DONE ==="



