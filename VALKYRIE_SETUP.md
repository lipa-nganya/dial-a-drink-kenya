# Valkyrie Setup Guide

Complete guide to setting up and using the Valkyrie Partner API and Console.

## Prerequisites

- Node.js and npm installed
- PostgreSQL database configured
- Backend server running

## Step 1: Enable Valkyrie Feature

Set the environment variable:

```bash
export ENABLE_VALKYRIE=true
```

Or add to your `.env` file:
```
ENABLE_VALKYRIE=true
```

## Step 2: Run Database Migration

The migration creates all necessary tables:

```bash
cd backend
node -e "
const db = require('./models');
const migration = require('./migrations/add-valkyrie-tables');
migration.up(db.sequelize.getQueryInterface(), require('sequelize'))
  .then(() => {
    console.log('✅ Migration completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
"
```

Or use Sequelize CLI if configured:
```bash
npx sequelize-cli db:migrate --migrations-path backend/migrations --name add-valkyrie-tables
```

## Step 3: Seed Demo Partner

Create a demo partner with sample data:

```bash
cd backend
node scripts/seed-valkyrie-demo.js
```

This will output:
- Partner ID and name
- API Key and Secret
- Demo user credentials

**Save the API key** - you'll need it for API authentication.

## Step 4: Start Backend Server

```bash
cd backend
npm start
```

The Valkyrie API will be available at `/api/valkyrie/v1` when `ENABLE_VALKYRIE=true`.

## Step 5: Start Valkyrie Console (Optional)

```bash
cd valkyrie-console
npm install
npm start
```

Console runs on http://localhost:3002

## Testing the API

### 1. Authenticate with API Key

```bash
curl -X POST http://localhost:5001/api/valkyrie/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "YOUR_API_KEY_HERE"}'
```

### 2. Create an Order

```bash
curl -X POST http://localhost:5001/api/valkyrie/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "customerName": "John Doe",
    "customerPhone": "254712345678",
    "deliveryAddress": "123 Main St, Nairobi",
    "items": [{"drinkId": 1, "quantity": 2, "price": 500}],
    "totalAmount": 1000
  }'
```

### 3. List Orders

```bash
curl http://localhost:5001/api/valkyrie/v1/orders \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 4. Request Driver

```bash
curl -X POST http://localhost:5001/api/valkyrie/v1/orders/123/request-driver \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Using the Console

1. Navigate to http://localhost:3002
2. Login with demo credentials:
   - Email: `admin@demopartner.com`
   - Password: `admin123`
3. Or use API key authentication

## Webhook Configuration

To receive webhooks, update the partner's webhook URL:

```sql
UPDATE valkyrie_partners 
SET webhook_url = 'https://your-server.com/webhooks/valkyrie',
    webhook_secret = 'your-secret-here'
WHERE id = 1;
```

Webhooks will be sent for:
- `order.status.updated` - When order status changes
- `driver.assigned` - When a driver is assigned
- `delivery.completed` - When delivery is completed

## Production Deployment

### Backend

1. Set `ENABLE_VALKYRIE=true` in production environment
2. Set secure `JWT_SECRET` for token signing
3. Run migration on production database
4. Configure CORS for partner domains
5. Set up webhook endpoints

### Console

1. Build the console:
   ```bash
   cd valkyrie-console
   npm run build
   ```

2. Deploy to hosting (Netlify, Vercel, etc.)

3. Set environment variable:
   ```
   REACT_APP_VALKYRIE_API_URL=https://your-backend.com/api/valkyrie/v1
   ```

## Troubleshooting

### API Not Available

- Check `ENABLE_VALKYRIE=true` is set
- Restart backend server
- Check logs for errors

### Authentication Fails

- Verify API key is correct
- Check partner status is 'active'
- Verify JWT_SECRET is set (for JWT auth)

### Webhooks Not Received

- Verify webhook URL is configured
- Check webhook URL is publicly accessible
- Verify signature using webhook secret
- Check backend logs for webhook delivery errors

### Database Errors

- Ensure migration ran successfully
- Check database connection
- Verify all tables exist:
  - `valkyrie_partners`
  - `valkyrie_partner_users`
  - `valkyrie_partner_drivers`
  - `valkyrie_partner_orders`

## Next Steps

1. Create production partners via admin interface
2. Configure webhook endpoints
3. Integrate partner systems with API
4. Set up monitoring and alerts
5. Review security settings

## Support

For issues or questions, check:
- API Documentation: `docs/valkyrie/API.md`
- Console README: `valkyrie-console/README.md`
- Backend logs: `backend/server.log`






