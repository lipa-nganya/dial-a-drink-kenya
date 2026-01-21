# Dial a Drink Kenya - Complete Ecosystem Documentation

## Overview

Dial a Drink Kenya is a comprehensive beverage delivery platform ecosystem consisting of three integrated applications:

1. **Customer Site** - Web application for customers to browse, order, and track deliveries
2. **Driver App** - Native Android application (Kotlin) for drivers to manage deliveries and earnings
3. **Admin Dashboard** - Web application for administrators to manage orders, inventory, drivers, and financials

All three platforms connect to a unified backend API hosted on Google Cloud Run, with data stored in Google Cloud SQL (PostgreSQL).

---

## Architecture

### System Components

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Customer Site  │     │   Driver App    │     │  Admin Dashboard│
│   (React SPA)   │     │  (Android/Kotlin) │     │   (React SPA)   │
│   Port: 3000    │     │   (Native APK)    │     │   Port: 3001    │
└────────┬────────┘     └────────┬─────────┘     └────────┬────────┘
         │                      │                         │
         │                      │                         │
         └──────────────────────┼─────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   Backend API         │
                    │   (Node.js/Express)   │
                    │   Cloud Run           │
                    │   Port: 8080          │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   PostgreSQL Database │
                    │   Cloud SQL           │
                    └───────────────────────┘
