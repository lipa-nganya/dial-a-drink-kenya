# Push Notification Implementation - Clean Architecture

## User Story
**As a driver, I want to get a push notification whenever an order is assigned or reassigned to me.**

## Backend Contract

### Order Assigned Notification
- **Type**: `order-assigned`
- **Data Fields**:
  - `orderId`: String (order ID)
  - `type`: "order-assigned"
  - `customerName`: String
  - `deliveryAddress`: String
  - `totalAmount`: String
  - `order`: JSON string (fallback)

### Order Reassigned Notification
- **Type**: `order-reassigned`
- **Data Fields**:
  - `orderId`: String (order ID)
  - `type`: "order-reassigned"
  - `order`: JSON string

## Implementation Plan

### 1. Firebase Messaging Service
- Handle incoming FCM messages
- Parse notification data
- Route to appropriate handler based on type

### 2. Notification Handlers
- **Order Assigned Handler**: Show overlay activity with order details
- **Order Reassigned Handler**: Show notification, refresh order lists

### 3. Order Acceptance Overlay
- Full-screen activity that appears on top
- Shows: Order number, customer name, delivery address, total amount
- Actions: Accept / Reject buttons
- Handles API calls to accept/reject

### 4. Integration Points
- Refresh pending orders list after notification
- Update active orders list if order is accepted
- Clear cache if order is reassigned away

## Architecture

```
services/
  └── PushNotificationService.kt (FCM service)
  
ui/
  └── notifications/
      ├── OrderAssignedOverlayActivity.kt
      └── NotificationHandler.kt (routes notifications)
      
data/
  └── repository/
      └── OrderRepository.kt (handles accept/reject)
```

## Flow

1. **Notification Received** → `PushNotificationService.onMessageReceived()`
2. **Parse Type** → Check `type` field in data
3. **Route**:
   - `order-assigned` → Launch `OrderAssignedOverlayActivity`
   - `order-reassigned` → Show notification, refresh lists
4. **User Action** (if assigned):
   - Accept → Call API → Update local state → Close overlay
   - Reject → Call API → Update local state → Close overlay
