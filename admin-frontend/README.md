# Dial A Drink - Admin Dashboard

Separate admin frontend application for managing Dial A Drink operations.

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

- `REACT_APP_API_URL` - Backend API URL (default: http://localhost:5001/api)






