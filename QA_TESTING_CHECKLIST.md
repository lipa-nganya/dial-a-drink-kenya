# QA Testing Checklist - 18 Features

## Overview
This document lists all 18 features implemented for manual QA testing. Each feature includes test scenarios and expected behaviors.

---

## 1. Admin Mobile > POS - Payment Methods
**Feature**: Update payment methods to include "Pay on Delivery", "Swipe on Delivery", and "Already Paid"

**Test Scenarios**:
- [ ] Create a new order and verify payment method dropdown includes:
  - Pay on Delivery
  - Swipe on Delivery  
  - Already Paid
- [ ] Select "Pay on Delivery" and verify order is created with `paymentType: 'pay_on_delivery'`
- [ ] Select "Swipe on Delivery" and verify order is created with `paymentType: 'pay_on_delivery'` and `paymentMethod: 'card'`
- [ ] Select "Already Paid" and verify order is created with `paymentStatus: 'paid'`

---

## 2. Admin Mobile > POS - Walk-in Order Creation
**Feature**: For "Walk-in" orders, allow customer payment prompt, set delivery address to "1 Default", hide delivery fee, and limit payment methods

**Test Scenarios**:
- [ ] Select "Walk-in" order type
- [ ] Verify delivery address field is automatically set to "1 Default"
- [ ] Verify delivery fee field is hidden/not displayed
- [ ] Verify territory is automatically set to "1 Default" (territoryId: 1)
- [ ] Verify payment method dropdown only shows:
  - Cash
  - Mpesa (prompt)
- [ ] Create a walk-in order and verify it's saved with correct settings
- [ ] Test customer payment prompt button (if Mpesa prompt is selected)

---

## 3. Admin Mobile > POS - Staff Purchase with Cash at Hand
**Feature**: Add "cash" or "cash at hand" as payment options for staff purchases, and increase driver's cash at hand when selected

**Test Scenarios**:
- [ ] Select "Walk-in" order type
- [ ] Check "Staff Purchase" checkbox
- [ ] Verify payment method dropdown includes "Cash at Hand" option
- [ ] Select a driver for the staff purchase
- [ ] Create order with "Cash at Hand" payment method
- [ ] Verify driver's cash at hand balance increases by the order amount
- [ ] Verify a transaction record is created with `paymentProvider: 'staff_purchase'`

---

## 4. Admin Mobile > Assign Rider - Default Unassigned
**Feature**: By default, orders should be "unassigned" (no "unassigned so app picks first rider" option)

**Test Scenarios**:
- [ ] Create a new order
- [ ] Verify order is created with `driverId: null` by default
- [ ] Verify order status is `confirmed` (not pending)
- [ ] Verify there is no "unassigned so app picks first rider" option in the UI

---

## 5. Admin Mobile > Assign Rider - Assignment Success Message
**Feature**: Fix the "Failed to assign rider" message when a rider is actually assigned

**Test Scenarios**:
- [ ] Assign a driver to an unassigned order
- [ ] Verify success message displays correctly (not "Failed to assign rider")
- [ ] Verify order shows the assigned driver's name
- [ ] Verify order status updates correctly

---

## 6. Admin Mobile > Assign Rider - Order Status After Acceptance
**Feature**: Orders should move to "pending" status even if the rider has not accepted. After rider accepts, order should not remain in "Assign Rider" tab.

**Test Scenarios**:
- [ ] Assign a driver to an order
- [ ] Verify order moves to "pending" status (even before driver accepts)
- [ ] Have the driver accept the order via Driver App
- [ ] Verify order no longer appears in "Assign Rider" tab
- [ ] Verify "In Progress" tab shows the order with correct driver (not "No driver assigned")

---

## 7. Admin Mobile > Completed Orders Tab
**Feature**: Rename "Complete" tab to "Completed Orders" and filter to show only orders from the last 30 days

**Test Scenarios**:
- [ ] Navigate to admin dashboard
- [ ] Verify tab/button is labeled "Completed Orders" (not "Complete")
- [ ] Open "Completed Orders" screen
- [ ] Verify default date filter is set to last 30 days (fromDate = 30 days ago, toDate = today)
- [ ] Verify only orders from the last 30 days are displayed
- [ ] Verify orders older than 30 days are not shown
- [ ] Test date filter to change the range and verify results update

---

## 8. Admin Mobile > Request Payment - Orders Tab
**Feature**: Add "Riders" tab and "Orders" tab. Orders tab should link to "Make payment (orders admin)" with editable phone number

**Test Scenarios**:
- [ ] Navigate to "Request Payment" screen
- [ ] Verify two tabs exist: "Riders" and "Orders"
- [ ] Click on "Orders" tab
- [ ] Verify list of orders is displayed
- [ ] Click on an order to request payment
- [ ] Verify dialog opens with:
  - Order number and amount displayed
  - Phone number field pre-filled with customer phone
  - Phone number field is editable
- [ ] Edit the phone number
- [ ] Click "Prompt Payment" button
- [ ] Verify M-Pesa payment prompt is sent to the edited phone number

