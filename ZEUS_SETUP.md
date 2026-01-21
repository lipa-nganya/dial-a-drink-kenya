# Zeus Setup Guide

Complete guide to setting up and using the Zeus Super Admin Control Plane.

## Prerequisites

- Node.js and npm installed
- PostgreSQL database configured
- Backend server running
- Valkyrie enabled (optional but recommended)

## Step 1: Enable Zeus Feature

Set the environment variable:

```bash
export ENABLE_ZEUS=true
```

Or add to your `.env` file:
```
ENABLE_ZEUS=true
```

## Step 2: Run Database Migration

The migration creates all necessary tables and extends ValkyriePartner:

```bash
cd backend
node -e "
const db = require('./models');
const migration = require('./migrations/add-zeus-tables');
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

## Step 3: Seed Demo Data

Create a demo Zeus admin and sample geofence:

```bash
cd backend
node scripts/seed-zeus-demo.js
```

This will output:
- Zeus admin credentials
- Demo partner (if none exists)
- Sample geofence for Nairobi

## Step 4: Start Backend Server

```bash
cd backend
npm start
```

The Zeus API will be available at `/api/zeus/v1` when `ENABLE_ZEUS=true`.

## Testing the API

### 1. Authenticate

```bash
curl -X POST http://localhost:5001/api/zeus/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "email": "zeus@deliveryos.com",
    "password": "zeus123"
  }'
```

### 2. List Partners

```bash
curl http://localhost:5001/api/zeus/v1/partners \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 3. Create Geofence

```bash
curl -X POST http://localhost:5001/api/zeus/v1/geofences \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "partnerId": 1,
    "name": "Nairobi Central",
    "geometry": {
      "type": "Polygon",
      "coordinates": [[
        [36.7, -1.4],
        [36.9, -1.4],
        [36.9, -1.2],
        [36.7, -1.2],
        [36.7, -1.4]
      ]]
    }
  }'
```

### 4. Get Usage Statistics

```bash
curl http://localhost:5001/api/zeus/v1/usage/1 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Geofence Enforcement

Once Zeus is enabled and geofences are created:

1. **Zeus geofences** are authoritative boundaries
2. **Partner geofences** must be within Zeus boundaries
3. **Order creation** is validated against active geofences
4. Orders outside geofences are **rejected**

## Geofence Format

Geofences use GeoJSON format:

```json
{
  "type": "Polygon",
  "coordinates": [[
    [longitude1, latitude1],
    [longitude2, latitude2],
    [longitude3, latitude3],
    [longitude4, latitude4],
    [longitude1, latitude1]  // Must close the polygon
  ]]
}
```

Or MultiPolygon for multiple areas:

```json
{
  "type": "MultiPolygon",
  "coordinates": [[[
    [lon1, lat1],
    [lon2, lat2],
    [lon3, lat3],
    [lon1, lat1]
  ]]]
}
```

## Usage Tracking

Usage is automatically tracked for:
- **Orders**: Each order creation
- **API Calls**: Each API request
- **Distance (km)**: Tracked when available
- **Drivers**: Driver assignments

View usage via:
```bash
GET /api/zeus/v1/usage/:partnerId?period=monthly
```

## Billing & Invoices

### Create Invoice

```bash
curl -X POST http://localhost:5001/api/zeus/v1/invoices \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "partnerId": 1,
    "period": "2024-01",
    "amount": 5000.00,
    "dueDate": "2024-02-01"
  }'
```

### Update Invoice Status

```bash
curl -X PATCH http://localhost:5001/api/zeus/v1/invoices/1 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "issued"
  }'
```

## Partner Management

### Suspend Partner

```bash
curl -X PATCH http://localhost:5001/api/zeus/v1/partners/1 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "suspended"
  }'
```

### Set API Rate Limit

```bash
curl -X PATCH http://localhost:5001/api/zeus/v1/partners/1 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "apiRateLimit": 5000
  }'
```

## Production Deployment

### Environment Variables

**Backend:**
- `ENABLE_ZEUS=true` - Enable Zeus API
- `JWT_SECRET` - JWT signing secret (required for production)

### Checklist

- [ ] Set `ENABLE_ZEUS=true`
- [ ] Set secure `JWT_SECRET`
- [ ] Run database migration
- [ ] Create Zeus admin accounts
- [ ] Define geofences for all partners
- [ ] Set API rate limits
- [ ] Configure usage tracking
- [ ] Set up billing workflows

## Troubleshooting

### API Not Available

- Check `ENABLE_ZEUS=true` is set
- Restart backend server
- Check logs for errors

### Geofence Validation Fails

- Verify GeoJSON format is correct
- Check polygon is closed (first and last points match)
- Ensure coordinates are [longitude, latitude] not [latitude, longitude]
- Check coordinates are within valid ranges (-180 to 180 for lon, -90 to 90 for lat)

### Authentication Fails

- Verify email and password are correct
- Check Zeus admin status is 'active'
- Verify JWT_SECRET is set

## Next Steps

1. Create Zeus Console frontend
2. Add map visualization for geofences
3. Add usage dashboards
4. Integrate geocoding service for address parsing
5. Automate invoice generation

## Support

For issues or questions:
- Check backend logs: `backend/server.log`
- Review API documentation: `docs/zeus/API.md` (to be created)
- Verify database migration completed successfully
















