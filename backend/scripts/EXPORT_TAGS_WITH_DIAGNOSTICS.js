// Enhanced export script with diagnostics
// Run this in the browser console after logging in

console.log('🚀 Starting tag export with diagnostics...\n');

// Step 1: Check for token
const tokenKeys = ['adminToken', 'token', 'authToken', 'accessToken', 'jwt', 'jwtToken'];
let token = null;
let tokenKey = null;

for (const key of tokenKeys) {
  const value = localStorage.getItem(key);
  if (value && value.length > 10) { // Basic validation
    token = value;
    tokenKey = key;
    console.log(`✅ Found token in "${key}"`);
    break;
  }
}

if (!token) {
  console.error('❌ No token found in localStorage!');
  console.log('\n📋 All localStorage keys:', Object.keys(localStorage));
  console.log('\n💡 Try:');
  console.log('   1. Refresh the page after logging in');
  console.log('   2. Make sure you are on an admin page (not login page)');
  console.log('   3. Check if the login was successful');
  console.log('   4. Try logging out and logging back in');
} else {
  // Step 2: Try to fetch drinks
  const apiBaseUrl = 'https://deliveryos-production-backend-805803410802.us-central1.run.app/api';
  
  console.log(`\n🔐 Using token from "${tokenKey}"`);
  console.log(`📡 Fetching from: ${apiBaseUrl}/admin/drinks\n`);
  
  fetch(`${apiBaseUrl}/admin/drinks`, {
    headers: { 
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    }
  })
  .then(async r => {
    const text = await r.text();
    console.log(`📥 Response status: ${r.status} ${r.statusText}`);
    
    if (!r.ok) {
      // Try to parse as JSON for error message
      try {
        const errorData = JSON.parse(text);
        console.error('❌ Error response:', errorData);
      } catch (e) {
        console.error('❌ Error response (not JSON):', text.substring(0, 200));
      }
      
      if (r.status === 401) {
        console.log('\n💡 Token is invalid or expired. Please log in again.');
      } else if (r.status === 404) {
        console.log('\n💡 Endpoint not found. Check the API URL.');
      }
      throw new Error(`HTTP ${r.status}: ${r.statusText}`);
    }
    
    // Parse JSON
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error('❌ Failed to parse JSON:', e);
      console.error('Response text:', text.substring(0, 500));
      throw new Error('Invalid JSON response');
    }
  })
  .then(drinks => {
    if (!Array.isArray(drinks)) {
      console.error('❌ Expected array but got:', typeof drinks);
      console.error('Response:', drinks);
      return;
    }
    
    console.log(`✅ Successfully fetched ${drinks.length} drinks`);
    
    // Filter drinks with tags
    const drinksWithTags = drinks.filter(d => 
      d.tags && Array.isArray(d.tags) && d.tags.length > 0
    );
    
    console.log(`📋 Found ${drinksWithTags.length} drinks with tags`);
    
    if (drinksWithTags.length === 0) {
      console.log('\n⚠️  No drinks with tags found in production.');
      console.log('💡 This might mean tags haven\'t been added to products yet.');
      return;
    }
    
    // Create export data
    const exportData = drinksWithTags.map(d => ({
      id: d.id,
      name: d.name,
      slug: d.slug || null,
      tags: d.tags
    }));
    
    // Output JSON
    const jsonOutput = JSON.stringify(exportData, null, 2);
    console.log('\n📄 JSON Output (copy this):\n');
    console.log(jsonOutput);
    
    // Create downloadable file
    try {
      const blob = new Blob([jsonOutput], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'production-tags.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log('\n✅ File "production-tags.json" download started!');
      console.log('💡 Save the file to the backend directory');
    } catch (e) {
      console.error('❌ Failed to create download:', e);
      console.log('\n💡 Copy the JSON output above and save it manually to a file');
    }
  })
  .catch(err => {
    console.error('\n❌ Fatal error:', err.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Check browser console for CORS errors');
    console.log('   2. Verify you are logged in');
    console.log('   3. Try refreshing the page and running again');
    console.log('   4. Check network tab to see the actual API request');
  });
}
