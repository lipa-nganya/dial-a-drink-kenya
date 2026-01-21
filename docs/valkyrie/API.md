# Valkyrie Partner API Documentation

**Version:** 1.0  
**Base URL:** `/api/valkyrie/v1`

## Overview

Valkyrie is DeliveryOS's enterprise Partner API and Partner Console that allows approved partners to securely access driver fulfillment, manage deliveries, and onboard drivers.

## Authentication

Valkyrie supports two authentication methods:

### 1. API Key Authentication (Programmatic Access)

Use API key for server-to-server integration:

```http
X-API-Key: your-api-key-here
```

Or as Bearer token:

```http
Authorization: Bearer your-api-key-here
```

### 2. JWT Token Authentication (Console Access)

Authenticate via email/password to get a JWT token:

```http
Authorization: Bearer your-jwt-token-here
```

## Endpoints

### Authentication

#### POST /auth/token

Authenticate and get access token.

**Request Body (Email/Password):**
```json
{
  "email": "admin@partner.com",
  "password": "password123"
}
```

**Request Body (API Key):**
```json
{
  "apiKey": "your-api-key-here"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt-token-here",
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

### Orders

#### POST /orders

Create a new delivery order.

**Request:**
```json
{
  "customerName": "John Doe",
  "customerPhone": "254712345678",
  "customerEmail": "john@example.com",
  "deliveryAddress": "123 Main St, Nairobi",
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

#### GET /orders

List partner orders.

**Query Parameters:**
- `status` (optional): Filter by status (pending, confirmed, delivered, etc.)
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

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
  "count": 1
}
```

#### GET /orders/:id

Get order details.

**Response:**
```json
{
  "success": true,
  "order": {
    "id": 123,
    "partnerOrderId": 1,
    "customerName": "John Doe",
    "customerPhone": "254712345678",
    "deliveryAddress": "123 Main St",
    "totalAmount": 1000,
    "status": "pending",
    "paymentStatus": "pending",
    "items": [
      {
        "id": 1,
        "drink": {
          "id": 1,
          "name": "Beer"
        },
        "quantity": 2,
        "price": 500
      }
    ],
    "assignedDriver": null,
    "createdAt": "2024-01-01T12:00:00Z"
  }
}
```

#### POST /orders/:id/request-driver

Request driver assignment for an order.

**Request Body (optional):**
```json
{
  "driverId": 5,
  "fulfillmentType": "partner_driver"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Driver assigned successfully",
  "driver": {
    "id": 5,
    "name": "Driver Name",
    "phoneNumber": "254712345678",
    "ownershipType": "partner_owned"
  },
  "fulfillmentType": "partner_driver",
  "partnerOrderId": 1
}
```

#### GET /orders/:id/driver

Get assigned driver details for an order.

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

### Drivers

#### POST /drivers

Add a partner-owned driver.

**Request:**
```json
{
  "driverId": 5
}
```

**Response:**
```json
{
  "success": true,
  "driver": {
    "id": 5,
    "name": "Driver Name",
    "phoneNumber": "254712345678",
    "status": "active",
    "partnerDriverId": 1
  }
}
```

#### GET /drivers

List partner drivers.

**Query Parameters:**
- `active` (optional): Filter by active status (true/false)

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

#### PATCH /drivers/:id/status

Activate or deactivate a driver.

**Request:**
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

### Webhooks

#### GET /webhooks

Get webhook configuration.

**Response:**
```json
{
  "success": true,
  "webhook": {
    "url": "https://partner.com/webhooks/valkyrie",
    "configured": true
  }
}
```

## Webhook Events

Valkyrie sends webhooks to partners for the following events:

### order.status.updated

Triggered when an order status changes.

**Payload:**
```json
{
  "event": "order.status.updated",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "orderId": 123,
    "partnerOrderId": 1,
    "status": "delivered"
  }
}
```

### driver.assigned

Triggered when a driver is assigned to an order.

**Payload:**
```json
{
  "event": "driver.assigned",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "orderId": 123,
    "partnerOrderId": 1,
    "driverId": 5,
    "fulfillmentType": "partner_driver"
  }
}
```

### delivery.completed

Triggered when a delivery is completed.

**Payload:**
```json
{
  "event": "delivery.completed",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "orderId": 123,
    "partnerOrderId": 1,
    "completedAt": "2024-01-01T12:30:00Z"
  }
}
```

### Webhook Security

All webhooks include a signature header:

```http
X-Valkyrie-Signature: sha256-hmac-signature
X-Valkyrie-Event: order.status.updated
```

Verify the signature using your webhook secret:

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expected = hmac.digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

## Error Responses

All errors follow this format:

```json
{
  "error": "Error Type",
  "message": "Human-readable error message"
}
```

**HTTP Status Codes:**
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error

## Rate Limiting

API requests are rate-limited. Contact support for higher limits.

## Partner Scoping

All API requests are automatically scoped to the authenticated partner. Partners can only:
- View their own orders
- Manage their own drivers
- Access DeliveryOS drivers marked as `valkyrie_eligible`

Partners cannot:
- View other partners' data
- Edit DeliveryOS driver profiles
- Access internal admin functionality

## Support

For API support, contact: valkyrie-support@deliveryos.com
















