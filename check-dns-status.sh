#!/bin/bash

echo "🔍 Comprehensive DNS Check for staging.dialadrinkkenya.com"
echo "=========================================================="
echo ""

CORRECT_TARGET="dialadrink-customer.netlify.app"
WRONG_TARGET="dialadrink.thewolfgang.tech"

echo "Checking multiple DNS servers..."
echo ""

# Check Google DNS
GOOGLE_RESULT=$(dig @8.8.8.8 staging.dialadrinkkenya.com CNAME +short 2>/dev/null | head -1 | sed 's/\.$//')
echo "Google DNS (8.8.8.8):     $GOOGLE_RESULT"

# Check Cloudflare DNS
CF_RESULT=$(dig @1.1.1.1 staging.dialadrinkkenya.com CNAME +short 2>/dev/null | head -1 | sed 's/\.$//')
echo "Cloudflare DNS (1.1.1.1): $CF_RESULT"

# Check local DNS
LOCAL_RESULT=$(dig staging.dialadrinkkenya.com CNAME +short 2>/dev/null | head -1 | sed 's/\.$//')
echo "Local DNS:                $LOCAL_RESULT"
echo ""

# Determine status
if [ "$GOOGLE_RESULT" = "$CORRECT_TARGET" ] || [ "$CF_RESULT" = "$CORRECT_TARGET" ]; then
    echo "✅ DNS is correctly configured!"
    echo "   Target: $CORRECT_TARGET"
    echo ""
    echo "⏳ Next steps:"
    echo "   1. Wait for full DNS propagation (can take up to 60 minutes)"
    echo "   2. Netlify will automatically provision SSL certificate (5-15 min after DNS)"
    echo "   3. Test: https://staging.dialadrinkkenya.com"
    exit 0
elif [ "$GOOGLE_RESULT" = "$WRONG_TARGET" ] || [ "$CF_RESULT" = "$WRONG_TARGET" ]; then
    echo "❌ DNS still pointing to wrong target: $WRONG_TARGET"
    echo "   Should be: $CORRECT_TARGET"
    echo ""
    echo "📋 Action required:"
    echo "   1. Verify DNS record was saved in HostAfrica"
    echo "   2. Wait a few more minutes for propagation"
    echo "   3. Check HostAfrica DNS management to confirm the change"
    exit 1
else
    echo "⚠️  Mixed results or DNS not fully propagated"
    echo "   Google: $GOOGLE_RESULT"
    echo "   Cloudflare: $CF_RESULT"
    echo ""
    echo "💡 This is normal - DNS propagation can take 5-60 minutes"
    echo "   Check again in a few minutes"
    exit 2
fi
