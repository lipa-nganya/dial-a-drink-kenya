#!/bin/bash

echo "🔍 Verifying staging.dialadrinkkenya.com Setup"
echo "================================================"
echo ""

# Check Netlify (via CLI)
echo "1. Netlify Configuration:"
if netlify status &>/dev/null; then
    echo "   ✅ Netlify CLI is configured"
    DOMAIN_CHECK=$(netlify sites:list --json 2>/dev/null | grep -o "staging.dialadrinkkenya.com" || echo "")
    if [ -n "$DOMAIN_CHECK" ]; then
        echo "   ✅ Domain 'staging.dialadrinkkenya.com' is in Netlify"
    else
        echo "   ⚠️  Domain not found in Netlify - needs to be added"
        echo "      Location: Site settings → Domain management → Add custom domain"
    fi
else
    echo "   ⚠️  Netlify CLI not configured"
fi

echo ""
echo "2. DNS Configuration:"
DNS_TARGET=$(dig @1.1.1.1 staging.dialadrinkkenya.com CNAME +short 2>/dev/null | head -1 | sed 's/\.$//')
if [ "$DNS_TARGET" = "dialadrink-customer.netlify.app" ]; then
    echo "   ✅ DNS is correctly configured"
    echo "      Target: $DNS_TARGET"
elif [ -n "$DNS_TARGET" ]; then
    echo "   ❌ DNS is pointing to wrong target: $DNS_TARGET"
    echo "      Should be: dialadrink-customer.netlify.app"
    echo "      Location: HostAfrica → Domain → Manage DNS → dialadrinkkenya.com"
else
    echo "   ⚠️  DNS record not found"
    echo "      Location: HostAfrica → Domain → Manage DNS → dialadrinkkenya.com"
fi

echo ""
echo "3. SSL Certificate:"
SSL_CHECK=$(timeout 3 openssl s_client -connect staging.dialadrinkkenya.com:443 -servername staging.dialadrinkkenya.com 2>/dev/null | grep -o "subject=.*" | head -1)
if [ -n "$SSL_CHECK" ]; then
    echo "   ✅ SSL certificate is active"
    echo "      $SSL_CHECK"
else
    echo "   ⏳ SSL certificate not yet provisioned"
    echo "      This is normal - takes 5-15 minutes after DNS propagation"
fi

echo ""
echo "📋 Setup Checklist:"
echo "   [ ] Netlify: Site settings → Domain management → staging.dialadrinkkenya.com"
echo "   [ ] HostAfrica: Domain → Manage DNS → CNAME record (staging → dialadrink-customer.netlify.app)"
echo "   [ ] DNS propagated (check with: dig staging.dialadrinkkenya.com CNAME +short)"
echo "   [ ] SSL certificate active (check in Netlify dashboard)"
echo ""
