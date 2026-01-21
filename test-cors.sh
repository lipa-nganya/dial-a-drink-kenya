#!/bin/bash
# Test CORS configuration for Netlify domains

echo "🧪 Testing CORS Configuration..."
echo ""

BACKEND_URL="https://deliveryos-backend-p6bkgryxqa-uc.a.run.app"
CUSTOMER_ORIGIN="https://dialadrink.thewolfgang.tech"
ADMIN_ORIGIN="https://dialadrink-admin.thewolfgang.tech"

echo "1. Testing Customer Site CORS (OPTIONS preflight)..."
RESPONSE=$(curl -s -I -X OPTIONS \
  -H "Origin: $CUSTOMER_ORIGIN" \
  -H "Access-Control-Request-Method: GET" \
  "$BACKEND_URL/api/health" 2>&1)

if echo "$RESPONSE" | grep -qi "access-control-allow-origin"; then
  echo "   ✅ CORS headers present"
  echo "$RESPONSE" | grep -i "access-control"
else
  echo "   ❌ No CORS headers found"
  echo "$RESPONSE" | head -10
fi

echo ""
echo "2. Testing Admin Site CORS (OPTIONS preflight)..."
RESPONSE=$(curl -s -I -X OPTIONS \
  -H "Origin: $ADMIN_ORIGIN" \
  -H "Access-Control-Request-Method: GET" \
  "$BACKEND_URL/api/health" 2>&1)

if echo "$RESPONSE" | grep -qi "access-control-allow-origin"; then
  echo "   ✅ CORS headers present"
  echo "$RESPONSE" | grep -i "access-control"
else
  echo "   ❌ No CORS headers found"
  echo "$RESPONSE" | head -10
fi

echo ""
echo "3. Testing Customer Site CORS (GET request)..."
RESPONSE=$(curl -s -I \
  -H "Origin: $CUSTOMER_ORIGIN" \
  "$BACKEND_URL/api/health" 2>&1)

if echo "$RESPONSE" | grep -qi "access-control-allow-origin"; then
  echo "   ✅ CORS headers present"
  echo "$RESPONSE" | grep -i "access-control"
else
  echo "   ❌ No CORS headers found"
  echo "$RESPONSE" | head -10
fi

echo ""
echo "4. Testing Admin Site CORS (GET request)..."
RESPONSE=$(curl -s -I \
  -H "Origin: $ADMIN_ORIGIN" \
  "$BACKEND_URL/api/health" 2>&1)

if echo "$RESPONSE" | grep -qi "access-control-allow-origin"; then
  echo "   ✅ CORS headers present"
  echo "$RESPONSE" | grep -i "access-control"
else
  echo "   ❌ No CORS headers found"
  echo "$RESPONSE" | head -10
fi

echo ""
echo "✅ CORS Test Complete"