```

### Technology Stack

**Backend:**
- Node.js with Express.js
- Sequelize ORM
- PostgreSQL (Cloud SQL)
- Socket.IO for real-time updates
- M-Pesa API integration
- Google Maps API for delivery calculations

**Frontend (Customer & Admin):**
- React.js
- Material-UI
- Axios for API calls
- Socket.IO client for real-time updates

**Driver App:**
- Native Android (Kotlin)
- Android Studio for builds
- APK distribution
- Socket.IO client for real-time updates

**Infrastructure:**
- Google Cloud Platform (GCP)
- Cloud Run for backend and frontend hosting
- Cloud SQL for database
- Cloud Build for container builds
- Android APK for mobile app distribution

---

## Core Features

### 1. Order Management

**Order Flow:**
1. Customer browses drinks and adds to cart
2. Customer selects delivery address and payment method
3. Order is created with status `pending`
4. Admin confirms order → status `confirmed`
5. Admin marks as preparing → status `preparing`
6. Driver assigned → status `out_for_delivery`
7. Driver marks as delivered → status `delivered`
8. Payment confirmed → status `completed`

**Payment Methods:**
- **Pay Now**: M-Pesa STK Push (immediate payment)
- **Pay on Delivery**: M-Pesa STK Push or Cash/Mobile Money (payment on delivery)

### 2. Transaction Management

The system creates and manages multiple transaction types for each order:

#### Transaction Types

1. **Order Payment** (`transactionType: 'payment'`)
   - Represents customer payment for order items
   - Amount: Items total only (excludes delivery fee and tip)
   - Created when M-Pesa callback is received
   - Credited to merchant wallet when order is completed

2. **Delivery Fee Payment (Merchant)** (`transactionType: 'delivery_pay'`, `driverId: null`)
   - Merchant's share of delivery fee
   - Amount: Delivery fee - Driver pay amount
   - Credited to merchant wallet when order is completed

3. **Delivery Fee Payment (Driver)** (`transactionType: 'delivery_pay'`, `driverId: <id>`)
   - Driver's share of delivery fee (if enabled)
   - Amount: Configured driver pay per delivery
   - Credited to driver wallet when order is completed
   - **Note**: Skipped for cash/mobile money payments (driver already has cash)

4. **Tip** (`transactionType: 'tip'`)
   - Customer tip for driver
   - Amount: From order `tipAmount` field
   - Credited to driver wallet when order is completed
   - **Note**: Skipped for cash/mobile money payments (driver already has cash)

#### Transaction Creation Flow

See [TRANSACTION_CREATION_FLOW.md](./TRANSACTION_CREATION_FLOW.md) for detailed documentation.

**Key Principles:**
- All wallet crediting happens in `creditWalletsOnDeliveryCompletion()` when order status is `completed`
- Duplicate prevention using database locks and in-memory locks
- Cash/mobile money payments skip driver wallet crediting (driver already has cash)
- Transactions are created/updated atomically within database transactions

### 3. Wallet Management

#### Merchant Wallet (`AdminWallet`)
- **Credited with:**
  - Order payment (items total)
  - Delivery fee (merchant share)
- **Updated when:** Order status becomes `completed` and payment is `paid`
- **Fields:**
  - `balance`: Current available balance
  - `totalRevenue`: Total revenue accumulated
  - `totalOrders`: Total number of completed orders

#### Driver Wallet (`DriverWallet`)
- **Credited with:**
  - Delivery fee (driver share) - only for M-Pesa payments
  - Tips - only for M-Pesa payments
- **Updated when:** Order status becomes `completed` and payment is `paid`
- **Fields:**
  - `balance`: Current available balance
  - `totalDeliveryPay`: Total delivery fees received
  - `totalDeliveryPayCount`: Number of deliveries paid
  - `totalTipsReceived`: Total tips received
  - `totalTipsCount`: Number of tips received

**Important:** For cash/mobile money payments, driver wallets are **NOT** credited because the driver already received the cash/mobile money directly from the customer.

### 4. Real-Time Updates

All platforms use Socket.IO for real-time updates:

- **Order Status Changes**: All platforms notified when order status updates
- **Payment Confirmations**: Real-time payment status updates
- **Driver Assignments**: Drivers notified when assigned to orders
- **Wallet Updates**: Drivers notified when wallet is credited

### 5. Delivery Fee Calculation

Delivery fees are calculated based on:
- **Order Type**: With alcohol vs. without alcohol
- **Distance**: Calculated using Google Maps API
- **Settings**: Configurable in Admin Dashboard

**Delivery Fee Split:**
- If "Pay Driver Per Delivery" is enabled:
  - Driver receives configured amount (or delivery fee, whichever is less)
  - Merchant receives: Delivery fee - Driver pay amount
- If disabled:
  - Merchant receives full delivery fee
  - Driver receives nothing

### 6. Payment Integration

#### M-Pesa Integration

**Supported Operations:**
- STK Push (Lipa na M-Pesa)
- B2C (Business to Customer) - for driver payouts (future)

**Environments:**
- Sandbox: For testing
- Production: For live payments

**Configuration:**
- Consumer Key and Secret
- Shortcode
- Passkey
- Callback URL (automatically set to Cloud Run backend URL)

#### PesaPal Integration (Card Payments)

**Supported Operations:**
- Card payments via PesaPal gateway
- IPN (Instant Payment Notification) callbacks

**Environments:**
- Sandbox: For testing (`https://cybqa.pesapal.com/pesapalv3`)
- Live: For production (`https://pay.pesapal.com/v3`)

**Configuration:**
- `PESAPAL_CONSUMER_KEY`: PesaPal API consumer key
- `PESAPAL_CONSUMER_SECRET`: PesaPal API consumer secret
- `PESAPAL_ENVIRONMENT`: `sandbox` or `live` (default: `sandbox`)
- `PESAPAL_IPN_CALLBACK_URL`: IPN callback URL (optional, auto-detected)
- `PESAPAL_REDIRECT_URL`: Redirect URL for payment success/cancellation (optional, auto-detected)

---

## Platform-Specific Details

### Customer Site (`frontend/`)

**Purpose:** Allow customers to browse drinks, place orders, and track deliveries

**Key Features:**
- Product browsing and search
- Shopping cart management
- Address selection and delivery fee calculation
- Payment initiation (M-Pesa STK Push)
- Order tracking
- Order history

**Deployment:**
- Hosted on Cloud Run as `deliveryos-customer`
- URL: `https://deliveryos-customer-910510650031.us-central1.run.app`

