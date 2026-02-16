# Inventory Replacement Guide

This guide explains how to backup your current inventory and replace it with new inventory data from a JSON file.

## Step 1: Backup Current Inventory

Before replacing inventory, always create a backup first!

```bash
cd /Users/maria/dial-a-drink
node backend/scripts/backup-inventory.js
```

This will create a file named `inventory-backup-YYYY-MM-DDTHH-MM-SS.json` in the project root directory.

**The backup file will contain:**
- All drink/product information
- Stock levels
- Prices
- Categories, brands, and other metadata
- Complete inventory state at the time of backup

## Step 2: Prepare Your JSON File

Your JSON file should be in one of these formats:

### Format 1: Array of Drinks
```json
[
  {
    "id": 1,
    "name": "Product Name",
    "stock": 10,
    "price": 100.00,
    "categoryId": 1,
    "barcode": "123456789",
    ...
  }
]
```

### Format 2: Object with Drinks Array
```json
{
  "drinks": [
    {
      "id": 1,
      "name": "Product Name",
      "stock": 10,
      "price": 100.00,
      ...
    }
  ]
}
```

### Required Fields
- `name` (required) - Product name
- `stock` (optional, defaults to 0) - Inventory stock level
- `price` (optional, defaults to 0) - Selling price

### Optional Fields
- `id` - Product ID (if provided and exists, will update; if new, will create)
- `description` - Product description
- `image` - Image URL or path
- `categoryId` - Category ID
- `subCategoryId` - Subcategory ID
- `brandId` - Brand ID
- `barcode` - Product barcode
- `purchasePrice` - Purchase/cost price
- `isAvailable` - Availability status (auto-set based on stock if not provided)
- `isPopular` - Popular product flag
- `isBrandFocus` - Brand focus flag
- `isOnOffer` - On offer flag
- `limitedTimeOffer` - Limited time offer flag
- `originalPrice` - Original price (for offers)
- `capacity` - Array of capacity options
- `capacityPricing` - Array of capacity pricing
- `abv` - Alcohol by volume

## Step 3: Share Your JSON File

You can share your JSON file in one of these ways:

1. **Place it in the project root** - Put your JSON file in `/Users/maria/dial-a-drink/` and reference it by filename
2. **Provide the full path** - Use the absolute path to your JSON file
3. **Paste the content** - You can paste the JSON content and I'll create the file for you

## Step 4: Import/Replace Inventory

Once you have your JSON file ready:

```bash
cd /Users/maria/dial-a-drink
node backend/scripts/import-inventory-from-json.js <path-to-json-file>
```

**Examples:**
```bash
# If file is in project root
node backend/scripts/import-inventory-from-json.js my-inventory.json

# If file is elsewhere
node backend/scripts/import-inventory-from-json.js /path/to/my-inventory.json
```

## What Happens During Import

1. The script reads your JSON file
2. For each drink in the JSON:
   - If the drink ID exists in the database → **Updates** the existing drink
   - If the drink ID doesn't exist → **Creates** a new drink
3. Stock levels are updated
4. Availability is automatically set based on stock (if stock > 0, isAvailable = true)

## Important Notes

⚠️ **Warning**: This process will **replace/update** existing inventory data. Always backup first!

- Items in your JSON that don't exist in the database will be **created**
- Items in your JSON that exist in the database will be **updated**
- Items in the database that are NOT in your JSON will **remain unchanged**

## Restoring from Backup

If you need to restore from a backup:

```bash
node backend/scripts/import-inventory-from-json.js inventory-backup-YYYY-MM-DDTHH-MM-SS.json
```

## Troubleshooting

### "File not found" error
- Make sure the file path is correct
- Use absolute paths if relative paths don't work
- Check file permissions

### "Invalid JSON" error
- Validate your JSON using a JSON validator
- Check for trailing commas, missing quotes, etc.

### "Missing name field" warning
- Every drink must have a `name` field
- Items without names will be skipped

### Database connection errors
- Make sure your database is running
- Check your database configuration in `.env` or `config/`

## Need Help?

If you encounter any issues or need help formatting your JSON file, just let me know!
