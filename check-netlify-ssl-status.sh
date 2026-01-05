#!/bin/bash

echo "🔍 Netlify SSL Status Check via CLI"
echo "===================================="
echo ""

SITE_ID="c3dc4179-bbfc-472f-9c77-0996792fc234"
STAGING_DOMAIN="staging.dialadrinkkenya.com"

echo "1. Site Information:"
SITE_INFO=$(netlify api getSite --data "{\"site_id\":\"$SITE_ID\"}" 2>/dev/null)
echo "$SITE_INFO" | jq -r '{name, custom_domain, domain_aliases, ssl, ssl_url, ssl_status}' 2>/dev/null || echo "$SITE_INFO" | grep -E "(name|custom_domain|domain_aliases|ssl|ssl_url|ssl_status)" | head -10

echo ""
echo "2. Domain Aliases:"
echo "$SITE_INFO" | jq -r '.domain_aliases[]' 2>/dev/null || echo "$SITE_INFO" | grep "staging.dialadrinkkenya.com"

echo ""
echo "3. SSL Status:"
SSL_STATUS=$(echo "$SITE_INFO" | jq -r '.ssl_status' 2>/dev/null)
SSL_ENABLED=$(echo "$SITE_INFO" | jq -r '.ssl' 2>/dev/null)

if [ "$SSL_ENABLED" = "true" ]; then
    echo "   ✅ SSL is enabled for the site"
else
    echo "   ❌ SSL is not enabled"
fi

if [ "$SSL_STATUS" = "null" ] || [ -z "$SSL_STATUS" ]; then
    echo "   ⚠️  SSL status is null - may still be provisioning"
    echo "   Check individual domain SSL status in Netlify dashboard"
else
    echo "   SSL Status: $SSL_STATUS"
fi

echo ""
echo "4. Current Configuration:"
echo "   Primary Domain: dialadrink.thewolfgang.tech"
echo "   Staging Domain: $STAGING_DOMAIN"
echo "   SSL URL: https://dialadrink.thewolfgang.tech"

echo ""
echo "📋 Note:"
echo "   Netlify CLI doesn't show per-domain SSL status"
echo "   You need to check the dashboard for staging.dialadrinkkenya.com SSL status:"
echo "   https://app.netlify.com/projects/dialadrink-customer/configuration/domains"
echo ""
echo "💡 The SSL certificate for staging.dialadrinkkenya.com may still be provisioning"
echo "   even though DNS shows a green checkmark"
