# Valkyrie Partner API - Endpoints Reference

**Base URL:** `/api/valkyrie/v1`  
**Version:** 1.0

## Quick Reference

### Authentication
- `POST /auth/token` - Get access token (JWT or API key)

### Orders
- `POST /orders` - Create new order
- `GET /orders` - List orders (with filters)
- `GET /orders/:id` - Get order details
- `POST /orders/:id/request-driver` - Request driver assignment
- `GET /orders/:id/driver` - Get assigned driver

### Drivers
- `POST /drivers` - Add partner-owned driver
- `GET /drivers` - List partner drivers
- `PATCH /drivers/:id/status` - Activate/deactivate driver

### Delivery Zones
- `GET /zones` - List delivery zones
- `POST /zones` - Create delivery zone
- `PATCH /zones/:id` - Update delivery zone
- `DELETE /zones/:id` - Delete delivery zone

### Webhooks
- `GET /webhooks` - Get webhook configuration

---

## Detailed Endpoints

### 🔐 Authentication

#### POST /auth/token
Authenticate and get access token.

**Authentication:** None (public endpoint)

**Request Body:**
```json
{
  "email": "admin@partner.com",
  "password": "password123"
}
```
OR
```json
{
  "apiKey": "your-api-key-here"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "admin@partner.com",
    "role": "admin"
  },
  "partner": {
    "id": 1,
    "name": "Partner Company"
  },
  "authType": "jwt"
}
```

**Status Codes:**
- `200` - Success
- `401` - Invalid credentials

---

### 📦 Orders

#### POST /orders
Create a new delivery order.

**Authentication:** Required (JWT or API Key)

**Request Body:**
```json
{
  "customerName": "John Doe",
  "customerPhone": "254712345678",
  "customerEmail": "john@example.com",
  "deliveryAddress": "123 Main St, Nairobi",
  "latitude": -1.2921,
  "longitude": 36.8219,
  "items": [
    {
      "drinkId": 1,
      "quantity": 2,
      "price": 500
    }
  ],
  "totalAmount": 1000,
  "tipAmount": 100,
  "notes": "Handle with care",
  "paymentType": "pay_on_delivery",
  "paymentMethod": "cash",
  "externalOrderId": "PARTNER-ORDER-123"
}
```

**Response:**
```json
{
  "success": true,
  "order": {
    "id": 123,
    "partnerOrderId": 1,
    "customerName": "John Doe",
    "status": "pending",
    "totalAmount": 1000,
    "createdAt": "2024-01-01T12:00:00Z"
  }
}
```

**Status Codes:**
- `201` - Order created
- `400` - Invalid request
- `401` - Unauthorized
- `403` - Geofence violation (if enabled)

---

#### GET /orders
List partner orders with optional filters.

**Authentication:** Required (JWT or API Key)

**Query Parameters:**
- `status` (string, optional) - Filter by status: `pending`, `confirmed`, `preparing`, `out_for_delivery`, `delivered`, `completed`, `cancelled`
- `limit` (number, optional) - Results per page (default: 50, max: 100)
- `offset` (number, optional) - Pagination offset (default: 0)
- `startDate` (string, optional) - Filter orders from date (ISO 8601)
- `endDate` (string, optional) - Filter orders to date (ISO 8601)

**Example:**
```
GET /api/valkyrie/v1/orders?status=pending&limit=20&offset=0
```

