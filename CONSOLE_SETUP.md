# Frontend Consoles Setup Guide

Complete guide to setting up and running the Zeus and Valkyrie frontend consoles.

## Overview

There are three frontend applications:

1. **Admin Frontend** (port 3001) - Internal admin dashboard
2. **Valkyrie Console** (port 3002) - Partner-facing dashboard
3. **Zeus Console** (port 3003) - Super admin control plane

## Prerequisites

- Node.js and npm installed
- Backend server running on port 5001
- Valkyrie enabled (`ENABLE_VALKYRIE=true`)
- Zeus enabled (`ENABLE_ZEUS=true`)

## Setup Instructions

### 1. Valkyrie Console (Partner Dashboard)

```bash
cd valkyrie-console
npm install
npm start
```

Runs on **http://localhost:3002**

**Features:**
- Partner login (email/password or API key)
- Overview dashboard
- Order management
- Driver fleet management
- **Delivery Zones** (geofence management)
- Billing & usage

**Demo Credentials:**
- Email: `admin@demopartner.com`
- Password: `admin123`

### 2. Zeus Console (Super Admin)

```bash
cd zeus-console
npm install
npm start
```

Runs on **http://localhost:3003**

**Features:**
- Super admin login
- Dashboard with system overview
- Partner management (create, edit, suspend)
- Geofence management (Zeus authority)
- Usage & monitoring
- Billing & invoices

**Demo Credentials:**
- Email: `zeus@deliveryos.com`
- Password: `zeus123`

## Development

### Running All Consoles

You can run all three consoles simultaneously:

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```

**Terminal 2 - Admin Frontend:**
```bash
cd admin-frontend
npm start
```

**Terminal 3 - Valkyrie Console:**
```bash
cd valkyrie-console
npm start
```

**Terminal 4 - Zeus Console:**
```bash
cd zeus-console
npm start
```

## Environment Variables

### Valkyrie Console
- `REACT_APP_VALKYRIE_API_URL` - Backend API URL (optional, auto-detected)

### Zeus Console
- `REACT_APP_ZEUS_API_URL` - Backend API URL (optional, auto-detected)

Both consoles automatically detect localhost and use `http://localhost:5001/api` by default.

## Key Features

### Valkyrie Console - Delivery Zones

Partners can:
- View all delivery zones (Zeus and partner-managed)
- Create new delivery zones (validated against Zeus boundaries)
- Edit their own delivery zones
- Activate/deactivate zones
- Delete their own zones

**Restrictions:**
- Cannot edit or delete Zeus-managed zones
- Partner zones must be within Zeus boundaries
- Validation happens server-side

### Zeus Console - Geofence Management

Zeus admins can:
- Create authoritative geofences for any partner
- View all geofences (Zeus and partner)
- Edit any geofence
- Delete any geofence
- Override partner geofences

**Authority:**
- Zeus geofences are authoritative
- Partner geofences must validate against Zeus boundaries
- Zeus can override or disable partner geofences

## Production Deployment

### Build Commands

**Valkyrie Console:**
```bash
cd valkyrie-console
npm run build
# Deploy build/ directory
```

**Zeus Console:**
```bash
cd zeus-console
npm run build
# Deploy build/ directory
```

### Environment Variables (Production)

Set these in your hosting platform:

**Valkyrie Console:**
```
REACT_APP_VALKYRIE_API_URL=https://your-backend.com/api/valkyrie/v1
```

**Zeus Console:**
```
REACT_APP_ZEUS_API_URL=https://your-backend.com/api/zeus/v1
```

## Troubleshooting

### Console Won't Start

- Check Node.js version (requires Node 14+)
- Delete `node_modules` and `package-lock.json`, then `npm install`
- Check if port is already in use

### API Connection Issues

- Verify backend is running on port 5001
- Check `ENABLE_VALKYRIE=true` and `ENABLE_ZEUS=true` are set
- Check browser console for CORS errors
- Verify API URLs in network tab

### Authentication Fails

- Check backend logs for errors
- Verify JWT_SECRET is set
- Clear localStorage and try again
- Check token expiration

### Geofence Validation Errors

- Verify GeoJSON format is correct
- Check polygon is closed (first and last points match)
- Ensure coordinates are [longitude, latitude]
- Verify partner has Zeus geofences defined

## Next Steps

1. Add map visualization (Leaflet or Google Maps)
2. Add geofence drawing tools
3. Add usage charts and graphs
4. Add export functionality (CSV, PDF)
5. Add real-time updates (WebSocket)