### Driver App (`driver-app-native/`)

**Purpose:** Enable drivers to view assigned orders, update delivery status, confirm payments, and track earnings

**Key Features:**
- Order list (assigned orders)
- Order details with navigation (Google Maps integration)
- Status updates (On the Way, Delivered)
- Payment confirmation (M-Pesa or Cash/Mobile Money)
- Wallet balance and transaction history
- Push notifications for new orders and wallet credits
- Shift status management (On Shift/Off Shift)

**Build:**
- Native Android app built with Kotlin
- Package ID: `com.dialadrink.driver`
- Built using Android Studio/Gradle
- APK distribution

**Deployment:**
- Built via Android Studio or Gradle
- APK distributed directly to drivers

### Admin Dashboard (`admin-frontend/`)

**Purpose:** Comprehensive management interface for administrators

**Key Features:**
- **Dashboard**: Overview of orders, revenue, drivers
- **Orders Management**: View, filter, update order status and payment status
- **Inventory Management**: Add, edit, delete drinks and categories
- **Driver Management**: Add drivers, assign orders, view driver wallets
- **Transactions**: View all transactions with filtering and search
- **Settings**: Configure delivery fees, driver pay, M-Pesa settings
- **Financial Reports**: Revenue tracking, wallet balances

**Deployment:**
- Hosted on Cloud Run as `deliveryos-admin`
- URL: `https://deliveryos-admin-910510650031.us-central1.run.app`

---

## Database Schema

### Core Tables

**Orders:**
- Order details (customer info, delivery address, items)
- Status tracking (`pending`, `confirmed`, `preparing`, `out_for_delivery`, `delivered`, `completed`)
- Payment tracking (`unpaid`, `pending`, `paid`)
- Financial fields (`totalAmount`, `deliveryFee`, `tipAmount`, `driverPayAmount`)

**Transactions:**
- All financial transactions
- Types: `payment`, `delivery_pay`, `tip`, `cash_settlement`
- Links to orders, drivers, wallets
- Status tracking (`pending`, `completed`, `cancelled`)

**Wallets:**
- `AdminWallet`: Merchant wallet (single record)
- `DriverWallet`: Driver wallets (one per driver)

**Drivers:**
- Driver information
- Phone number (used for authentication)
- Push notification tokens
- Wallet relationship

**Drinks:**
- Product catalog
- Categories, subcategories
- Pricing (including capacity-based pricing)
- Inventory tracking

---

## API Structure

### Authentication

- **Admin**: JWT tokens stored in localStorage
- **Driver**: Phone number-based authentication
- **Customer**: Session-based (no authentication required for browsing)

### Key Endpoints

**Orders:**
- `GET /api/orders` - List orders (with filters)
- `GET /api/orders/:id` - Get order details
- `PATCH /api/orders/:id` - Update order status
- `POST /api/orders` - Create new order

**Transactions:**
- `GET /api/transactions` - List transactions (with filters)
- `GET /api/transactions/:id` - Get transaction details

**M-Pesa:**
- `POST /api/mpesa/stk-push` - Initiate STK Push
- `POST /api/mpesa/callback` - M-Pesa callback handler

**PesaPal (Card Payments):**
- `POST /api/pesapal/initiate-payment` - Initiate card payment (returns redirect URL)
- `GET /api/pesapal/ipn` - PesaPal IPN callback handler
- `GET /api/pesapal/transaction-status/:orderId` - Get payment status for an order

**Drivers:**
- `GET /api/drivers` - List drivers
- `GET /api/drivers/phone/:phone` - Get driver by phone
- `GET /api/drivers/:id/wallet` - Get driver wallet

**Wallets:**
- `GET /api/admin/wallet` - Get merchant wallet
- `GET /api/drivers/:id/wallet` - Get driver wallet

---

## Environment Configuration

### Backend Environment Variables

**Database:**
- `DATABASE_URL`: PostgreSQL connection string