**Response:**
```json
{
  "success": true,
  "orders": [
    {
      "id": 123,
      "partnerOrderId": 1,
      "customerName": "John Doe",
      "status": "pending",
      "totalAmount": 1000,
      "assignedDriver": null,
      "createdAt": "2024-01-01T12:00:00Z"
    }
  ],
  "count": 1,
  "total": 1
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized

---

#### GET /orders/:id
Get detailed information about a specific order.

**Authentication:** Required (JWT or API Key)

**Path Parameters:**
- `id` (number, required) - Order ID

**Response:**
```json
{
  "success": true,
  "order": {
    "id": 123,
    "partnerOrderId": 1,
    "customerName": "John Doe",
    "customerPhone": "254712345678",
    "customerEmail": "john@example.com",
    "deliveryAddress": "123 Main St, Nairobi",
    "totalAmount": 1000,
    "tipAmount": 100,
    "status": "pending",
    "paymentStatus": "pending",
    "paymentType": "pay_on_delivery",
    "paymentMethod": "cash",
    "items": [
      {
        "id": 1,
        "drink": {
          "id": 1,
          "name": "Beer",
          "imageUrl": "https://..."
        },
        "quantity": 2,
        "price": 500
      }
    ],
    "assignedDriver": null,
    "fulfillmentType": null,
    "externalOrderId": "PARTNER-ORDER-123",
    "createdAt": "2024-01-01T12:00:00Z",
    "updatedAt": "2024-01-01T12:00:00Z"
  }
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `404` - Order not found

---

#### POST /orders/:id/request-driver
Request driver assignment for an order.

**Authentication:** Required (JWT or API Key)

**Path Parameters:**
- `id` (number, required) - Order ID

**Request Body (optional):**
```json
{
  "driverId": 5,
  "fulfillmentType": "partner_driver"
}
```

**Request Body Fields:**
- `driverId` (number, optional) - Specific driver ID to assign (must be partner-owned or valkyrie_eligible)
- `fulfillmentType` (string, optional) - `partner_driver` or `deliveryos_driver` (default: auto-select)

**Response:**
```json
{
  "success": true,
  "message": "Driver assigned successfully",
  "driver": {
    "id": 5,
    "name": "Driver Name",
    "phoneNumber": "254712345678",
    "status": "active"
  },
  "fulfillmentType": "partner_driver",
  "partnerOrderId": 1
}
```

**Status Codes:**
- `200` - Driver assigned
- `400` - Invalid request
- `401` - Unauthorized
- `404` - Order not found
- `409` - Driver already assigned

---

#### GET /orders/:id/driver
Get assigned driver details for an order.

**Authentication:** Required (JWT or API Key)

**Path Parameters:**
- `id` (number, required) - Order ID

**Response:**
```json
{
  "success": true,
  "driver": {
    "id": 5,
    "name": "Driver Name",
    "phoneNumber": "254712345678",
    "status": "active"
  },
  "fulfillmentType": "partner_driver"
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `404` - Order not found or no driver assigned

---

### 🚗 Drivers

#### POST /drivers
Add a partner-owned driver to your fleet.

**Authentication:** Required (JWT or API Key)  
**Required Role:** `admin` or `ops`

**Request Body:**
```json
{
  "driverId": 5
}
```

**Request Body Fields:**
- `driverId` (number, required) - ID of existing driver in DeliveryOS system

**Response:**
```json
{
  "success": true,
  "driver": {
    "id": 5,
    "name": "Driver Name",
    "phoneNumber": "254712345678",
    "status": "active",
    "ownershipType": "partner_owned",
    "active": true,
    "partnerDriverId": 1
  }
}
```

**Status Codes:**
- `201` - Driver added
- `400` - Invalid request
- `401` - Unauthorized
- `403` - Insufficient permissions
- `409` - Driver already added

---

#### GET /drivers
List all partner drivers (partner-owned and DeliveryOS eligible).

**Authentication:** Required (JWT or API Key)

**Query Parameters:**
- `active` (boolean, optional) - Filter by active status: `true` or `false`
- `ownershipType` (string, optional) - Filter by ownership: `partner_owned` or `deliveryos_owned`
- `limit` (number, optional) - Results per page (default: 50)
- `offset` (number, optional) - Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "drivers": [
    {
      "id": 5,
      "name": "Driver Name",
      "phoneNumber": "254712345678",
      "status": "active",
      "ownershipType": "partner_owned",
      "active": true,
      "partnerDriverId": 1
    }
  ],
  "count": 1
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized

---

#### PATCH /drivers/:id/status
Activate or deactivate a partner-owned driver.

**Authentication:** Required (JWT or API Key)  
**Required Role:** `admin` or `ops`

**Path Parameters:**
- `id` (number, required) - Partner Driver ID (not Driver ID)

**Request Body:**
```json
{
  "active": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Driver activated successfully",
  "driver": {
    "id": 5,
    "active": true
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid request
- `401` - Unauthorized
- `403` - Insufficient permissions
- `404` - Driver not found

---

### 🗺️ Delivery Zones

#### GET /zones
List all delivery zones for the partner.

**Authentication:** Required (JWT or API Key)

**Response:**
```json
{
  "success": true,
  "zones": [
    {
      "id": 1,
      "name": "Nairobi CBD",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[...]]
      },
      "source": "partner",
      "active": true,
      "createdAt": "2024-01-01T12:00:00Z"
    }
  ],
  "count": 1
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized

---

#### POST /zones
Create a new delivery zone.

**Authentication:** Required (JWT or API Key)  
**Required Role:** `admin` or `ops`

**Request Body:**
```json
{
  "name": "Nairobi CBD",
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [-1.2921, 36.8219],
        [-1.3000, 36.8300],
        [-1.2800, 36.8300],
        [-1.2921, 36.8219]
      ]
    ]
  },
  "active": true
}
```

**Request Body Fields:**
- `name` (string, required) - Zone name
- `geometry` (object, required) - GeoJSON Polygon or MultiPolygon
- `active` (boolean, optional) - Whether zone is active (default: true)

**Response:**
```json
{
  "success": true,
  "zone": {
    "id": 1,
    "name": "Nairobi CBD",
    "geometry": {...},
    "source": "partner",
    "active": true
  }
}
```

**Status Codes:**
- `201` - Zone created
- `400` - Invalid GeoJSON or zone exceeds Zeus boundaries
- `401` - Unauthorized
- `403` - Insufficient permissions

---

#### PATCH /zones/:id
Update a delivery zone.

**Authentication:** Required (JWT or API Key)  
**Required Role:** `admin` or `ops`

**Path Parameters:**
- `id` (number, required) - Zone ID

**Request Body (all fields optional):**
```json
{
  "name": "Updated Zone Name",
  "geometry": {...},
  "active": false
}
```

**Response:**
```json
{
  "success": true,
  "zone": {
    "id": 1,
    "name": "Updated Zone Name",
    "active": false
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid request
- `401` - Unauthorized
- `403` - Insufficient permissions or Zeus-managed zone
- `404` - Zone not found

---

#### DELETE /zones/:id
Delete a delivery zone.

**Authentication:** Required (JWT or API Key)  
**Required Role:** `admin` or `ops`

**Path Parameters:**
- `id` (number, required) - Zone ID

**Response:**
```json
{
  "success": true,
  "message": "Zone deleted successfully"
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `403` - Insufficient permissions or Zeus-managed zone
- `404` - Zone not found

---

### 🔔 Webhooks

#### GET /webhooks
Get webhook configuration for the partner.

**Authentication:** Required (JWT or API Key)

**Response:**
```json
{
  "success": true,
  "webhook": {
    "url": "https://partner.com/webhooks/valkyrie",
    "configured": true,
    "events": ["order.status.updated", "driver.assigned", "delivery.completed"]
  }
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized

---

## Authentication Headers

All authenticated endpoints require one of:

### JWT Token (Console Access)
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### API Key (Programmatic Access)
```http
X-API-Key: your-api-key-here
```
OR
```http
Authorization: Bearer your-api-key-here
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error Type",
  "message": "Human-readable error message"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (resource already exists)
- `500` - Internal Server Error

---

## Rate Limiting

API requests are rate-limited per partner. Default limits:
- **Standard Plan:** 100 requests/minute
- **Enterprise Plan:** 1000 requests/minute

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

---

## Partner Scoping

All API requests are automatically scoped to the authenticated partner:
- ✅ Partners can only see their own orders
- ✅ Partners can only manage their own drivers
- ✅ Partners can access DeliveryOS drivers marked as `valkyrie_eligible`
- ❌ Partners cannot view other partners' data
- ❌ Partners cannot edit DeliveryOS driver profiles
- ❌ Partners cannot access internal admin functionality

---

## Webhook Events

Valkyrie sends webhooks for these events:

1. **order.status.updated** - Order status changed
2. **driver.assigned** - Driver assigned to order
3. **delivery.completed** - Delivery completed

See [API.md](./API.md#webhook-events) for detailed webhook payloads.

---

## Support

For API support:
- **Email:** valkyrie-support@deliveryos.com
- **Documentation:** `/docs/valkyrie/`
- **Console:** https://partner.deliveryos.com
















