# How to export all production product IDs for tag sync

The sync script needs a list of all product IDs from https://www.dialadrinkkenya.com/admin/products.  
If the collector script gets 0 IDs, you can export them manually from the browser.

## Steps

1. Log in to https://www.dialadrinkkenya.com/admin with your credentials.
2. Go to **Products** (or https://www.dialadrinkkenya.com/admin/products).
3. Open DevTools (F12) → **Console**.
4. Paste and run **one** of the options below.

### Option A: From API (if the page uses it)

```javascript
(async () => {
  const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
  if (!token) return console.log('No token. Log in first.');
  const res = await fetch('/api/admin/drinks?limit=2500', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const data = await res.json();
  const list = Array.isArray(data) ? data : (data?.data || data?.drinks || data?.products || []);
  const ids = (list || []).map(p => p.id || p._id).filter(Boolean);
  console.log(ids.length + ' IDs. Copy the array below:');
  console.log(JSON.stringify(ids));
  copy(ids.join('\n'));
  console.log('IDs copied to clipboard (one per line). Paste into backend/scripts/production-product-ids.txt');
})();
```

### Option B: From table links on the page

Scroll the products list so all rows load, then run:

```javascript
const ids = [...new Set(
  Array.from(document.querySelectorAll('a[href*="/admin/products/"], a[href*="products/"]'))
    .map(a => (a.getAttribute('href') || '').match(/\/products\/([a-f0-9]+)/i)?.[1])
    .filter(Boolean)
)];
console.log(ids.length + ' IDs');
copy(ids.join('\n'));
console.log('Copied to clipboard. Paste into backend/scripts/production-product-ids.txt');
```

5. Paste the clipboard contents into **backend/scripts/production-product-ids.txt** (one ID per line).
6. Run the full sync:

   ```bash
   cd backend && node scripts/sync-all-tags-from-production-admin.js --delay 1200
   ```

This will take about 40–60 minutes for 2077 products.
