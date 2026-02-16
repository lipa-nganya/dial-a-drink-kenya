# Import Orders from dialadrinkkenya.com

## Issue

The API authentication is failing for `https://www.dialadrinkkenya.com`. The login endpoint returns "Unauthorized" even with the correct credentials.

## Solution Options

### Option 1: Export Orders Manually via Admin Panel

1. **Login to Admin Panel**
   - Go to: https://www.dialadrinkkenya.com/admin/login
   - Login with: `simonkimari@gmail.com` / `admin12345`

2. **Export Orders**
   - Navigate to the Orders page
   - Look for an "Export" or "Download" button
   - Export all orders as JSON or CSV
   - Save the file (e.g., `orders-export.json`)

3. **Import to Production**
   ```bash
   cd backend
   node scripts/import-orders-from-json.js ../orders-export.json
   ```

### Option 2: Direct Database Export (if you have access)

If you have direct database access to the old site:

1. **Export from old database:**
   ```bash
   pg_dump -h <old-db-host> -U <user> -d <old-db> \
     --data-only \
     --table=orders \
     --table=order_items \
     --column-inserts \
     > old-orders-export.sql
   ```

2. **Import to production:**
   ```bash
   psql "host=35.223.10.1 port=5432 dbname=dialadrink_prod user=dialadrink_app sslmode=require" \
     -f old-orders-export.sql
   ```

### Option 3: Fix API Authentication

If the credentials are different or the API endpoint has changed:

1. **Verify credentials** - Check if `simonkimari@gmail.com` / `admin12345` is correct
2. **Check API endpoint** - The endpoint should be: `/api/admin/auth/login`
3. **Update script** - Modify `backend/scripts/import-orders-from-dialadrinkkenya.js` with correct credentials

## Scripts Available

1. **`backend/scripts/import-orders-from-dialadrinkkenya.js`**
   - Attempts to login via API and fetch orders
   - Currently failing due to authentication issues

2. **`backend/scripts/import-orders-from-json.js`**
   - Imports orders from a JSON file
   - Usage: `node scripts/import-orders-from-json.js <path-to-json>`

## Expected Order Format

The JSON file should be an array of order objects with this structure:

```json
[
  {
    "id": 1,
    "customerName": "John Doe",
    "customerPhone": "254712345678",
    "customerEmail": "customer@example.com",
    "deliveryAddress": "123 Main St",
    "totalAmount": 5000.00,
    "tipAmount": 0,
    "status": "completed",
    "paymentStatus": "paid",
    "paymentType": "pay_on_delivery",
    "paymentMethod": "cash",
    "items": [
      {
        "id": 1,
        "orderId": 1,
        "drinkId": 123,
        "quantity": 2,
        "price": 2500.00
      }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

## Next Steps

1. Try logging into the admin panel manually to verify credentials
2. Export orders from the admin panel if possible
3. Use `import-orders-from-json.js` to import the exported data
4. Or provide correct database credentials for direct database export
