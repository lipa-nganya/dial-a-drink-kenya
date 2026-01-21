# Pending Orders Implementation - Complete

## User Stories Implemented

### ✅ Story 1: View Pending Orders
**As a driver, I want to get orders assigned to me listed in the pending screen showing the order number, customer name, delivery address and accept or reject button.**

**Implementation:**
- `PendingOrdersActivity` displays all pending orders
- Each order card shows:
  - ✅ Order number (`Order #123`)
  - ✅ Customer name (`Customer: John Doe`)
  - ✅ Delivery address (`Location: 123 Main St`)
  - ✅ Accept button
  - ✅ Reject button

**Files:**
- `ui/orders/PendingOrdersActivity.kt` - Main activity
- `res/layout/item_pending_order.xml` - Order card layout
- `data/repository/OrderRepository.kt` - Fetches pending orders from API

### ✅ Story 2: Reject Order
**As a driver, if I reject an order from the pending list, I want the order to be removed from my pending list and left as unassigned until the admin assigns the order back to me or to another driver.**

**Implementation:**
- Reject button shows confirmation dialog
- Calls `OrderRepository.respondToOrder()` with `accepted = false`
- Backend sets `driverId = null` (order becomes unassigned)
- Backend sets `driverAccepted = false`
- Order is removed from pending list (refresh after rejection)
- Admin receives notification that order was rejected

**Backend Behavior:**
- `POST /api/driver-orders/:orderId/respond` with `accepted: false`
- Sets `driverId = null` and `driverAccepted = false`
- Emits `order-rejected-by-driver` event to admin
- Order no longer appears in driver's pending orders (filtered by `driverId`)

### ✅ Story 3: Real-time Reassignment
**If the order is assigned back to me, I would like the push notification to be displayed and the order to be added to the pending screen in real time without having to refresh.**

**Implementation:**
- **Push Notification**: Backend sends FCM notification when order is reassigned
- **Socket.IO Event**: Backend emits `order-assigned` event to `driver-${driverId}` room
- **Real-time Update**: `PendingOrdersActivity` listens to `order-assigned` socket event
- **Auto-refresh**: When socket event received, automatically refreshes pending orders list
- **No manual refresh needed**: Order appears in list immediately

**Backend Changes:**
- ✅ Backend emits to `driver-${driverId}` room (not just socket ID)
- ✅ Drivers join `driver-${driverId}` room on registration
- ✅ Works even if socket reconnects (room persists)

**Android Implementation:**
- ✅ `SocketService` listens to `order-assigned` event
- ✅ `PendingOrdersActivity.setupSocketConnection()` handles event
- ✅ Calls `refreshOrdersFromRepository()` on event
- ✅ Order appears in list without manual refresh

## Technical Details

### API Endpoints Used

1. **Get Pending Orders**
   - `GET /api/driver-orders/:driverId/pending`
   - Returns: `{ success: true, data: List<Order> }`
   - Filters: `driverId = driverId AND (driverAccepted = null OR driverAccepted = false) AND status NOT IN ('cancelled', 'completed')`

2. **Respond to Order**
   - `POST /api/driver-orders/:orderId/respond`
   - Request: `{ driverId: Int, accepted: Boolean }`
   - Response: `{ success: true, data: Order }`
   - If `accepted = false`: Sets `driverId = null`, `driverAccepted = false`

### Socket.IO Events

1. **order-assigned**
   - Emitted to: `driver-${driverId}` room
   - Data: `{ order: Order, playSound: true }`
   - Triggered when: Order assigned or reassigned to driver

2. **order-status-updated**
   - Emitted to: `driver-${driverId}` room
   - Data: `{ orderId: Int, status: String, order: Order }`
   - Triggered when: Order status changes

### Push Notifications

1. **order-assigned**
   - Type: `order-assigned`
   - Data: `orderId`, `customerName`, `deliveryAddress`, `totalAmount`
   - Action: Launches `OrderAcceptanceActivity` overlay

2. **order-reassigned**
   - Type: `order-reassigned`
   - Data: `orderId`
   - Action: Shows notification, clears cache

## Flow Diagrams

### Reject Order Flow
```
User clicks Reject
  ↓
Confirmation dialog
  ↓
User confirms
  ↓
API: POST /driver-orders/:orderId/respond { accepted: false }
  ↓
Backend: Sets driverId = null, driverAccepted = false
  ↓
Backend: Emits order-rejected-by-driver to admin
  ↓
Backend: Returns success
  ↓
App: Shows success toast
  ↓
App: Refreshes pending orders list
  ↓
Order removed from list (no longer has driverId)
```

### Reassignment Flow
```
Admin assigns order to driver
  ↓
Backend: Sets driverId = driverId, driverAccepted = null
  ↓
Backend: Emits order-assigned to driver-${driverId} room
  ↓
Backend: Sends FCM push notification
  ↓
App: Receives push notification → Shows overlay
  ↓
App: Receives socket event → Refreshes pending orders
  ↓
Order appears in pending list (real-time, no refresh needed)
```

## Testing Checklist

- [ ] Pending orders screen shows order number, customer name, delivery address
- [ ] Accept button works and removes order from pending list
- [ ] Reject button works and removes order from pending list
- [ ] Rejected order becomes unassigned (admin can see it)
- [ ] When order reassigned to same driver:
  - [ ] Push notification received
  - [ ] Order appears in pending list automatically (no refresh)
  - [ ] Socket event triggers refresh
- [ ] When order reassigned to different driver:
  - [ ] Order removed from previous driver's list
  - [ ] New driver receives notification
