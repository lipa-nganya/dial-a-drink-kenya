#!/usr/bin/env node

/**
 * Google Maps API Setup Script
 * Automates the setup of Google Maps API key for the Dial A Drink application
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setupGoogleMaps() {
  console.log('\n🗺️  Google Maps API Setup Script');
  console.log('==================================\n');

  // Check if we're in the right directory
  const packageJsonPath = path.join(__dirname, 'frontend', 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    log('❌ Error: Cannot find frontend directory', 'red');
    console.log('\nPlease run this script from the project root directory:');
    log(`   cd /Users/maria/dial-a-drink`, 'blue');
    log(`   node setup-google-maps.js`, 'blue');
    console.log('\nOr use the full path:');
    log(`   node /Users/maria/dial-a-drink/setup-google-maps.js`, 'blue');
    process.exit(1);
  }

  const frontendDir = path.join(__dirname, 'frontend');
  const envFile = path.join(frontendDir, '.env');
  const envExample = path.join(frontendDir, '.env.example');

  // Check if .env already exists
  if (fs.existsSync(envFile)) {
    log('⚠️  .env file already exists', 'yellow');
    const overwrite = await question('Do you want to overwrite it? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      log('Keeping existing .env file. You can manually edit it to add the API key.', 'yellow');
      rl.close();
      return;
    }
  }

  console.log('\nStep 1: Google Cloud Console Setup');
  console.log('-----------------------------------\n');
  log('Please follow these steps in Google Cloud Console:', 'blue');
  console.log('1. Visit: https://console.cloud.google.com/');
  console.log('2. Create or select a project');
  console.log('3. Enable "Places API" and "Maps JavaScript API"');
  console.log('4. Go to APIs & Services > Credentials');
  console.log('5. Create an API Key\n');
  log('Need help? See GOOGLE_MAPS_SETUP.md for detailed instructions', 'yellow');
  console.log('');

  // Get API key from user
  const apiKey = await question('Enter your Google Maps API Key (or press Enter to skip): ');

  if (!apiKey || apiKey.trim() === '') {
    console.log('');
    log('⚠️  No API key provided. Creating .env file with placeholder.', 'yellow');
    console.log('');

    // Create .env from .env.example if it exists
    let envContent;
    if (fs.existsSync(envExample)) {
      envContent = fs.readFileSync(envExample, 'utf8');
    } else {
      envContent = `# API Configuration
REACT_APP_API_URL=http://localhost:5001/api

# Google Maps API Key (for address autocomplete)
# Get your API key from: https://console.cloud.google.com/
# Enable "Places API" and "Maps JavaScript API" for your project
REACT_APP_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
`;
    }

    fs.writeFileSync(envFile, envContent);
    console.log('Created .env file with template');
    console.log('');
    log('Please edit .env file and add your API key manually', 'yellow');
    console.log('Then restart your development server with: npm start');
    rl.close();
    return;
  }

  const trimmedKey = apiKey.trim();

  // Basic validation - Google Maps API keys typically start with AIza and are ~39 chars
  if (!trimmedKey.startsWith('AIza') || trimmedKey.length < 35) {
    log('⚠️  Warning: API key format looks unusual', 'yellow');
    console.log('Google Maps API keys typically start with "AIza" and are 39 characters long');
    const continueAnyway = await question('Continue anyway? (y/N): ');
    if (continueAnyway.toLowerCase() !== 'y') {
      log('Setup cancelled', 'red');
      rl.close();
      return;
    }
  }

  // Create .env file
  console.log('\nCreating .env file...');

  let envContent;
  if (fs.existsSync(envExample)) {
    envContent = fs.readFileSync(envExample, 'utf8');
    envContent = envContent.replace(/your_google_maps_api_key_here/g, trimmedKey);
  } else {
    envContent = `# API Configuration
REACT_APP_API_URL=http://localhost:5001/api

# Google Maps API Key (for address autocomplete)
REACT_APP_GOOGLE_MAPS_API_KEY=${trimmedKey}
`;
  }

  fs.writeFileSync(envFile, envContent);
  log('✅ .env file created successfully!', 'green');

  // Verify
  const createdContent = fs.readFileSync(envFile, 'utf8');
  if (createdContent.includes(`REACT_APP_GOOGLE_MAPS_API_KEY=${trimmedKey}`)) {
    log('✅ API key verified in .env file', 'green');
  } else {
    log('❌ Error: API key not found in .env file', 'red');
    rl.close();
    process.exit(1);
  }

  console.log('\nStep 2: Next Steps');
  console.log('------------------\n');
  log('Setup complete!', 'green');
  console.log('');
  console.log('1. Restart your development server:');
  log('   npm start', 'blue');
  console.log('');
  console.log('2. Test the autocomplete:');
  console.log('   - Go to the Cart page');
  console.log('   - Start typing an address in "Street Address" field');
  console.log('   - You should see Google Maps suggestions');
  console.log('');
  console.log('3. If deploying to production:');
  console.log('   - Add REACT_APP_GOOGLE_MAPS_API_KEY to your deployment platform');
  console.log('   - Update API key restrictions in Google Cloud Console');
  console.log('');
  log('Note: Make sure billing is enabled in Google Cloud Console', 'yellow');
  console.log('Google Maps API offers $200 free credit per month');
  console.log('');
  log('🎉 You\'re all set!', 'green');

  rl.close();
}

// Run the setup
setupGoogleMaps().catch(error => {
  log(`\n❌ Error: ${error.message}`, 'red');
  rl.close();
  process.exit(1);
});

