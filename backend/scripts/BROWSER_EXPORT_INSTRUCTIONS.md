# Browser Export Instructions for Tag Sync

## Step 1: Log in to Production Admin

1. Go to: https://www.dialadrinkkenya.com/admin/login
2. Log in with your credentials
3. After successful login, you should be on the dashboard

## Step 2: Export Tags from Browser Console

1. **Open Browser Console** (F12 or Right-click → Inspect → Console tab)

2. **Run this code** (copy and paste the entire block):

```javascript
// Get the API base URL from the page
const apiBaseUrl = window.location.origin + '/api';
const token = localStorage.getItem('adminToken');

if (!token) {
  console.error('❌ Not logged in! Please log in first.');
} else {
  console.log('🔐 Token found, fetching drinks...');
  
  fetch(`${apiBaseUrl}/admin/drinks`, {
    headers: { 
      'Authorization': 'Bearer ' + token 
    }
  })
  .then(r => {
    if (!r.ok) {
      throw new Error(`HTTP ${r.status}: ${r.statusText}`);
    }
    return r.json();
  })
  .then(drinks => {
    console.log(`✅ Fetched ${drinks.length} drinks`);
    
    // Filter drinks with tags
    const drinksWithTags = drinks.filter(d => 
      d.tags && Array.isArray(d.tags) && d.tags.length > 0
    );
    
    console.log(`📋 Found ${drinksWithTags.length} drinks with tags`);
    
    // Create export data
    const exportData = drinksWithTags.map(d => ({
      id: d.id,
      name: d.name,
      slug: d.slug || null,
      tags: d.tags
    }));
    
    // Output JSON
    const jsonOutput = JSON.stringify(exportData, null, 2);
    console.log('\n📄 Copy the JSON below and save it to a file:\n');
    console.log(jsonOutput);
    
    // Also create a downloadable link
    const blob = new Blob([jsonOutput], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'production-tags.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('\n✅ File download started!');
  })
  .catch(err => {
    console.error('❌ Error:', err);
    console.log('\n💡 If you get a 404 error, try using the full API URL:');
    console.log('   Replace apiBaseUrl with:');
    console.log('   const apiBaseUrl = "https://deliveryos-production-backend-805803410802.us-central1.run.app/api";');
  });
}
```

3. **If you get a 404 error**, try this version with the full API URL:

```javascript
const apiBaseUrl = 'https://deliveryos-production-backend-805803410802.us-central1.run.app/api';
const token = localStorage.getItem('adminToken');

if (!token) {
  console.error('❌ Not logged in! Please log in first.');
} else {
  console.log('🔐 Token found, fetching drinks...');
  
  fetch(`${apiBaseUrl}/admin/drinks`, {
    headers: { 
      'Authorization': 'Bearer ' + token 
    }
  })
  .then(r => {
    if (!r.ok) {
      throw new Error(`HTTP ${r.status}: ${r.statusText}`);
    }
    return r.json();
  })
  .then(drinks => {
    console.log(`✅ Fetched ${drinks.length} drinks`);
    
    const drinksWithTags = drinks.filter(d => 
      d.tags && Array.isArray(d.tags) && d.tags.length > 0
    );
    
    console.log(`📋 Found ${drinksWithTags.length} drinks with tags`);
    
    const exportData = drinksWithTags.map(d => ({
      id: d.id,
      name: d.name,
      slug: d.slug || null,
      tags: d.tags
    }));
    
    const jsonOutput = JSON.stringify(exportData, null, 2);
    console.log('\n📄 Copy the JSON below:\n');
    console.log(jsonOutput);
    
    const blob = new Blob([jsonOutput], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'production-tags.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('\n✅ File download started!');
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
  });
}
```

## Step 3: Save the JSON File

- The script will automatically download a file named `production-tags.json`
- OR copy the JSON output from the console and save it to a file

## Step 4: Run the Sync Script

```bash
cd backend
node scripts/sync-tags-via-browser-export.js production-tags.json
```

The script will:
- Match drinks by ID, slug, or name
- Update local drinks with tags from production
- Show a detailed summary
