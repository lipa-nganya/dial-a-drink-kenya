#!/bin/bash
# Pre-deployment validation script for backend
# Run this BEFORE deploying to catch errors early

set -e

echo "🔍 Running pre-deployment checks..."
echo ""

cd "$(dirname "$0")"

# 1. Check for syntax errors
echo "✅ Checking for JavaScript syntax errors..."
if ! node -c app.js 2>/dev/null; then
  echo "❌ Syntax error in app.js"
  exit 1
fi

# 2. Check for duplicate variable declarations
echo "✅ Checking for duplicate variable declarations..."
DUPLICATES=$(grep -r "const\|let\|var" routes/ models/ services/ utils/ 2>/dev/null | \
  awk '{print $2}' | sort | uniq -d | head -10)

if [ ! -z "$DUPLICATES" ]; then
  echo "⚠️  Warning: Potential duplicate declarations found:"
  echo "$DUPLICATES"
  echo ""
  echo "Checking critical files..."
  
  # Check mpesa.js specifically (known issue area)
  PAYMENT_PROVIDER_COUNT=$(grep -c "const paymentProvider\|let paymentProvider\|var paymentProvider" routes/mpesa.js 2>/dev/null || echo "0")
  if [ "$PAYMENT_PROVIDER_COUNT" -gt "1" ]; then
    echo "❌ ERROR: Duplicate paymentProvider declaration in routes/mpesa.js"
    echo "   Found $PAYMENT_PROVIDER_COUNT declarations"
    grep -n "paymentProvider" routes/mpesa.js | head -5
    exit 1
  fi
fi

# 3. Check for missing dependencies
echo "✅ Checking for missing npm dependencies..."
if [ ! -d "node_modules" ]; then
  echo "⚠️  node_modules not found. Run 'npm install' first."
  exit 1
fi

# 4. Check for required environment variables (for local testing)
echo "✅ Checking environment configuration..."
if [ -z "$DATABASE_URL" ] && [ -z "$CLOUD_DATABASE_URL" ]; then
  echo "⚠️  Warning: DATABASE_URL not set (will use cloud env vars in production)"
fi

# 5. Validate CORS configuration
echo "✅ Validating CORS configuration..."
if ! grep -q "thewolfgang.tech" app.js; then
  echo "⚠️  Warning: CORS may not be configured for thewolfgang.tech domains"
fi

# 6. Check for common errors
echo "✅ Checking for common deployment issues..."

# Check for hardcoded localhost URLs in production code
HARDCODED_LOCALHOST=$(grep -r "localhost:5001\|127.0.0.1:5001" routes/ services/ --include="*.js" 2>/dev/null | grep -v "//" | grep -v "localhost" | wc -l)
if [ "$HARDCODED_LOCALHOST" -gt "0" ]; then
  echo "⚠️  Warning: Found potential hardcoded localhost URLs in production code"
fi

# Check for console.log statements that might expose sensitive data
SENSITIVE_LOGS=$(grep -r "console.log.*password\|console.log.*secret\|console.log.*key" routes/ services/ --include="*.js" 2>/dev/null | wc -l)
if [ "$SENSITIVE_LOGS" -gt "0" ]; then
  echo "⚠️  Warning: Found potential sensitive data in console.log statements"
fi

echo ""
echo "✅ Pre-deployment checks passed!"
echo ""
echo "Next steps:"
echo "  1. Review any warnings above"
echo "  2. Run: ./deploy-backend.sh"
echo ""
