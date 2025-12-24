# Dial a Drink Kenya - Admin Dashboard

Separate admin frontend application for managing Dial a Drink Kenya operations.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

The admin app will run on **http://localhost:3001**

## Default Login Credentials

- **Username**: `admin`
- **Password**: `admin123`

**⚠️ IMPORTANT**: Change the default password in production!

## Features

- **Admin Authentication**: Secure login system
- **Dashboard**: Overview of orders, inventory, and statistics
- **Order Management**: View and manage customer orders
- **Inventory Management**: Add, edit, and manage drinks
- **Real-time Notifications**: Get notified when new orders arrive
- **Delivery Settings**: Configure delivery fees and test mode

## Routes

- `/login` - Admin login page
- `/dashboard` - Admin dashboard (requires authentication)
- `/orders` - Order management (requires authentication)
- `/inventory` - Inventory management (requires authentication)

## Environment Variables

### Local Development
The admin app automatically detects when running on `localhost` and uses `http://localhost:5001/api` by default. **No environment variables needed for local development.**

### Cloud Dev Deployment
For cloud-dev deployments (Cloud Run), set the following environment variable:
- `REACT_APP_API_URL` - Backend API URL (e.g., `https://dialadrink-backend-910510650031.us-central1.run.app/api`)

**Important**: The app prioritizes hostname detection, so:
- **Local**: Always uses `localhost:5001` regardless of `REACT_APP_API_URL`
- **Cloud Dev**: Uses `REACT_APP_API_URL` if set, otherwise falls back to production URL

This ensures local and cloud-dev work independently without conflicts.















