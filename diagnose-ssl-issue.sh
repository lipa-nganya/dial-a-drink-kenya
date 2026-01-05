#!/bin/bash

echo "🔍 Diagnosing SSL Certificate Issue"
echo "===================================="
echo ""

echo "1. DNS Configuration:"
DNS_TARGET=$(dig @1.1.1.1 staging.dialadrinkkenya.com CNAME +short 2>/dev/null | sed 's/\.$//')
echo "   CNAME Target: $DNS_TARGET"

if [ "$DNS_TARGET" = "dialadrink-customer.netlify.app" ]; then
    echo "   ✅ DNS is correctly pointing to Netlify"
else
    echo "   ❌ DNS is pointing to wrong target: $DNS_TARGET"
    echo "   Should be: dialadrink-customer.netlify.app"
fi

echo ""
echo "2. DNS Resolution:"
IP=$(dig staging.dialadrinkkenya.com +short | head -1)
echo "   Resolves to IP: $IP"
NETLIFY_IP=$(dig dialadrink-customer.netlify.app +short | head -1)
echo "   Netlify IP: $NETLIFY_IP"

if [ "$IP" = "$NETLIFY_IP" ]; then
    echo "   ✅ IP matches Netlify"
else
    echo "   ⚠️  IP doesn't match Netlify (may be cached)"
fi

echo ""
echo "3. SSL Certificate:"
SSL_OUTPUT=$(timeout 5 openssl s_client -connect staging.dialadrinkkenya.com:443 -servername staging.dialadrinkkenya.com 2>&1)
CERT_CN=$(echo "$SSL_OUTPUT" | grep "subject=" | grep -o "CN=[^,]*" | cut -d= -f2)
CERT_SAN=$(echo "$SSL_OUTPUT" | grep -A 1 "subjectAltName" | tail -1)

echo "   Certificate CN: $CERT_CN"
if echo "$SSL_OUTPUT" | grep -q "subjectAltName does not match"; then
    echo "   ❌ Certificate doesn't match domain name"
    echo "   This means Netlify hasn't provisioned SSL for staging.dialadrinkkenya.com yet"
else
    echo "   ✅ Certificate matches domain"
fi

echo ""
echo "4. Netlify Domain Status:"
if netlify status &>/dev/null; then
    DOMAIN_IN_NETLIFY=$(netlify sites:list --json 2>/dev/null | grep -o "staging.dialadrinkkenya.com" || echo "")
    if [ -n "$DOMAIN_IN_NETLIFY" ]; then
        echo "   ✅ Domain is in Netlify"
        echo "   ⚠️  SSL certificate provisioning may still be in progress"
        echo "   Check Netlify dashboard: Site settings → Domain management → HTTPS"
    else
        echo "   ❌ Domain not found in Netlify"
    fi
else
    echo "   ⚠️  Cannot check Netlify status (CLI not configured)"
fi

echo ""
echo "📋 Problem Identified:"
echo "   Netlify is serving a wildcard certificate (*.netlify.app)"
echo "   but hasn't provisioned a certificate for staging.dialadrinkkenya.com yet"
echo ""
echo "💡 Solution:"
echo "   1. Verify domain is in Netlify: Site settings → Domain management"
echo "   2. Check SSL status: Should show 'Certificate provisioning' or 'Certificate active'"
echo "   3. Wait 5-15 minutes for SSL provisioning (after DNS propagation)"
echo "   4. If still not working after 30 minutes, check Netlify dashboard for errors"
