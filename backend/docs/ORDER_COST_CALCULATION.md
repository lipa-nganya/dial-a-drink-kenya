# Order Cost Calculation System

This document explains how server costs are calculated for orders from placement to completion.

## Overview

The order cost calculation system tracks all server-side costs incurred during an order's lifecycle, including:

- **Database Operations**: Reads, writes, and transactions
- **External API Calls**: SMS, M-Pesa STK Push, M-Pesa callbacks, Push notifications
- **Compute Time**: Server execution time
- **Network/Bandwidth**: Data transfer costs
- **Storage**: Data storage costs
- **Socket.IO**: Real-time messaging costs

## Cost Breakdown

**Note**: All costs are calculated in KES (Kenyan Shillings) and converted to USD using exchange rate 1 USD = 130 KES.

### Database Costs

- **Read Operations**: 0.00013 KES per read (~0.13 KES per million reads, ~$0.000001 USD)
- **Write Operations**: 0.0013 KES per write (~1.3 KES per million writes, ~$0.00001 USD)
- **Transactions**: 0.0065 KES per transaction (~6.5 KES per million transactions, ~$0.00005 USD)

### External API Costs

- **SMS**: 0.35 KES per SMS (~$0.0027 USD)
- **M-Pesa STK Push**: Free (no per-transaction fee)
- **M-Pesa Callbacks**: Free
- **Push Notifications**: Free (Expo push notifications)

### Compute Costs

- **Per Millisecond**: 0.000013 KES (~$0.0000001 USD, ~$0.36 per hour of execution)

### Network Costs

- **Per KB**: 0.0000156 KES (~$0.00000012 USD, ~$0.12 per GB)

### Storage Costs

- **Per KB per Day**: 0.000000091 KES (~$0.0000000007 USD, ~$0.02 per GB per month)

### Socket.IO Costs

- **Per Message**: 0.00013 KES (~$0.000001 USD, minimal cost)

## Order Lifecycle Cost Tracking

### 1. Order Creation

**Database Operations:**
- Settings lookups (testMode, maxTip, deliveryFee)
- Drink lookups (one per item)
- Category lookup for delivery fee calculation
- Branch assignment lookups
- Driver assignment lookups
- Order creation transaction
- Order write
- Customer sync/creation
- OrderItem writes (one per item)
- Order reload with includes

**External APIs:**
- Push notification to driver (if assigned)
- SMS notifications (if enabled, typically 1-3 SMS)

**Socket.IO:**
- New order notification to admin
- Order assigned notification to driver

**Estimated Cost**: ~0.35 - 1.75 KES (~$0.0027 - $0.0135 USD)

### 2. Payment Processing (M-Pesa)

**Database Operations:**
- Order lookup
- Order financial breakdown
- Settings lookup (driverPay)
- Transaction creation (payment, delivery, tip)
- Order notes update
- Transaction status updates (on callback)
- Order payment status update

**External APIs:**
- M-Pesa STK Push initiation
- M-Pesa payment callback

**Socket.IO:**
- Payment confirmed notification

**Estimated Cost**: ~0.0013 - 0.0065 KES (~$0.00001 - $0.00005 USD)

### 3. Status Updates

**Database Operations:**
- Order lookup per status update
- Order status write per update
- Driver status check (on completion)
- Wallet credit operations (on completion)
- Inventory decrease (on completion)
- Transaction lookups/updates (on completion)

**Socket.IO:**
- Order status updated notification per update

**Typical Status Flow:**
- pending → confirmed → preparing → out_for_delivery → delivered → completed

**Estimated Cost**: ~0.0065 - 0.026 KES (~$0.00005 - $0.0002 USD)

## Total Order Cost

**Typical Order (Pay Now with M-Pesa):**
- Creation: ~0.35 - 1.75 KES (~$0.0027 - $0.0135)
- Payment: ~0.0013 - 0.0065 KES (~$0.00001 - $0.00005)
- Status Updates: ~0.0065 - 0.026 KES (~$0.00005 - $0.0002)
- **Total: ~0.35 - 1.75 KES (~$0.0027 - $0.0135 USD)**

**Typical Order (Pay on Delivery):**
- Creation: ~0.35 - 1.75 KES (~$0.0027 - $0.0135)
- Payment: ~0.0013 - 0.0065 KES (~$0.00001 - $0.00005, if driver initiates)
- Status Updates: ~0.0065 - 0.026 KES (~$0.00005 - $0.0002)
- **Total: ~0.35 - 1.75 KES (~$0.0027 - $0.0135 USD)**

## API Usage

### Get Order Cost

```bash
GET /api/orders/:id/cost
```

**Response:**
```json
{
  "orderId": 123,
  "orderStatus": "completed",
  "paymentType": "pay_now",
  "paymentMethod": "mobile_money",
  "costBreakdown": {
    "creation": {
      "cost": 0.012345,
      "operations": {
        "database": {
          "reads": 15,
          "writes": 5,
          "transactions": 1
        },
        "externalAPIs": {
          "sms": 2,
          "pushNotifications": 1
        },
        "socket": 2
      }
    },
    "payment": {
      "cost": 0.00001,
      "operations": {
        "database": {
          "reads": 5,
          "writes": 4
        },
        "externalAPIs": {
          "mpesaStkPush": 1,
          "mpesaCallbacks": 1
        },
        "socket": 1
      }
    },
    "statusUpdates": {
      "cost": 0.0001,
      "statuses": ["confirmed", "preparing", "out_for_delivery", "delivered", "completed"],
      "operations": {
        "database": {
          "reads": 10,
          "writes": 5
        },
        "socket": 5
      }
    }
  },
      "totalCost": {
        "kes": 0.7143,
        "usd": "0.005495",
        "formatted": "KES 0.7143 ($0.005495)"
      },
  "summary": {
    "totalDatabaseOperations": 45,
    "totalExternalAPICalls": 5,
    "totalSocketMessages": 8,
    "computeTime": {
      "milliseconds": 1250,
      "seconds": "1.25"
    }
  }
}
```

## Cost Factors

The main cost drivers are:

1. **SMS Notifications**: $0.01 per SMS is the largest cost component
2. **Database Operations**: Multiple reads/writes add up
3. **Storage**: Long-term storage costs accumulate over time

## Optimization Opportunities

1. **Reduce SMS Usage**: Only send critical SMS notifications
2. **Batch Database Operations**: Combine multiple reads where possible
3. **Cache Frequently Accessed Data**: Reduce database reads
4. **Optimize Queries**: Use efficient queries and indexes

## Notes

- Costs are estimates based on typical cloud provider pricing
- Actual costs may vary based on:
  - Cloud provider (AWS, GCP, Azure, etc.)
  - Region
  - Volume discounts
  - Specific service tiers
- M-Pesa costs are typically free for STK Push, but may have setup fees
- SMS costs vary by provider and volume
- Storage costs accumulate over time (calculated per day)