**M-Pesa:**
- `MPESA_CONSUMER_KEY`: M-Pesa API consumer key
- `MPESA_CONSUMER_SECRET`: M-Pesa API consumer secret
- `MPESA_SHORTCODE`: M-Pesa shortcode
- `MPESA_PASSKEY`: M-Pesa passkey
- `MPESA_ENVIRONMENT`: `sandbox` or `production`

**PesaPal (Card Payments):**
- `PESAPAL_CONSUMER_KEY`: PesaPal API consumer key (e.g., `UDLDp9yShy4g0aLPNhT+2kZSX3L+KdsF`)
- `PESAPAL_CONSUMER_SECRET`: PesaPal API consumer secret (e.g., `XeRwDyreZTPde0H3AWlIiStXZD8=`)
- `PESAPAL_ENVIRONMENT`: `sandbox` or `live` (default: `sandbox`)
- `PESAPAL_IPN_CALLBACK_URL`: IPN callback URL (optional, auto-detected from NGROK_URL or production URL)
- `PESAPAL_REDIRECT_URL`: Redirect URL for payment success/cancellation (optional, auto-detected)
- `MPESA_CALLBACK_URL`: Callback URL for M-Pesa

**Google Maps:**
- `GOOGLE_MAPS_API_KEY`: API key for distance calculations

**Email (SMTP):**
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`
- `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

**JWT:**
- `JWT_SECRET`: Secret for JWT token generation

### Frontend Environment Variables

**Customer Site:**
- `REACT_APP_API_URL`: Backend API URL (optional, defaults to production)

**Admin Dashboard:**
- `REACT_APP_API_URL`: Backend API URL (optional, auto-detects localhost)

**Driver App:**
- Driver app API URL configured in Android app settings (see `driver-app-native/README.md`)

---

## Deployment

### Backend Deployment

```bash
# Deploy backend to Cloud Run
./deploy-backend.sh

# Sync environment variables from .env
./sync-env-to-cloud-run.sh

# Update production-specific variables
./update-production-env.sh
```

### Frontend Deployment

```bash
# Deploy customer site
./deploy-frontend.sh

# Deploy admin dashboard
./deploy-admin.sh
```

### Driver App Deployment

**Build APK:**
```bash
cd driver-app-native
./gradlew assembleRelease
# APK will be in: app/build/outputs/apk/release/
```

**Install on Device:**
```bash
adb install app/build/outputs/apk/release/app-release.apk
```

---

## Local Development

### Starting All Servers

```bash
# Start all local servers (backend, frontend, admin, ngrok)
./start-all-servers.sh
```

**Services:**
- Backend: `http://localhost:5001`
- Customer Site: `http://localhost:3000`
- Admin Dashboard: `http://localhost:3001`
- ngrok: Check `http://localhost:4040` for URL

### Backend Setup

1. Install dependencies: `cd backend && npm install`
2. Set up `.env` file (see `ENV_SETUP.md`)
3. Start server: `PORT=5001 node server.js`

### Frontend Setup

**Customer Site:**
```bash
cd frontend
npm install
npm start  # Runs on port 3000
```

**Admin Dashboard:**
```bash
cd admin-frontend
npm install
PORT=3001 npm start  # Runs on port 3001
```

### Driver App Setup

**Local Development:**
```bash
cd driver-app-native
# Open in Android Studio
# Or build with Gradle:
./gradlew assembleDebug
```

**Build APK:**
```bash
cd driver-app-native
./gradlew assembleRelease
```

**Connect to Local Backend:**
- Ensure ngrok is running: `ngrok http 5001`
- Update API URL in app configuration (see `driver-app-native/README.md`)

---

## Key Workflows

### Order Placement Flow

1. Customer browses drinks and adds to cart
2. Customer enters delivery address
3. System calculates delivery fee using Google Maps API
4. Customer selects payment method (Pay Now or Pay on Delivery)
5. If Pay Now: M-Pesa STK Push initiated immediately
6. Order created with status `pending`
7. Admin receives notification
8. Admin confirms order → status `confirmed`

