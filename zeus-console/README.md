# Zeus Console

Super Admin Control Plane frontend for DeliveryOS Zeus.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

The console will run on **http://localhost:3003**

## Features

- **Super Admin Login**: Secure authentication
- **Dashboard**: Overview of partners, geofences, and system status
- **Partner Management**: Create, edit, suspend, and manage partners
- **Geofence Management**: Create and manage delivery boundaries
- **Usage & Monitoring**: Track partner usage metrics
- **Billing & Invoices**: Manage invoices and billing

## Environment Variables

- `REACT_APP_ZEUS_API_URL`: Backend API URL (defaults to localhost:5001/api/zeus/v1)

## Demo Credentials

After running the seed script, use:
- Email: `zeus@deliveryos.com`
- Password: `zeus123`

## Pages

- `/` - Dashboard
- `/partners` - Partner Management
- `/geofences` - Geofence Management
- `/usage` - Usage & Monitoring
- `/billing` - Billing & Invoices










