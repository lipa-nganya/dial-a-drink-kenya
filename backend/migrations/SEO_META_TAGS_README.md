# SEO Meta Tags Migration

## Overview
This migration adds SEO meta title and description settings to the `settings` table. These values can be managed through the Admin Panel (Copilot > SEO page) by super_admin and super_super_admin users.

## Database Changes
**No schema changes required!** The existing `settings` table is used.

## Files
- `insert-seo-meta-tags.sql` - Inserts the SEO settings
- `rollback-seo-meta-tags.sql` - Removes the SEO settings (if needed)

## How to Run

### For Development Database

1. Open pgAdmin and connect to your **development** database
2. Open the Query Tool (Tools > Query Tool)
3. Copy the contents of `insert-seo-meta-tags.sql`
4. Paste into the Query Tool
5. Click Execute (F5)
6. Verify the results show 2 rows inserted/updated

### For Production Database

1. Open pgAdmin and connect to your **production** database
2. Open the Query Tool (Tools > Query Tool)
3. Copy the contents of `insert-seo-meta-tags.sql`
4. Paste into the Query Tool
5. Click Execute (F5)
6. Verify the results show 2 rows inserted/updated

## Settings Added

| Key | Value |
|-----|-------|
| `seoMetaTitle` | Alcohol Delivery Nairobi - Dial A Drink Kenya - 24 hours Fast Delivery |
| `seoMetaDescription` | Alcohol delivery in Nairobi and its environs in under 30 minutes! Wide variety of whisky, wine, cognacs, gin etc Call 0723688108 to order. |

## Verification

After running the migration, verify the settings were inserted:

```sql
SELECT * FROM settings WHERE key IN ('seoMetaTitle', 'seoMetaDescription');
```

You should see 2 rows with the correct values.

## Admin Panel Access

After running the migration:

1. Log into the Admin Panel as super_admin or super_super_admin
2. Navigate to Copilot > SEO
3. You should see the meta title and description fields populated
4. Click "Edit" to modify the values
5. Click "Save Changes" to update

## Rollback

If you need to remove these settings:

1. Open pgAdmin and connect to your database
2. Open the Query Tool
3. Copy the contents of `rollback-seo-meta-tags.sql`
4. Paste into the Query Tool
5. Click Execute (F5)

## Notes

- The migration uses `ON CONFLICT` to safely handle cases where the keys already exist
- If the keys exist, their values will be updated to the new values
- The `createdAt` timestamp is preserved on updates, only `updatedAt` changes
- No downtime required - this is a data-only migration
- The backend code already has default values, so the migration is optional but recommended for consistency

## API Endpoints

The settings are accessible via:
- GET `/api/settings/seoMetaTitle`
- GET `/api/settings/seoMetaDescription`
- PUT `/api/settings/seoMetaTitle` (with body: `{ "value": "new title" }`)
- PUT `/api/settings/seoMetaDescription` (with body: `{ "value": "new description" }`)

## Related Files

- Backend route: `backend/routes/settings.js`
- Admin page: `admin-frontend/src/pages/copilot/SEO.js`
- Frontend meta tags: `frontend/public/index.html`
