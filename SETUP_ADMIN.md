# Admin Frontend Setup Guide

The admin functionality has been separated into a completely independent frontend application running on port 3001.

## Quick Start

### 1. Install Admin Frontend Dependencies

```bash
cd admin-frontend
npm install
```

### 2. Start Admin Frontend

```bash
cd admin-frontend
npm start
```

The admin app will run on **http://localhost:3001**

### 3. Start Customer Frontend (separate)

```bash
cd frontend
npm start
```

The customer app runs on **http://localhost:3000**

### 4. Start Backend

```bash
cd backend
npm start
```

Backend runs on **http://localhost:5001**

## Default Admin Login

- **Username**: `admin`
- **Password**: `admin123`

⚠️ **IMPORTANT**: Change the default password in production!

## Admin Features

### Dashboard (`/dashboard`)
- Overview statistics
- Recent orders
- Quick actions
- Delivery settings management
- Hero image management
- Countdown timers

### Orders (`/orders`)
- View all customer orders
- Update order status
- Filter and search orders
- Real-time order notifications

### Inventory (`/inventory`)
- View all drinks
- Add new drinks
- Edit existing drinks
- Toggle availability
- Manage pricing and capacities

## Authentication

All admin routes (except `/login`) require authentication. The system uses JWT tokens stored in localStorage.

## File Structure

```
admin-frontend/
├── src/
│   ├── components/
│   │   ├── AdminHeader.js       # Admin navigation header
│   │   ├── PrivateRoute.js      # Route protection
│   │   ├── EditDrinkDialog.js   # Drink editing dialog
│   │   └── CapacityPricingCombined.js
│   ├── pages/
│   │   ├── Login.js             # Admin login page
│   │   ├── AdminOverview.js     # Dashboard
│   │   ├── Orders.js            # Orders management
│   │   └── Inventory.js        # Inventory management
│   ├── contexts/
│   │   └── AdminContext.js      # Admin state management
│   ├── services/
│   │   └── api.js               # API client
│   └── App.js                   # Main app component
└── package.json
```

## Backend Authentication

The backend has been updated with:
- Admin model and table
- JWT-based authentication
- Protected admin routes
- Default admin user creation on startup

## Ports

- **Customer Frontend**: 3000
- **Admin Frontend**: 3001
- **Backend**: 5001

## Removing Admin from Customer App

The customer frontend (`frontend/`) has been cleaned:
- Removed admin routes
- Removed admin navigation links
- Removed AdminProvider dependency

















