# Driver App Rebuild Plan - Phase 2

## Goal
Rebuild the native Android driver app from scratch using:
- Clear user stories and requirements
- Proper Android architecture (Clean Architecture)
- Standardized backend API (now complete from Phase 1)
- No workarounds or reactive fixes

## Phase 1 Status ✅
- Backend API standardized - all driver endpoints return `{ success: true, data: T }`
- No double-serialization issues
- Consistent error format: `{ success: false, error: string }`

## Phase 2: Requirements Gathering

### Step 1: Define User Stories

Please provide user stories in this format:

**As a [driver], I want to [action] so that [benefit]**

Example:
- As a driver, I want to log in with my phone number and PIN so that I can access the app securely
- As a driver, I want to see pending orders assigned to me so that I can decide whether to accept them
- As a driver, I want to see my active orders so that I can track what I'm currently delivering
- As a driver, I want to update order status (out for delivery, delivered) so that customers can track their orders
- As a driver, I want to see my wallet balance and earnings so that I know how much I've earned
- As a driver, I want to receive push notifications for new orders so that I don't miss assignments

### Step 2: Define Technical Requirements

#### Authentication
- [ ] Phone number + OTP login
- [ ] PIN setup (first time)
- [ ] PIN login (subsequent logins)
- [ ] Session management
- [ ] Auto-logout on token expiry

#### Orders
- [ ] View pending orders (assigned but not accepted)
- [ ] Accept/reject pending orders
- [ ] View active orders (accepted and in progress)
- [ ] Update order status (out for delivery, delivered, completed)
- [ ] View order details (items, customer, address, payment)
- [ ] Real-time order updates (Socket.IO)

#### Notifications
- [ ] Push notifications for new order assignments
- [ ] Push notifications for order reassignments
- [ ] In-app notification handling
- [ ] Notification when order is removed from driver

#### Wallet
- [ ] View wallet balance
- [ ] View earnings breakdown (tips, delivery fees)
- [ ] View transaction history
- [ ] Request withdrawal (M-Pesa)

#### Location
- [ ] Update driver location (background)
- [ ] Location permissions handling

#### Profile
- [ ] View driver profile
- [ ] Update profile information
- [ ] Logout

### Step 3: Define Architecture

#### Clean Architecture Layers

```
Presentation Layer (UI)
├── Activities
├── Fragments
├── ViewModels
└── UI Components

Domain Layer (Business Logic)
├── Use Cases
├── Entities
└── Repository Interfaces

Data Layer (Data Sources)
├── API Client (Retrofit)
├── Repository Implementations
├── Local Database (Room - optional)
└── SharedPreferences
```

#### Technology Stack
- **Language**: Kotlin
- **Architecture**: MVVM + Clean Architecture
- **Dependency Injection**: Hilt or Koin
- **Networking**: Retrofit + OkHttp
- **JSON Parsing**: Gson (with standardized backend, no workarounds needed)
- **Coroutines**: For async operations
- **State Management**: StateFlow / LiveData
- **Real-time**: Socket.IO client
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **Location**: Google Play Services Location API

### Step 4: API Contract

All endpoints now return standardized format:

**Success Response:**
```json
{
  "success": true,
  "data": <response_data>,
  "message": "optional message"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "error message"
}
```

**Endpoints:**
- `POST /api/auth/send-otp` - Send OTP
- `POST /api/auth/verify-otp` - Verify OTP (for drivers)
- `GET /api/drivers/phone/:phone` - Get driver by phone
- `POST /api/drivers/phone/:phone/setup-pin` - Setup PIN
- `POST /api/drivers/phone/:phone/verify-pin` - Verify PIN
- `POST /api/drivers/push-token` - Register push token
- `PUT /api/drivers/:id/location` - Update location
- `GET /api/driver-orders/:driverId/pending` - Get pending orders
- `GET /api/driver-orders/:driverId` - Get active orders (with status filter)
- `POST /api/driver-orders/:orderId/respond` - Accept/reject order
- `PATCH /api/driver-orders/:orderId/status` - Update order status
- `GET /api/driver-wallet/:driverId` - Get wallet balance
- `POST /api/driver-wallet/:driverId/withdraw` - Request withdrawal

### Step 5: Implementation Plan

1. **Setup Project Structure**
   - Create Clean Architecture package structure
   - Setup dependency injection (Hilt/Koin)
   - Configure Retrofit with standardized response handling
   - Setup Socket.IO client
   - Configure FCM

2. **Authentication Module**
   - OTP flow
   - PIN setup/verification
   - Session management

3. **Orders Module**
   - Pending orders screen
   - Active orders screen
   - Order details screen
   - Order status updates

4. **Notifications Module**
   - Push notification handling
   - In-app notifications
   - Socket.IO real-time updates

5. **Wallet Module**
   - Wallet balance screen
   - Transaction history
   - Withdrawal flow

6. **Location Module**
   - Background location updates
   - Location permissions

7. **Profile Module**
   - Profile screen
   - Settings

## Questions for You

1. **User Stories**: Can you provide the complete list of user stories? What are the most important features for drivers?

2. **Priority**: What features are critical for MVP vs. nice-to-have?

3. **Offline Support**: Should the app work offline? (Cache orders, queue updates, etc.)

4. **UI/UX**: Any specific design requirements? Material Design 3? Dark mode?

5. **Testing**: Do you want unit tests, integration tests, or just manual testing for now?

6. **Timeline**: What's the target timeline for the rebuild?

## Next Steps

Once you provide:
1. Complete user stories
2. Priority/requirements
3. Any design preferences

I'll:
1. Create the project structure
2. Set up the architecture
3. Implement features one by one following the user stories
4. Test each feature before moving to the next

This approach ensures:
- ✅ No technical debt
- ✅ Clean, maintainable code
- ✅ Proper separation of concerns
- ✅ Easy to test
- ✅ Easy to extend
