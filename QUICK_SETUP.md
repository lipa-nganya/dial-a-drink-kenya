# Quick Setup Guide

## Google Maps API Setup (Automated)

We've created automated scripts to help you set up Google Maps API key quickly.

### Option 1: Using Node.js Script (Recommended)

From the project root directory:

```bash
node setup-google-maps.js
```

Or if you prefer bash:

```bash
cd frontend
./setup-google-maps.sh
```

### Option 2: Manual Setup

1. **Get API Key from Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Enable "Places API" and "Maps JavaScript API"
   - Create API Key from Credentials section

2. **Run the setup script**
   ```bash
   node setup-google-maps.js
   ```
   - Enter your API key when prompted
   - The script will create the `.env` file automatically

3. **Restart your dev server**
   ```bash
   cd frontend
   npm start
   ```

### What the Script Does

✅ Checks if `.env` file exists  
✅ Prompts for your Google Maps API key  
✅ Validates API key format (basic check)  
✅ Creates `.env` file with proper configuration  
✅ Provides next steps and troubleshooting tips  

### For More Details

See `GOOGLE_MAPS_SETUP.md` for comprehensive documentation including:
- Detailed Google Cloud Console setup
- API key restrictions and security
- Production deployment instructions
- Troubleshooting guide
- Cost estimation














