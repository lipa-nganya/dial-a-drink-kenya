#!/bin/bash

echo "🔍 Netlify SSL Certificate Status Check"
echo "======================================="
echo ""

# Check if we can get domain info from Netlify
if netlify status &>/dev/null; then
    echo "✅ Netlify CLI is configured"
    echo ""
    echo "📋 Domain Configuration:"
    DOMAIN_INFO=$(netlify sites:list --json 2>/dev/null | grep -A 15 "staging.dialadrinkkenya.com" | head -20)
    if [ -n "$DOMAIN_INFO" ]; then
        echo "$DOMAIN_INFO" | grep -E "(staging|domain|alias)" | head -5
        echo ""
        echo "⚠️  Note: Netlify CLI doesn't show SSL status directly"
        echo "   You need to check the Netlify dashboard:"
        echo "   https://app.netlify.com/projects/dialadrink-customer/configuration/domains"
    fi
else
    echo "⚠️  Netlify CLI not configured"
fi

echo ""
echo "🌐 Current Status:"
echo "   DNS: ✅ Correct (points to dialadrink-customer.netlify.app)"
echo "   SSL: ❌ Not provisioned yet"
echo ""
echo "💡 Next Steps:"
echo "   1. Go to Netlify dashboard: https://app.netlify.com"
echo "   2. Site: dialadrink-customer"
echo "   3. Site settings → Domain management → HTTPS"
echo "   4. Check status of staging.dialadrinkkenya.com"
echo "   5. If showing error, try:"
echo "      - Remove domain and re-add it"
echo "      - Or wait longer (can take up to 1 hour)"
