# Order Cost Calculation System - Summary

## What Was Created

A comprehensive server cost calculation system that tracks all costs incurred during an order's lifecycle from placement to completion.

## Files Created

1. **`backend/services/orderCostCalculator.js`**
   - Core cost calculation service
   - Tracks database operations, external APIs, compute time, network, storage, and Socket.IO
   - Provides functions for calculating costs at different stages of order lifecycle

2. **`backend/routes/orders.js`** (updated)
   - Added new endpoint: `GET /api/orders/:id/cost`
   - Returns detailed cost breakdown for any order

3. **`backend/docs/ORDER_COST_CALCULATION.md`**
   - Comprehensive documentation explaining the cost calculation system
   - Includes cost breakdowns, API usage, and optimization opportunities

4. **`backend/examples/orderCostExample.js`**
   - Example script demonstrating how to use the cost calculator
   - Shows various scenarios and cost comparisons

## How to Use

### API Endpoint

Get the cost for a specific order:

```bash
GET /api/orders/:id/cost
```

Example:
```bash
curl http://localhost:3000/api/orders/123/cost
```

### Programmatic Usage

```javascript
const { calculateFullOrderCost } = require('./services/orderCostCalculator');

const orderData = {
  id: 123,
  items: [{ drinkId: 1, quantity: 2 }],
  driverId: 5,
  paymentType: 'pay_now',
  paymentMethod: 'mobile_money',
  smsNotificationsSent: 2
};

const cost = calculateFullOrderCost(orderData);
console.log(`Total cost: ${cost.total.formatted}`);
```

## Cost Components Tracked

1. **Database Operations**
   - Reads: $0.000001 per read
   - Writes: $0.00001 per write
   - Transactions: $0.00005 per transaction

2. **External APIs**
   - SMS: $0.01 per SMS
   - M-Pesa STK Push: Free
   - M-Pesa Callbacks: Free
   - Push Notifications: Free

3. **Compute Time**
   - $0.0000001 per millisecond

4. **Network/Bandwidth**
   - $0.00000012 per KB

5. **Storage**
   - $0.0000000007 per KB per day

6. **Socket.IO Messages**
   - $0.000001 per message

## Typical Order Costs

**Pay Now Order (with M-Pesa):**
- Total: ~0.35 - 1.75 KES (~$0.0027 - $0.0135 USD)
- Main cost driver: SMS notifications (0.35 KES each)

**Pay on Delivery Order:**
- Total: ~0.35 - 1.75 KES (~$0.0027 - $0.0135 USD)
- Similar to Pay Now, but payment processing may occur later

## Cost Breakdown Example

For a typical completed order:

```
Creation:        0.70 KES (~$0.0054) (SMS notifications are main cost - 2 SMS × 0.35 KES)
Payment:         0.0013 KES (~$0.00001) (M-Pesa operations are free)
Status Updates:  0.013 KES (~$0.0001) (Database operations)
─────────────────────────────────────────
Total:           0.7143 KES (~$0.0055 USD)
```

## Key Features

1. **Comprehensive Tracking**: Tracks all server-side costs
2. **Detailed Breakdown**: Shows costs by component (database, APIs, compute, etc.)
3. **Real-time Calculation**: Can be called at any point during order lifecycle
4. **Cost Optimization**: Identifies main cost drivers for optimization
5. **Multiple Currencies**: Provides costs in both USD and KES

## Next Steps

1. **Integration**: Integrate cost tracking into order creation/update flows
2. **Monitoring**: Set up monitoring to track costs over time
3. **Optimization**: Use cost data to identify optimization opportunities
4. **Reporting**: Create reports showing cost trends and patterns

## Testing

Run the example script to see cost calculations:

```bash
node backend/examples/orderCostExample.js
```

## Notes

- Costs are calculated in KES (Kenyan Shillings) as the base currency
- Exchange rate used: 1 USD = 130 KES (approximate)
- Costs are estimates based on typical cloud provider pricing
- Actual costs may vary based on provider, region, and volume discounts
- SMS costs are the largest component (0.35 KES per SMS, ~$0.0027 USD)
- Database operations are numerous but very low cost per operation
- M-Pesa operations are free (no per-transaction fees)