### Delivery Flow

1. Admin marks order as `preparing`
2. Admin assigns driver to order
3. Order status → `out_for_delivery`
4. Driver receives push notification
5. Driver navigates to delivery address (Google Maps)
6. Driver marks as `delivered`
7. If Pay on Delivery: Driver confirms payment (M-Pesa or Cash)
8. Order status → `completed` (if payment confirmed)
9. Wallets credited automatically via `creditWalletsOnDeliveryCompletion()`

### Payment Flow

**Pay Now (M-Pesa):**
1. Customer initiates payment
2. Backend calls M-Pesa STK Push API
3. Customer receives M-Pesa prompt
4. Customer enters PIN
5. M-Pesa sends callback to backend
6. Backend creates `payment` transaction
7. Order payment status → `paid`
8. If order already delivered → status `completed` → wallets credited

**Pay on Delivery (M-Pesa):**
1. Driver marks order as `delivered`
2. Driver initiates M-Pesa STK Push
3. Customer receives M-Pesa prompt
4. Customer enters PIN
5. M-Pesa sends callback to backend
6. Backend creates `payment` transaction
7. Order status → `completed` → wallets credited

**Pay on Delivery (Cash/Mobile Money):**
1. Driver marks order as `delivered`
2. Driver confirms cash/mobile money received
3. Backend creates `payment` transaction with `paymentMethod: 'cash'`
4. Order status → `completed`
5. Wallets credited (merchant only - driver already has cash)

---

## Wallet Crediting Logic

### When Wallets Are Credited

Wallets are credited **only** when:
- Order status is `completed`
- Order payment status is `paid`
- Function: `creditWalletsOnDeliveryCompletion()` is called

### What Gets Credited

**Merchant Wallet:**
- Order payment (items total)
- Delivery fee (merchant share)

**Driver Wallet (M-Pesa payments only):**
- Delivery fee (driver share) - if enabled
- Tip - if applicable

**Driver Wallet (Cash/Mobile Money payments):**
- **Nothing** - driver already received cash/mobile money directly

### Duplicate Prevention

- In-memory lock (`processingOrders` Set) prevents concurrent execution
- Database transaction with row-level locking (`LOCK.UPDATE`)
- Multiple checks for existing transactions before creation
- Idempotent design - safe to call multiple times

---

## Transaction Types Reference

| Type | Description | Amount | Credited To | When Created |
|------|-------------|--------|-------------|--------------|
| `payment` | Customer payment for items | Items total | Merchant wallet | M-Pesa callback |
| `delivery_pay` (merchant) | Merchant delivery fee share | Delivery fee - Driver pay | Merchant wallet | Order completed |
| `delivery_pay` (driver) | Driver delivery fee share | Driver pay amount | Driver wallet | Order completed (M-Pesa only) |
| `tip` | Customer tip | Tip amount | Driver wallet | Order completed (M-Pesa only) |
| `cash_settlement` | Cash payment confirmation | Order total | N/A | Cash payment confirmed |

---

## Security Considerations

### Authentication
- Admin: JWT tokens with expiration
- Driver: Phone number-based (no password required)
- Tokens stored in localStorage (frontend) or AsyncStorage (mobile)

### API Security
- CORS configured for specific origins
- Rate limiting on critical endpoints
- Input validation on all endpoints
- SQL injection prevention via Sequelize ORM

### Data Protection
- Passwords never stored in plain text
- Environment variables for sensitive data
- Database credentials in Cloud Run secrets
- M-Pesa credentials encrypted in transit

---

## Monitoring and Logging

### Backend Logs
- Cloud Run logs available in Google Cloud Console
- Structured logging with emoji prefixes for easy scanning
- Error tracking for failed transactions

### Key Log Patterns