---

## 9. Admin Mobile & Admin Web - Cancelled Order Stock Restoration
**Feature**: When a user accepts a cancelled order, items should be put back in stock

**Test Scenarios**:
- [ ] Create an order with items (note the stock levels)
- [ ] Cancel the order (verify stock was reduced)
- [ ] Accept the cancelled order (via admin or driver)
- [ ] Verify stock levels are restored to original values
- [ ] Test via Admin Mobile: Approve cancellation request
- [ ] Test via Driver App: Driver accepts a previously cancelled order
- [ ] Verify inventory is restored in both scenarios

---

## 10. Driver App - Payment Success Notification
**Feature**: Send push notification to driver when M-Pesa payment prompt is successful

**Test Scenarios**:
- [ ] Assign a driver to an order
- [ ] Send M-Pesa payment prompt for the order
- [ ] Complete the payment successfully
- [ ] Verify driver receives push notification with:
  - Title: "✅ Payment Received"
  - Order ID and amount
  - Receipt number
- [ ] Verify notification is saved in Notifications screen
- [ ] Click notification and verify it opens order details

---

## 11. Driver App - Payment Failure Notification
**Feature**: Notify driver when M-Pesa payment prompt is cancelled or payment is not received

**Test Scenarios**:
- [ ] Assign a driver to an order
- [ ] Send M-Pesa payment prompt for the order
- [ ] Cancel the payment or let it fail
- [ ] Verify driver receives push notification with:
  - Title: "❌ Payment Failed"
  - Error message explaining the failure
  - Order ID
- [ ] Verify notification is saved in Notifications screen
- [ ] Test different failure scenarios (user cancelled, insufficient funds, etc.)

---

## 12. Driver App - Save Push Notifications
**Feature**: Save push notifications so drivers can refer to them later

**Test Scenarios**:
- [ ] Receive various push notifications (order assigned, payment success, payment failure, etc.)
- [ ] Navigate to "Notifications" screen in Driver App
- [ ] Verify all received notifications are displayed
- [ ] Verify notifications show:
  - Title
  - Preview/Message
  - Timestamp
  - Read/Unread status
- [ ] Verify notifications persist after app restart
- [ ] Test marking notifications as read
- [ ] Verify only last 100 notifications are kept (older ones are removed)

---

## 13. Driver App - Cash at Hand Form Updates
**Feature**: Update form fields for different submission types

**Test Scenarios**:

**Purchases**:
- [ ] Select "Purchases" submission type
- [ ] Verify "Amount" field below "Delivery Location" is removed/hidden
- [ ] Verify "Payment Type" field below "Delivery Location" is removed/hidden

**Cash**:
- [ ] Select "Cash" submission type
- [ ] Verify "item description" field is renamed to "source"
- [ ] Verify "amount" field is removed
- [ ] Verify "payment type" field is removed

**General Expense**:
- [ ] Select "General Expense" submission type
- [ ] Verify "expense item" field is renamed to "description"
- [ ] Verify "nature of expenditure (2nd)" field is removed
- [ ] Verify "amount" field is removed
- [ ] Verify "payment type" field is removed

**Payment to Office**:
- [ ] Select "Payment to Office" submission type
- [ ] Verify "Description" field is renamed to "Sender"
- [ ] Verify "2nd amount" field is removed
- [ ] Verify "payment type" field is removed

---

## 14. Driver App - Remove Order Payment & Add Transactions Button
**Feature**: Remove "Order Payment" submission type and add button on Transactions tab to view cash at hand summary

**Test Scenarios**:
- [ ] Navigate to Cash at Hand submission form
- [ ] Verify "Order Payment" is not in the submission type dropdown
- [ ] Navigate to "Transactions" tab
- [ ] Verify "View Cash At Hand Summary" button is displayed at the top
- [ ] Click the button
- [ ] Verify dialog opens showing:
  - Actual Cash At Hand
  - Pending Submissions (if any)
  - Balance After Approval (if pending submissions exist)
- [ ] Verify "Submit Pending Cash At Hand" button is available (if there are pending submissions)
- [ ] Test submitting pending cash at hand from the dialog

---

## 15. Cash at Hand & Savings - Transaction Description Formatting
**Feature**: Transaction descriptions should use only the first 2 words of delivery address + "submission"

**Test Scenarios**:
- [ ] Create a cash at hand submission linked to an order
- [ ] View the transaction in "Transactions" tab
- [ ] Verify description shows format: "[First 2 words] submission"
  - Example: "Denali Apartments submission" (from "Denali Apartments Block A Room 101")
- [ ] Test with different address formats:
  - "Westlands CBD Building" → "Westlands CBD submission"
  - "Karen" → "Karen submission"
- [ ] Verify same formatting applies to savings transactions from orders
- [ ] Verify both debits and credits use this format

---

## 16. Admin Mobile - Loans & Penalties List Refresh
**Feature**: Fix issue where app says "no drivers with loans/penalties" even when they exist

