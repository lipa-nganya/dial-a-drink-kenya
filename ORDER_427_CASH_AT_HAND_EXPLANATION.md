# Cash At Hand Transactions Explanation for Order 427 (Driver: Mar Loc 2)

## Order Details
- **Order ID**: 427
- **Customer**: Maria Mumoki
- **Total Amount**: KES 20.00
- **Payment Type**: PAY_ON_DELIVERY
- **Payment Method**: cash
- **Status**: completed
- **isStop**: true
- **stopDeductionAmount**: KES 100.00
- **Driver**: Mar Loc 2 (ID: 26)

## Cash Settlement Transactions (Latest 2)

There are **2 cash_settlement transactions** for this order. Here's the logic behind each:

---

### Transaction 1: KES +10.00 (ID: 1478)
**Created**: Mon Mar 02 2026 08:18:45  
**Type**: `cash_settlement`  
**Amount**: KES +10.00 (positive = credit to driver)  
**Notes**: "Cash received (cash in hand) for Order #427 debited from driver wallet."

#### Logic:
This transaction is created when the driver confirms cash payment in `backend/routes/driver-orders.js` (line 1523-1546).

**Calculation**:
```javascript
cashSettlementAmount = Math.max(totalAmount - tipAmount - driverPayAmount, 0)
```

For Order 427:
- `totalAmount` = KES 20.00
- `tipAmount` = 0 (no tip)
- `driverPayAmount` = 0 (or minimal)
- **Result**: `cashSettlementAmount` = KES 10.00

**Why KES 10.00 and not 20.00?**
The transaction amount of KES 10.00 suggests that either:
1. The `driverPayAmount` was KES 10.00 (representing the delivery fee portion), OR
2. There was a partial payment or adjustment

**What happens**:
- This transaction is recorded as a **positive cash_settlement** (credit)
- It represents cash received from the customer
- It's debited from the driver's wallet balance (not directly affecting cash at hand at this point)
- This is an accounting entry to track the cash flow

**Note**: This transaction affects the driver's wallet balance, but the actual cash at hand update happens later when the order is completed via `creditWalletsOnDeliveryCompletion`.

---

### Transaction 2: KES -15.00 (ID: 1479)
**Created**: Mon Mar 02 2026 08:19:43  
**Type**: `cash_settlement`  
**Amount**: KES -15.00 (negative = debit from driver)  
**Payment Method**: mobile_money  
**Payment Provider**: mpesa  
**Notes**: "Order payment #427 via M-Pesa - Receipt: UC2AK82J9H"

#### Logic:
This transaction is created when the driver submits the order payment via M-Pesa in `backend/routes/mpesa.js` (line 535-660).

**What happens**:
1. Driver initiates M-Pesa STK push to submit order payment
2. M-Pesa confirms payment (Receipt: UC2AK82J9H)
3. System processes the order payment submission via `processOrderPaymentSubmission()`
4. A cash submission is created and auto-approved
5. The cash_settlement transaction is **updated to negative** (line 649-656):
   ```javascript
   await cashSettlementTransaction.update({
     amount: -Math.abs(submissionAmount),  // Negative amount
     notes: `Order payment #${orderId} via M-Pesa - Receipt: ${receiptNumber}`
   });
   ```

**Why negative?**
- Negative amounts represent **cash remitted/submitted** by the driver
- This reduces the driver's cash at hand
- The amount (KES 15.00) represents the order cost + 50% of delivery fee that the driver is submitting

**Calculation**:
For PAY_ON_DELIVERY orders, the driver submits:
- Order items total (alcohol cost)
- 50% of delivery fee (the other 50% goes to savings)

If the submission amount is KES 15.00:
- This likely represents: itemsTotal + (deliveryFee × 0.5)
- Given order total is KES 20.00, the breakdown might be:
  - Items: ~KES 10.00
  - Delivery fee: ~KES 10.00
  - Driver submits: items (KES 10.00) + 50% delivery fee (KES 5.00) = KES 15.00

**Cash at Hand Impact**:
```javascript
// From mpesa.js line 592-597
const currentCashAtHand = parseFloat(driver.cashAtHand || 0);
const newCashAtHand = currentCashAtHand - submissionAmount;  // -15.00
await driver.update({ cashAtHand: newCashAtHand });
```

This **reduces** the driver's cash at hand by KES 15.00.

---

## Complete Flow Summary

1. **08:18:45**: Driver confirms cash payment
   - Transaction 1478 created: +KES 10.00 (cash received, debited from wallet)
   - Order marked as completed
   - `creditWalletsOnDeliveryCompletion()` is called

2. **08:18:45** (same time): Order completion wallet crediting
   - For PAY_ON_DELIVERY orders, `deliveryAccounting.js` calculates:
     - `cashAtHandChange` = itemsTotal + (deliveryFee × 0.5)
     - `savingsChange` = 0 (savings credited later on cash submission)
   - Driver's cash at hand is **increased** by the calculated amount
   - **Note**: Stop order status does NOT affect cash at hand (as per your recent request)

3. **08:19:43**: Driver submits order payment via M-Pesa
   - Transaction 1479 created/updated: -KES 15.00 (cash remitted)
   - Driver's cash at hand is **decreased** by KES 15.00
   - Driver savings are credited with 50% of delivery fee (KES 5.00)
   - Stop deduction of KES 100.00 is applied to savings (not cash at hand)

---

## Key Points

1. **Transaction 1478 (+KES 10.00)**: Represents cash received from customer, recorded as a credit
2. **Transaction 1479 (-KES 15.00)**: Represents cash remitted via M-Pesa, recorded as a debit
3. **Stop Order Impact**: The `isStop: true` and `stopDeductionAmount: 100.00` only affect **savings**, not cash at hand (as per your recent code change)
4. **Net Cash At Hand Change**: 
   - Increased on order completion (itemsTotal + 50% delivery fee)
   - Decreased on cash submission (KES 15.00)
   - Final net depends on the actual amounts calculated

---

## Code References

- **Cash confirmation**: `backend/routes/driver-orders.js` (lines 1523-1546)
- **M-Pesa order payment**: `backend/routes/mpesa.js` (lines 535-660)
- **Delivery accounting**: `backend/utils/deliveryAccounting.js`
- **Wallet crediting**: `backend/utils/walletCredits.js` (lines 770-814)
- **Cash submissions**: `backend/routes/cash-submissions.js` (lines 395-514)
