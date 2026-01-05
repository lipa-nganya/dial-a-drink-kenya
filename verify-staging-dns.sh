#!/bin/bash

# Verify Staging DNS Configuration

STAGING_DOMAIN="staging.dialadrinkkenya.com"
CORRECT_TARGET="dialadrink-customer.netlify.app"

echo "🔍 Checking DNS configuration for $STAGING_DOMAIN"
echo ""

CURRENT_TARGET=$(dig $STAGING_DOMAIN CNAME +short 2>/dev/null | head -1 | sed 's/\.$//')

if [ -z "$CURRENT_TARGET" ]; then
    echo "❌ DNS record not found or not propagated yet"
    echo "   Run this script again in a few minutes"
    exit 1
fi

echo "Current DNS Target: $CURRENT_TARGET"
echo "Expected Target:    $CORRECT_TARGET"
echo ""

if [ "$CURRENT_TARGET" = "$CORRECT_TARGET" ]; then
    echo "✅ DNS is configured correctly!"
    echo ""
    echo "Checking SSL certificate..."
    SSL_CHECK=$(openssl s_client -connect $STAGING_DOMAIN:443 -servername $STAGING_DOMAIN 2>/dev/null | grep -o "subject=.*" | head -1)
    
    if [ -n "$SSL_CHECK" ]; then
        echo "✅ SSL certificate found: $SSL_CHECK"
        echo ""
        echo "🌐 Test your site: https://$STAGING_DOMAIN"
    else
        echo "⏳ SSL certificate is still provisioning..."
        echo "   Wait 5-15 minutes and check again"
    fi
else
    echo "❌ DNS is pointing to the wrong target!"
    echo ""
    echo "Current:  $CURRENT_TARGET"
    echo "Should be: $CORRECT_TARGET"
    echo ""
    echo "📋 Action Required:"
    echo "   1. Login to HostAfrica: https://myhostafrica.com"
    echo "   2. Edit the CNAME record for 'staging'"
    echo "   3. Change target to: $CORRECT_TARGET"
    echo "   4. Save and wait for propagation"
    echo ""
    echo "See HOSTAFRICA_DNS_FIX.md for detailed instructions"
    exit 1
fi
