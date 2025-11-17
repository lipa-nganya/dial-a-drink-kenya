# Google Maps API Setup Guide

This guide will help you set up Google Maps API key for address autocomplete functionality in the cart page.

## Step 1: Get Google Maps API Key

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create or Select a Project**
   - Click on the project dropdown at the top
   - Click "New Project" or select an existing project
   - Give it a name (e.g., "Dial A Drink")

3. **Enable Required APIs**
   - Go to "APIs & Services" > "Library"
   - Search for and enable these APIs:
     - **Places API** (required for autocomplete)
     - **Maps JavaScript API** (recommended)

4. **Create API Key**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy the generated API key

5. **Restrict API Key (Recommended for Security)**
   - Click on the created API key to edit it
   - Under "Application restrictions":
     - Select "HTTP referrers (web sites)"
     - Add your domain (e.g., `http://localhost:3000/*` for local development)
     - Add your production domain (e.g., `https://drink-suite-customer-910510650031.us-central1.run.app/*`)
   - Under "API restrictions":
     - Select "Restrict key"
     - Select only "Places API" and "Maps JavaScript API"
   - Click "Save"

## Step 2: Add API Key to Your Project

1. **Create `.env` file in the `frontend` directory**
   ```bash
   cd frontend
   touch .env
   ```

2. **Add your API key to the `.env` file**
   ```
   REACT_APP_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
   ```

3. **Restart your development server**
   ```bash
   npm start
   ```

## Step 3: Verify It Works

1. Go to the Cart page in your application
2. Start typing an address in the "Street Address" field
3. You should see Google Maps autocomplete suggestions appear
4. The suggestions will be restricted to Kenya addresses

## For Production Deployment

If deploying to Render.com or another platform:

1. **Add environment variable in your deployment platform**
   - Go to your frontend service settings
   - Add environment variable:
     - Key: `REACT_APP_GOOGLE_MAPS_API_KEY`
     - Value: `your_api_key_here`
   - Redeploy your application

2. **Update API key restrictions** in Google Cloud Console
   - Add your production domain to the HTTP referrers list
   - Example: `https://your-production-domain.com/*`

## Troubleshooting

### "You must use an API key" error
- Make sure you've added `REACT_APP_GOOGLE_MAPS_API_KEY` to your `.env` file
- Restart your development server after adding the key
- Verify the API key is correct (no extra spaces or characters)

### Autocomplete not showing suggestions
- Check browser console for errors
- Verify Places API is enabled in Google Cloud Console
- Check API key restrictions (make sure your domain is allowed)
- Verify you have billing enabled (Google Maps requires billing for API usage)

### Billing Note
- Google Maps API requires a billing account (though they offer $200 free credit per month)
- This usually covers thousands of requests per month for free
- See: https://developers.google.com/maps/billing-and-pricing/pricing

## Cost Estimation

For a typical e-commerce site:
- **Places Autocomplete**: $2.83 per 1,000 requests
- With $200 free credit: ~70,000 requests/month free
- After free tier: Very affordable for small to medium sites

For more details: https://developers.google.com/maps/billing-and-pricing


















