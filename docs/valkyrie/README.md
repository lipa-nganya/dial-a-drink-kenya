# Valkyrie Documentation

## Overview

Valkyrie is DeliveryOS's enterprise Partner API and Partner Console subsystem. It allows approved partners to securely access driver fulfillment, manage deliveries, and onboard drivers without exposing the global DeliveryOS platform.

## Features

- **Secure Multi-Tenant API**: Partner-scoped access with OAuth2/API key authentication
- **Order Management**: Create and track delivery orders
- **Driver Fulfillment**: Request drivers from DeliveryOS network or use partner-owned drivers
- **Partner Console**: Web dashboard for operational teams
- **Webhooks**: Real-time notifications for order and driver events
- **Role-Based Access Control**: Admin, Ops, Finance, and Read-only roles

## Quick Start

### 1. Enable Valkyrie

Set the feature flag in your environment:

```bash
ENABLE_VALKYRIE=true
```

### 2. Run Database Migration

```bash
cd backend
node -e "require('./migrations/add-valkyrie-tables').up(require('./models').sequelize.getQueryInterface(), require('sequelize'))"
```

### 3. Seed Demo Partner

```bash
cd backend
node scripts/seed-valkyrie-demo.js
```

This creates:
- A demo partner with API credentials
- Sample partner users (admin, ops, finance)
- Links existing drivers as partner-owned
- Marks some drivers as Valkyrie eligible

### 4. Start Services

**Backend:**
```bash
cd backend
npm start
```

**Valkyrie Console:**
```bash
cd valkyrie-console
npm install
npm start
```

Console runs on http://localhost:3002

## Architecture

### API Namespace
- Base path: `/api/valkyrie/v1`
- Service name: `valkyrie-service`

### Database Models
- `ValkyriePartner` - Partner accounts
- `ValkyriePartnerUser` - Partner user accounts
- `ValkyriePartnerDriver` - Partner-driver relationships
- `ValkyriePartnerOrder` - Partner-order relationships

### Security
- All requests validated against `partner_id`
- Partner-scoped queries enforced server-side
- Webhook signature verification
- Role-based access control

## API Documentation

See [API.md](./API.md) for complete API reference.

## Console Documentation

The Valkyrie Console is a React-based web dashboard. See `valkyrie-console/README.md` for setup instructions.

## Business Rules

1. **Partner Scoping**: All data is automatically scoped to the authenticated partner
2. **Driver Access**: 
   - Partners can fully manage their own drivers
   - DeliveryOS drivers are only visible if marked `valkyrie_eligible`
   - DeliveryOS driver details are limited (no full profile access)
3. **Order Ownership**: Partners can only view/manage orders they created
4. **No Cross-Partner Access**: Partners cannot see other partners' data

## Webhooks

Partners can configure webhook URLs to receive real-time notifications:
- `order.status.updated`
- `driver.assigned`
- `delivery.completed`

Webhooks are signed with HMAC-SHA256 for security.

## Roles & Permissions

- **Admin**: Full access to all partner features
- **Ops**: Orders and driver management
- **Finance**: Billing and usage data (read-only)
- **Read-only**: View access only

## Deployment

### Environment Variables

**Backend:**
- `ENABLE_VALKYRIE=true` - Enable Valkyrie API
- `JWT_SECRET` - JWT signing secret (required for production)

**Console:**
- `REACT_APP_VALKYRIE_API_URL` - Backend API URL (optional, auto-detected)

### Production Checklist

- [ ] Set `ENABLE_VALKYRIE=true`
- [ ] Set secure `JWT_SECRET`
- [ ] Run database migration
- [ ] Configure partner webhook URLs
- [ ] Set up SSL/TLS for console
- [ ] Configure CORS for partner domains
- [ ] Set up monitoring and logging

## Support

For issues or questions:
- API Issues: Check logs in `backend/server.log`
- Console Issues: Check browser console
- Database Issues: Verify migration ran successfully

## License

Proprietary - DeliveryOS Internal