**Wallet Crediting:**
- `🚀 creditWalletsOnDeliveryCompletion CALLED` - Function started
- `🔒 Lock acquired` - Lock obtained
- `✅ Credited merchant wallet` - Merchant wallet updated
- `✅ Credited driver wallet` - Driver wallet updated
- `⚠️ SKIPPING` - Crediting skipped (with reason)

**M-Pesa:**
- `🔑 Requesting M-Pesa access token` - Token request
- `✅ STK Push initiated` - Payment initiated
- `💰 M-Pesa callback received` - Callback received

---

## Troubleshooting

### Common Issues

**Orders Stuck at Pending:**
- Check M-Pesa callback was received
- Verify payment transaction was created
- Check backend logs for errors

**Duplicate Transactions:**
- Check for concurrent `creditWalletsOnDeliveryCompletion` calls
- Verify in-memory lock is working
- Check database transaction logs

**Driver Wallet Not Credited:**
- Verify order status is `completed`
- Check payment method (cash payments skip driver crediting)
- Verify driver pay settings are enabled
- Check backend logs for skip reasons

**API Connection Issues:**
- Verify environment variables are set correctly
- Check Cloud Run service is running
- Verify network connectivity
- Check CORS configuration

---

## File Structure

```
dial-a-drink/
├── backend/                 # Backend API server
│   ├── models/            # Sequelize models
│   ├── routes/            # API routes
│   ├── services/          # Business logic services
│   ├── utils/             # Utility functions
│   │   ├── walletCredits.js      # Wallet crediting logic
│   │   ├── deliveryFeeTransactions.js  # Delivery fee management
│   │   └── orderFinancials.js    # Financial calculations
│   └── server.js          # Entry point
│
├── frontend/              # Customer site
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   └── services/     # API service
│   └── public/           # Static assets
│
├── admin-frontend/       # Admin dashboard
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── contexts/      # React contexts
│   │   └── services/     # API service
│   └── public/           # Static assets
│
├── driver-app-native/   # Driver mobile app (Native Android)
│   ├── src/
│   │   ├── screens/      # Screen components
│   │   ├── services/     # API service
│   │   └── components/   # Reusable components
│   ├── app/              # Android app source code
│   ├── eas.json         # EAS build configuration
│   └── publish-update.sh # OTA update script
│
├── deploy-backend.sh     # Backend deployment script
├── deploy-frontend.sh    # Customer site deployment
├── deploy-admin.sh       # Admin dashboard deployment
├── sync-env-to-cloud-run.sh  # Environment variable sync
└── start-all-servers.sh  # Local development startup
```

---

## Key Documentation Files

- **[TRANSACTION_CREATION_FLOW.md](./TRANSACTION_CREATION_FLOW.md)**: Detailed transaction creation and wallet crediting flow
- **[ENV_SETUP.md](./ENV_SETUP.md)**: Environment variable setup guide
- **[driver-app-native/README.md](./driver-app-native/README.md)**: Driver app setup and configuration

---

## Version Information

**Current Version:** Stable Release
**Last Updated:** November 2024

**Key Features Implemented:**
- ✅ Complete order management system
- ✅ M-Pesa payment integration (sandbox and production)
- ✅ Real-time updates via Socket.IO
- ✅ Wallet management (merchant and driver)
- ✅ Transaction splitting and crediting
- ✅ Cash/mobile money payment handling
- ✅ OTA updates for driver app
- ✅ Multi-environment support (local, cloud-dev, production)

---

## Support and Maintenance

### Regular Maintenance Tasks

1. **Monitor Cloud Run Logs**: Check for errors and performance issues
2. **Review Transactions**: Verify wallet crediting is working correctly
3. **Update Dependencies**: Keep npm packages up to date
4. **Database Backups**: Cloud SQL automatic backups enabled
5. **M-Pesa Credentials**: Rotate credentials periodically

### Getting Help

- Check logs in Google Cloud Console
- Review transaction creation flow documentation
- Check environment variable configuration
- Verify database connectivity

---

## License

Proprietary - All rights reserved

---

**Last Updated:** November 16, 2024
