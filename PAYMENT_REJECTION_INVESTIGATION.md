# Payment Rejection Investigation - Order #6

## How to Find Out Why Payment Was Rejected

The payment rejection reason is stored in multiple places:

### 1. Transaction Notes (Most Reliable)
The transaction record stores the M-Pesa `ResultCode` and `ResultDesc` in the `notes` field:
- Format: `❌ Payment Failed: [error message] (ResultCode: [code])`

### 2. Order Notes
The order record also stores rejection information:
- Format: `❌ M-Pesa Payment Rejected: [error message] (ResultCode: [code])`

### 3. Backend Logs
The backend logs the rejection with full details:
- Log message: `❌ Order #6 payment failed: [ResultDesc] (ResultCode: [code])`

## Common M-Pesa Rejection Reasons

| ResultCode | Meaning | Common Cause |
|------------|---------|--------------|
| **0** | Success | Payment completed successfully |
| **1** | Insufficient Balance | Customer doesn't have enough M-Pesa balance |
| **1032** | Request Timeout | Customer didn't complete payment within time limit |
| **1037** | Request Cancelled | Customer cancelled the payment request |
| **2001** | Wrong PIN | Customer entered incorrect M-Pesa PIN |
| **2006** | Wrong PIN | Customer entered incorrect M-Pesa PIN (alternative) |

## How to Check Order #6

### Option 1: Run Diagnostic Script (Local)
```bash
cd backend
node scripts/check-order-6-payment.js
```

### Option 2: Query Production Database Directly
```bash
# Connect to production database
gcloud sql connect dialadrink-db-prod --user=dialadrink_app --project=dialadrink-production

# Then run SQL:
SELECT 
  o.id as order_id,
  o.status,
  o."paymentStatus",
  o.notes as order_notes,
  t.id as transaction_id,
  t.status as transaction_status,
  t."paymentStatus" as transaction_payment_status,
  t."checkoutRequestID",
  t.receipt_number,
  t.notes as transaction_notes,
  t.created_at,
  t.updated_at
FROM orders o
LEFT JOIN transactions t ON t."orderId" = o.id AND t."transactionType" = 'payment'
WHERE o.id = 6
ORDER BY t.created_at DESC;
```

### Option 3: Check Backend Logs
```bash
# Check for payment failure logs
gcloud logging read \
  "resource.type=cloud_run_revision AND \
   resource.labels.service_name=deliveryos-production-backend AND \
   jsonPayload.message=~'Order #6 payment failed'" \
  --limit 20 \
  --format json \
  --project dialadrink-production

# Check for callback received logs
gcloud logging read \
  "resource.type=cloud_run_revision AND \
   resource.labels.service_name=deliveryos-production-backend AND \
   jsonPayload.message=~'CALLBACK RECEIVED.*Order #6'" \
  --limit 20 \
  --format json \
  --project dialadrink-production
```

### Option 4: Check via Admin Panel
1. Go to Admin Panel → Orders
2. Find Order #6
3. Check the "Notes" field for rejection details
4. Check the Transactions tab for payment transaction details

## What the Fix Does

The fix I just applied ensures that:
- ✅ Order status is preserved when payment is rejected (if order has progressed)
- ✅ Payment status is correctly marked as 'unpaid'
- ✅ ResultCode and ResultDesc are logged in both transaction and order notes
- ✅ Customer can retry payment without order being cancelled

## Next Steps

1. **Check the actual rejection reason** using one of the methods above
2. **If ResultCode is 1**: Customer needs to add funds to M-Pesa
3. **If ResultCode is 1032**: Customer didn't complete payment in time - can retry
4. **If ResultCode is 1037**: Customer cancelled - can retry
5. **If ResultCode is 2001/2006**: Customer entered wrong PIN - can retry

The order can be retried by initiating a new STK push payment.
