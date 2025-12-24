# Transaction Creation Flow

This document describes the complete transaction creation process for all transaction types in the Dial a Drink Kenya system.

## Overview

Transactions are created at different stages of the order lifecycle:
1. **Order Payment** - Created when M-Pesa payment is initiated
2. **Delivery Fee Payment (Merchant)** - Created when order delivery is completed
3. **Delivery Fee Payment (Driver)** - Created when order delivery is completed (if driver pay is enabled)
4. **Tip** - Created when order delivery is completed (if tip exists)

---

## 1. Order Payment Transaction (`transactionType: 'payment'`)

### When Created
- **Location**: `backend/routes/mpesa.js` - M-Pesa callback handler (`/api/mpesa/callback`)
- **Trigger**: When M-Pesa sends payment confirmation callback

### Creation Process

1. **Initial Check** (lines 1025-1051):
   - Checks if payment transaction already exists for the order
   - Uses database transaction with lock (`LOCK.UPDATE`) to prevent duplicates
   - If exists, updates `checkoutRequestID` and `receiptNumber` if missing

2. **Transaction Creation** (lines 1054-1074):
   ```javascript
   transaction = await db.Transaction.create({
     orderId: order.id,
     transactionType: 'payment',
     paymentMethod: 'mobile_money',
     paymentProvider: 'mpesa',
     amount: itemsTotal,  // Only items total, NOT delivery fee or tip
     status: 'pending',   // Will be updated to 'completed' when payment confirmed
     paymentStatus: 'pending'
   })
   ```

3. **Payment Finalization** (`finalizeOrderPayment` function, lines 163-170):
   - Updates transaction status to `'completed'`
   - Sets `paymentStatus` to `'paid'`
   - Sets `receiptNumber` from M-Pesa callback
   - Sets `transactionDate` from M-Pesa callback
   - **Amount**: Only `itemsTotal` (order items cost), NOT delivery fee or tip

### Key Points
- ✅ Created **ONCE** per order
- ✅ Amount = `itemsTotal` only
- ✅ Status updated to `'completed'` when payment confirmed
- ✅ Used as reference for other transaction types (receiptNumber, checkoutRequestID)

---

## 2. Delivery Fee Payment (Merchant) (`transactionType: 'delivery_pay'`, `driverId: null`)

### When Created
- **Location**: `backend/utils/walletCredits.js` - `creditWalletsOnDeliveryCompletion` function
- **Trigger**: When order status changes to `'completed'` AND `paymentStatus` is `'paid'`

### Creation Process

1. **Function Entry** (line 23):
   - Called from `backend/routes/driver-orders.js` or `backend/routes/admin.js` when order is marked as completed
   - Uses in-memory lock (`processingOrders` Set) to prevent concurrent execution

2. **Order Validation** (lines 131-135):
   - Ensures order status is `'completed'`
   - Ensures `paymentStatus` is `'paid'`
   - Gets financial breakdown (`itemsTotal`, `deliveryFee`, `tipAmount`)

3. **Merchant Delivery Transaction Lookup** (lines 225-234):
   ```javascript
   merchantDeliveryTransaction = await db.Transaction.findOne({
     where: {
       orderId: orderId,
       transactionType: 'delivery_pay',
       driverId: null,        // CRITICAL: Must be null for merchant transaction
       driverWalletId: null   // CRITICAL: Must be null for merchant transaction
     }
   })
   ```

4. **Transaction Creation/Update** (lines 240-265):
   ```javascript
   merchantDeliveryPayload = {
     orderId: orderId,
     transactionType: 'delivery_pay',
     amount: merchantDeliveryAmount,  // deliveryFee - driverPayAmount
     status: 'completed',
     paymentStatus: 'paid',
     receiptNumber: receiptNumber,    // From payment transaction
     checkoutRequestID: paymentTransaction.checkoutRequestID,
     driverId: null,                  // CRITICAL: null for merchant
     driverWalletId: null              // CRITICAL: null for merchant
   }
   ```

5. **Wallet Crediting** (lines 267-305):
   - Credits merchant wallet with: `itemsTotal + merchantDeliveryAmount`
   - Updates `AdminWallet.balance`, `totalRevenue`, `totalOrders`

