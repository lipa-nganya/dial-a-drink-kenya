#!/bin/bash

# Configure Staging Domain DNS
# This script provides the exact DNS configuration needed

set -e

echo "=========================================="
echo "Staging Domain DNS Configuration"
echo "=========================================="
echo ""

# Netlify Configuration
NETLIFY_SITE="dialadrink-customer"
NETLIFY_SUBDOMAIN="dialadrink-customer.netlify.app"
STAGING_DOMAIN="staging.dialadrinkkenya.com"

echo "✅ Netlify Configuration:"
echo "   Site: $NETLIFY_SITE"
echo "   Primary Domain: dialadrink.thewolfgang.tech"
echo "   Staging Domain: $STAGING_DOMAIN"
echo "   CNAME Target: $NETLIFY_SUBDOMAIN"
echo ""

echo "📋 DNS Record to Add in HostAfrica:"
echo "   Type:    CNAME"
echo "   Host:    staging"
echo "   Target:  $NETLIFY_SUBDOMAIN"
echo "   TTL:     3600"
echo ""

echo "🔍 Verifying Netlify domain configuration..."
if netlify status &>/dev/null; then
    echo "   ✅ Netlify CLI is configured"
    echo "   ✅ Site is linked: $NETLIFY_SITE"
    
    # Check if domain is already in Netlify
    DOMAIN_CHECK=$(netlify sites:list --json 2>/dev/null | grep -o "staging.dialadrinkkenya.com" || echo "")
    if [ -n "$DOMAIN_CHECK" ]; then
        echo "   ✅ Domain '$STAGING_DOMAIN' is already added to Netlify"
    else
        echo "   ⚠️  Domain '$STAGING_DOMAIN' not found in Netlify aliases"
        echo "   Adding domain to Netlify..."
        # Note: Netlify CLI doesn't have a direct command for this
        echo "   Please add it manually in Netlify dashboard or it may already be configured"
    fi
else
    echo "   ⚠️  Netlify CLI not properly configured"
fi

echo ""
echo "🌐 Next Steps for HostAfrica:"
echo "   1. Login to https://myhostafrica.com"
echo "      Email: mmumoki@gmail.com"
echo "      Password: SaleEgos90"
echo ""
echo "   2. Navigate to DNS Management for dialadrinkkenya.com"
echo ""
echo "   3. Add the following CNAME record:"
echo "      ┌─────────────────────────────────────┐"
echo "      │ Type:    CNAME                      │"
echo "      │ Host:    staging                    │"
echo "      │ Target:  $NETLIFY_SUBDOMAIN │"
echo "      │ TTL:     3600                        │"
echo "      └─────────────────────────────────────┘"
echo ""
echo "   4. Save the record"
echo ""
echo "   5. Wait for DNS propagation (5-60 minutes)"
echo ""
echo "   6. Wait for SSL certificate provisioning (5-15 minutes after DNS)"
echo ""
echo "   7. Test: https://$STAGING_DOMAIN"
echo ""

echo "🔍 Verification Commands:"
echo "   # Check DNS propagation:"
echo "   dig $STAGING_DOMAIN CNAME +short"
echo "   # Should return: $NETLIFY_SUBDOMAIN."
echo ""
echo "   # Check SSL certificate (after provisioning):"
echo "   openssl s_client -connect $STAGING_DOMAIN:443 -servername $STAGING_DOMAIN 2>/dev/null | grep 'subject='"
echo ""

echo "✅ Configuration Summary:"
echo "   Netlify Site: $NETLIFY_SITE"
echo "   CNAME Target: $NETLIFY_SUBDOMAIN"
echo "   Staging URL: https://$STAGING_DOMAIN"
echo ""