**Test Scenarios**:
- [ ] Navigate to "Loans & Penalties" screen
- [ ] Add a new loan to a driver
- [ ] Verify the driver appears in the "Loans" tab immediately (or after brief delay)
- [ ] Add a new penalty to a driver
- [ ] Verify the driver appears in the "Penalties" tab immediately (or after brief delay)
- [ ] Verify list refreshes correctly after adding loan/penalty
- [ ] Test with multiple drivers to ensure all are displayed

---

## 17. Loan Deductions - Automated Savings Recovery
**Feature**: Automatically deduct 150 KES from savings every 24 hours from when loan was added, and increase cash at hand by 150

**Test Scenarios**:
- [ ] Create a loan for a driver (note initial savings and cash at hand)
- [ ] Verify loan has `nextDeductionDate` set to 24 hours from creation
- [ ] Wait for or manually trigger the loan deduction process (runs every 15 minutes)
- [ ] Verify after 24 hours:
  - Driver's savings decreased by 150 KES
  - Driver's cash at hand increased by 150 KES
  - Loan balance decreased by 150 KES
  - Two transactions created:
    - `savings_withdrawal` with amount -150, `paymentProvider: 'savings_recovery'`
    - `cash_settlement` with amount +150, `paymentProvider: 'savings_recovery'`
- [ ] Verify `nextDeductionDate` is updated to next 24 hours
- [ ] Verify process continues every 24 hours until loan is paid off
- [ ] Verify loan status changes to `paid_off` when balance reaches 0

---

## 18. Admin Web - Driver Savings, Cash at Hand, Penalties & Withdrawals
**Feature**: List all driver savings, cash at hand balances, and allow admin to add penalties/withdraw savings

**Test Scenarios**:

**Driver Savings & Cash at Hand Display**:
- [ ] Navigate to Drivers page in Admin Web
- [ ] Verify "Savings" column is displayed in the drivers table
- [ ] Verify "Cash at Hand" column shows correct balances
- [ ] Verify both columns display values for all drivers

**Add Penalty**:
- [ ] Click "Add Penalty" button (orange minus icon) for a driver
- [ ] Verify dialog opens with:
  - Driver name displayed
  - Amount field
  - Reason field
- [ ] Enter penalty amount and reason
- [ ] Submit penalty
- [ ] Verify driver's savings decreased by penalty amount
- [ ] Verify penalty record is created
- [ ] Verify drivers list refreshes to show updated savings

**Withdraw Savings**:
- [ ] Click "Withdraw Savings" button (blue download icon) for a driver with savings > 0
- [ ] Verify button is disabled for drivers with 0 savings
- [ ] Verify dialog opens with:
  - Available savings amount displayed
  - Withdrawal amount field
  - Reason/description field
- [ ] Enter withdrawal amount (less than available savings)
- [ ] Enter reason
- [ ] Submit withdrawal
- [ ] Verify driver's savings decreased by withdrawal amount
- [ ] Verify `savings_withdrawal` transaction is created
- [ ] Verify drivers list refreshes to show updated savings
- [ ] Test error handling: Try to withdraw more than available savings

---

## 19. Customer Site - UI Updates (Bonus)
**Feature**: Hero image wider on desktop, rename "add to cart" to "buy now", footer updates, lazy loading, mobile search 2 per row

**Test Scenarios**:

**Hero Image**:
- [ ] View homepage on desktop
- [ ] Verify hero image is wider than before

**Buy Now Button**:
- [ ] Navigate to product page
- [ ] Verify button text is "Buy Now" (not "Add to Cart")

**Footer**:
- [ ] Scroll to footer
- [ ] Verify footer includes text: "swipe on delivery, pay online Visa Mastercard"

**Delivery Location Lazy Loading**:
- [ ] Navigate to delivery location page
- [ ] Scroll down
- [ ] Verify items load automatically as you scroll (no pagination)
- [ ] Verify loading indicator appears when loading more items

**Mobile Search Results**:
- [ ] View search results on mobile device
- [ ] Verify results display 2 items per row (not 1 or 3)

---

## Testing Notes

### Prerequisites
- Admin Mobile app installed and logged in
- Driver App installed and logged in
- Admin Web accessible and logged in
- Customer site accessible
- Test orders, drivers, and inventory items available

### Test Data Requirements
- At least 2-3 test drivers
- Test orders (new, assigned, completed, cancelled)
- Inventory items with stock
- Test loans and penalties
- Orders with various delivery addresses

### Common Issues to Watch For
- UI elements not updating after actions
- Incorrect status messages
- Missing data in lists
- Date filtering not working correctly
- Notifications not being saved
- Stock not being restored correctly

---

## Sign-off

**Tester Name**: _________________

**Date**: _________________

**Status**: 
- [ ] All features tested and passed
- [ ] Issues found (see notes below)
- [ ] Partial testing completed

**Notes/Issues**:
_________________________________________________
_________________________________________________
_________________________________________________