### Key Points
- ✅ Created **ONCE** per order (or updated if exists)
- ✅ Amount = `deliveryFee - driverPayAmount` (merchant's share)
- ✅ `driverId` = `null` (distinguishes from driver delivery transaction)
- ✅ `driverWalletId` = `null` (distinguishes from driver delivery transaction)
- ✅ Status = `'completed'` immediately (order is already completed)

---

## 3. Delivery Fee Payment (Driver) (`transactionType: 'delivery_pay'`, `driverId: <driverId>`)

### When Created
- **Location**: `backend/utils/walletCredits.js` - `creditWalletsOnDeliveryCompletion` function
- **Trigger**: When order status changes to `'completed'` AND `paymentStatus` is `'paid'` AND `driverPayAmount > 0`

### Creation Process

1. **Initial Check** (lines 70-79):
   ```javascript
   existingDriverDeliveryTxn = await db.Transaction.findOne({
     where: {
       orderId: orderId,
       transactionType: 'delivery_pay',
       driverId: order.driverId,  // CRITICAL: Must match driver
       status: { [Op.ne]: 'cancelled' }
     }
   })
   ```

2. **Condition Check** (line 348):
   - Only creates if `driverPayAmount > 0.009`
   - If `driverPayAmount` is 0, skips driver delivery transaction creation

3. **Transaction Lookup** (lines 355-387):
   - First checks `existingDriverDeliveryTxn` (from initial check)
   - Then checks for transaction with `driverId: null` that might be converted
   - Finally checks for any `delivery_pay` transaction with matching `driverId`
   - All checks use `LOCK.UPDATE` to prevent race conditions

4. **Transaction Creation/Update** (lines 392-440):
   ```javascript
   driverDeliveryPayload = {
     orderId: orderId,
     transactionType: 'delivery_pay',  // CRITICAL: Same type as merchant, but has driverId
     amount: driverPayAmount,           // CRITICAL: Only driver's share
     status: 'completed',
     paymentStatus: 'paid',
     receiptNumber: receiptNumber,      // From payment transaction
     checkoutRequestID: paymentTransaction.checkoutRequestID,
     driverId: order.driverId,          // CRITICAL: Identifies this as driver transaction
     driverWalletId: driverWallet.id,   // CRITICAL: Links to driver wallet
     notes: `Driver delivery fee payment for Order #${orderId}...`
   }
   ```

5. **Final Check** (lines 418-439):
   - Before creating, does one final check with lock
   - If found, updates instead of creating duplicate
   - Only creates if truly no transaction exists

6. **Wallet Crediting** (lines 442-451):
   - Credits driver wallet with: `driverPayAmount`
   - Updates `DriverWallet.balance`, `totalDeliveryPay`, `totalDeliveryPayCount`

### Key Points
- ✅ Created **ONCE** per order (or updated if exists)
- ✅ Amount = `driverPayAmount` (driver's share of delivery fee)
- ✅ `driverId` = `<driverId>` (distinguishes from merchant transaction)
- ✅ `driverWalletId` = `<driverWalletId>` (links to driver wallet)
- ✅ Only created if `driverPayAmount > 0.009`
- ✅ Status = `'completed'` immediately (order is already completed)

### Potential Issue
⚠️ **If `driverPayAmount` is 0 but there's a tip, this transaction should NOT be created.**
- The code checks `if (driverPayAmount > 0.009)` before creating (line 348)
- If skipped, logs: "Skipping driver delivery transaction creation - driverPayAmount is too small"

---

## 4. Tip Transaction (`transactionType: 'tip'`)

### When Created
- **Location**: `backend/utils/walletCredits.js` - `creditWalletsOnDeliveryCompletion` function
- **Trigger**: When order status changes to `'completed'` AND `paymentStatus` is `'paid'` AND `effectiveTipAmount > 0`

### Creation Process

1. **Initial Check** (lines 81-89):
   ```javascript
   existingTipTxn = await db.Transaction.findOne({
     where: {
       orderId: orderId,
       transactionType: 'tip',  // CRITICAL: Different type from delivery_pay
       status: { [Op.ne]: 'cancelled' }
     }
   })
   ```

2. **Tip Amount Calculation** (lines 145-157):
   ```javascript
   tipAmountFromBreakdown = parseFloat(breakdown.tipAmount) || 0
   tipAmountFromOrder = parseFloat(order.tipAmount || '0') || 0
   tipAmount = Math.max(tipAmountFromBreakdown, tipAmountFromOrder)
   effectiveTipAmount = Math.max(tipAmount, orderTipAmountAfterReload)
   ```

3. **Condition Check** (line 463):
   - Only creates if `effectiveTipAmount > 0.009`
   - If `effectiveTipAmount` is 0, skips tip transaction creation

4. **Transaction Lookup** (lines 467-480):
   - First checks `existingTipTxn` (from initial check)
   - Then checks for any `tip` transaction with lock
   - All checks use `LOCK.UPDATE` to prevent race conditions

5. **Transaction Creation/Update** (lines 486-539):
   ```javascript
   tipPayload = {
     orderId: orderId,
     transactionType: 'tip',  // CRITICAL: Different from 'delivery_pay'
     amount: effectiveTipAmount,
     status: 'completed',
     paymentStatus: 'paid',
     receiptNumber: receiptNumber,      // From payment transaction
     checkoutRequestID: paymentTransaction.checkoutRequestID,
     driverId: order.driverId,          // Links to driver
     driverWalletId: driverWallet.id,   // Links to driver wallet
     notes: `Tip for Order #${orderId} - credited to driver wallet...`
   }
   ```

6. **Validation** (lines 504-508):
   - Double-checks `tipPayload.transactionType === 'tip'`
   - Throws error if type is wrong (prevents tips from being created as `delivery_pay`)

7. **Final Check** (lines 518-538):
   - Before creating, does one final check with lock
   - If found, updates instead of creating duplicate
   - Only creates if truly no transaction exists

8. **Wallet Crediting** (lines 546-551):
   - Credits driver wallet with: `effectiveTipAmount`
   - Updates `DriverWallet.balance`, `totalTipsReceived`, `totalTipsCount`

### Key Points
- ✅ Created **ONCE** per order (or updated if exists)
- ✅ Amount = `effectiveTipAmount` (tip amount)
- ✅ `transactionType` = `'tip'` (CRITICAL: different from `'delivery_pay'`)
- ✅ `driverId` = `<driverId>` (links to driver)
- ✅ `driverWalletId` = `<driverWalletId>` (links to driver wallet)
- ✅ Only created if `effectiveTipAmount > 0.009`
- ✅ Status = `'completed'` immediately (order is already completed)

---

## Summary Table

| Transaction Type | When Created | Amount | driverId | driverWalletId | transactionType |
|-----------------|--------------|--------|----------|----------------|-----------------|
| **Order Payment** | M-Pesa callback | `itemsTotal` | `null` | `null` | `'payment'` |
| **Delivery Fee (Merchant)** | Order completed | `deliveryFee - driverPayAmount` | `null` | `null` | `'delivery_pay'` |
| **Delivery Fee (Driver)** | Order completed | `driverPayAmount` | `<driverId>` | `<driverWalletId>` | `'delivery_pay'` |
| **Tip** | Order completed | `effectiveTipAmount` | `<driverId>` | `<driverWalletId>` | `'tip'` |

---

## Potential Issues

### Issue 1: Duplicate Driver Delivery Transactions
**Symptom**: Two `delivery_pay` transactions with `driverId` set
**Possible Causes**:
1. `creditWalletsOnDeliveryCompletion` called multiple times concurrently
2. `existingDriverDeliveryTxn` check fails to find existing transaction
3. Race condition between transaction lookup and creation

**Current Safeguards**:
- In-memory lock (`processingOrders` Set)
- Database transaction with `LOCK.UPDATE`
- Multiple checks before creating (initial, double-check, final check)

### Issue 2: Tip Created as Delivery Pay Transaction
**Symptom**: Tip amount appears as `delivery_pay` transaction instead of `tip`
**Possible Causes**:
1. `tipPayload.transactionType` accidentally set to `'delivery_pay'`
2. Tip transaction lookup finds `delivery_pay` transaction instead

**Current Safeguards**:
- Explicit `transactionType: 'tip'` in payload
- Validation check before creating (throws error if wrong type)
- Separate lookup queries for `tip` vs `delivery_pay`

### Issue 3: Driver Delivery Transaction Created When Tip Should Be Created
**Symptom**: When `driverPayAmount` is 0 but tip exists, a `delivery_pay` transaction is created with tip amount
**Possible Causes**:
1. `driverPayAmount` calculation is wrong (should be 0 but isn't)
2. Tip amount accidentally used in `driverDeliveryPayload.amount`

**Current Safeguards**:
- Check `if (driverPayAmount > 0.009)` before creating driver delivery transaction
- Validation that `driverDeliveryPayload.amount === driverPayAmount`
- Separate code paths for driver delivery fee vs tip

---

## Debugging Tips

1. **Check Logs**: Look for these log messages:
   - `🚀 creditWalletsOnDeliveryCompletion CALLED` - Function entry
   - `💵 Creating/updating driver delivery transaction` - Driver delivery transaction creation
   - `💵 Tip crediting check` - Tip transaction creation check
   - `✅ Created driver delivery transaction` - Driver delivery transaction created
   - `✅ Created tip transaction` - Tip transaction created

2. **Check Transaction Types**: Query database:
   ```sql
   SELECT id, "transactionType", amount, "driverId", "driverWalletId", status
   FROM transactions
   WHERE "orderId" = <orderId>
   ORDER BY "createdAt";
   ```

3. **Check Amounts**: Verify:
   - Order payment amount = `itemsTotal`
   - Merchant delivery amount = `deliveryFee - driverPayAmount`
   - Driver delivery amount = `driverPayAmount`
   - Tip amount = `effectiveTipAmount`

4. **Check Conditions**: Verify:
   - `driverPayAmount > 0.009` before creating driver delivery transaction
   - `effectiveTipAmount > 0.009` before creating tip transaction
   - `transactionType` is correct for each transaction type

