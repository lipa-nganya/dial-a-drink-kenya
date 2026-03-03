// Diagnostic script to check localStorage and find the token
// Run this in the browser console first to see what's stored

console.log('🔍 Checking localStorage...\n');

// Check all localStorage items
const allKeys = Object.keys(localStorage);
console.log('📋 All localStorage keys:', allKeys);

// Check for token variations
const tokenKeys = [
  'adminToken',
  'token',
  'authToken',
  'accessToken',
  'jwt',
  'jwtToken',
  'admin_token',
  'auth_token'
];

console.log('\n🔑 Checking for token keys:');
tokenKeys.forEach(key => {
  const value = localStorage.getItem(key);
  if (value) {
    console.log(`✅ Found "${key}": ${value.substring(0, 50)}...`);
  } else {
    console.log(`❌ "${key}": not found`);
  }
});

// Check for user info
console.log('\n👤 Checking for user info:');
const userKeys = ['adminUser', 'user', 'admin_user', 'userInfo'];
userKeys.forEach(key => {
  const value = localStorage.getItem(key);
  if (value) {
    try {
      const parsed = JSON.parse(value);
      console.log(`✅ Found "${key}":`, parsed);
    } catch (e) {
      console.log(`✅ Found "${key}": ${value.substring(0, 50)}...`);
    }
  } else {
    console.log(`❌ "${key}": not found`);
  }
});

// Check sessionStorage too
console.log('\n📦 Checking sessionStorage:');
const sessionKeys = Object.keys(sessionStorage);
if (sessionKeys.length > 0) {
  console.log('SessionStorage keys:', sessionKeys);
  sessionKeys.forEach(key => {
    if (key.toLowerCase().includes('token') || key.toLowerCase().includes('auth')) {
      console.log(`  "${key}": ${sessionStorage.getItem(key).substring(0, 50)}...`);
    }
  });
} else {
  console.log('No sessionStorage items found');
}

// Check cookies
console.log('\n🍪 Checking cookies:');
const cookies = document.cookie.split(';').map(c => c.trim());
if (cookies.length > 0 && cookies[0] !== '') {
  cookies.forEach(cookie => {
    if (cookie.toLowerCase().includes('token') || cookie.toLowerCase().includes('auth')) {
      console.log(`  Found: ${cookie.substring(0, 50)}...`);
    }
  });
} else {
  console.log('No cookies found');
}

console.log('\n💡 If no token is found, try:');
console.log('   1. Make sure you are on an admin page (not login page)');
console.log('   2. Check if you need to refresh the page after login');
console.log('   3. Try logging out and logging back in');
