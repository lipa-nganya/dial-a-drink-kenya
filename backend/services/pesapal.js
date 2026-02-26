const crypto = require('crypto');

// Helper function to get credentials (read from env at runtime, not module load time)
const getPesapalCredentials = () => {
  const key = process.env.PESAPAL_CONSUMER_KEY;
  const secret = process.env.PESAPAL_CONSUMER_SECRET;
  return { key, secret };
};

// Validate required credentials
const validatePesapalCredentials = () => {
  const { key, secret } = getPesapalCredentials();
  if (!key || !secret) {
    console.error('❌ PesaPal credentials missing! Please set:');
    console.error('   PESAPAL_CONSUMER_KEY');
    console.error('   PESAPAL_CONSUMER_SECRET');
    return false;
  }
  return true;
};

// Determine environment and base URL
// Default to sandbox for testing - set PESAPAL_ENVIRONMENT=live for production
const PESAPAL_ENVIRONMENT = process.env.PESAPAL_ENVIRONMENT || 'sandbox'; // sandbox or live
const PESAPAL_BASE_URL = PESAPAL_ENVIRONMENT === 'live'
  ? 'https://pay.pesapal.com/v3'  // Production
  : 'https://cybqa.pesapal.com/pesapalv3';  // Sandbox

// Log environment on module load
console.log(`🔧 PesaPal Environment: ${PESAPAL_ENVIRONMENT.toUpperCase()}`);
console.log(`🔧 PesaPal Base URL: ${PESAPAL_BASE_URL}`);

let accessToken = null;
let tokenExpiry = null;
let registeredIPNId = null;

/**
 * Get PesaPal access token
 */
async function getAccessToken() {
  try {
    // Check if we have a valid cached token
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
      return accessToken;
    }

    // Get credentials at runtime - MUST be done first
    const credentials = getPesapalCredentials();
    const PESAPAL_CONSUMER_KEY = credentials.key;
    const PESAPAL_CONSUMER_SECRET = credentials.secret;

    console.log(`🔍 STEP 1: Raw env check`);
    console.log(`   PESAPAL_CONSUMER_KEY:`, process.env.PESAPAL_CONSUMER_KEY ? `SET (${process.env.PESAPAL_CONSUMER_KEY.length} chars)` : 'NOT SET');
    console.log(`   PESAPAL_CONSUMER_SECRET:`, process.env.PESAPAL_CONSUMER_SECRET ? `SET (${process.env.PESAPAL_CONSUMER_SECRET.length} chars)` : 'NOT SET');
    console.log(`🔍 STEP 2: Retrieved credentials`);
    console.log(`   Key:`, PESAPAL_CONSUMER_KEY ? `SET (${PESAPAL_CONSUMER_KEY.length} chars) = ${PESAPAL_CONSUMER_KEY.substring(0, 10)}...` : 'NOT SET');
    console.log(`   Secret:`, PESAPAL_CONSUMER_SECRET ? `SET (${PESAPAL_CONSUMER_SECRET.length} chars) = ${PESAPAL_CONSUMER_SECRET.substring(0, 10)}...` : 'NOT SET');

    // Validate credentials are set
    if (!PESAPAL_CONSUMER_KEY || !PESAPAL_CONSUMER_SECRET) {
      console.error('❌ PesaPal credentials validation failed!');
      console.error('   Key:', PESAPAL_CONSUMER_KEY ? 'Present' : 'Missing');
      console.error('   Secret:', PESAPAL_CONSUMER_SECRET ? 'Present' : 'Missing');
      throw new Error('PesaPal credentials (CONSUMER_KEY and CONSUMER_SECRET) are required');
    }

    // PesaPal API 3.0 uses /Auth/RequestToken endpoint (as per official documentation)
    const tokenUrl = `${PESAPAL_BASE_URL}/api/Auth/RequestToken`;
    
    console.log(`🔑 STEP 3: Requesting PesaPal access token`);
    console.log(`   Base URL: ${PESAPAL_BASE_URL}`);
    console.log(`   Full URL: ${tokenUrl}`);
    console.log(`   Environment: ${PESAPAL_ENVIRONMENT}`);
    console.log(`   URL length: ${tokenUrl.length}`);
    
    // PesaPal API 3.0 requires credentials in the request body with lowercase keys
    // Exactly as per documentation: https://developer.pesapal.com/how-to-integrate/api-30-json/api-reference
    const requestBody = {
      consumer_key: PESAPAL_CONSUMER_KEY,
      consumer_secret: PESAPAL_CONSUMER_SECRET
    };
    
    console.log(`📤 STEP 4: Request body (actual values):`);
    console.log(`   consumer_key: ${PESAPAL_CONSUMER_KEY}`);
    console.log(`   consumer_secret: ${PESAPAL_CONSUMER_SECRET}`);
    console.log(`   JSON body:`, JSON.stringify(requestBody));
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();
    console.log(`📥 PesaPal response status: ${response.status}`);
    console.log(`📥 PesaPal response body:`, responseText);
    
    if (!response.ok) {
      console.error(`❌ PesaPal OAuth Error (${response.status}):`, responseText);
      throw new Error(`Failed to get access token: ${response.status} ${response.statusText}. Response: ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse PesaPal response as JSON:', responseText);
      throw new Error('Invalid JSON response from PesaPal: ' + responseText);
    }
    
    if (!data.token) {
      console.error('❌ No token in PesaPal response:', data);
      throw new Error('PesaPal did not return a token. Response: ' + JSON.stringify(data));
    }
    
    accessToken = data.token;
    // Set expiry to 55 minutes (tokens typically expire in 1 hour)
    tokenExpiry = Date.now() + (55 * 60 * 1000);
    
    console.log(`✅ PesaPal access token obtained successfully (expires in 55 minutes)`);
    return accessToken;
  } catch (error) {
    console.error('❌ Error getting PesaPal access token:', error);
    throw error;
  }
}

/**
 * Get IPN callback URL based on environment
 * NOTE: Since PesaPal only allows IPN configuration in production credentials section,
 * we prioritize ngrok for local testing, but fall back to production URL.
 * Even when using sandbox credentials, IPN must be configured in Production section.
 */
const getIPNCallbackUrl = () => {
  // Production IPN URL must be on the exact same domain as the website (www.ruakadrinksdelivery.co.ke)
  // PesaPal requires the IPN URL to match the website domain exactly (no subdomains)
  const PRODUCTION_IPN_URL = 'https://www.ruakadrinksdelivery.co.ke/api/pesapal/ipn';
  const DEV_IPN_URL = 'https://deliveryos-development-backend-lssctajjoq-uc.a.run.app/api/pesapal/ipn';
  
  // Priority 1: If PESAPAL_IPN_CALLBACK_URL is explicitly set, use it (for testing/override)
  let callbackUrl = process.env.PESAPAL_IPN_CALLBACK_URL;
  if (callbackUrl) {
    if (callbackUrl.includes('localhost') || callbackUrl.includes('127.0.0.1')) {
      console.warn('⚠️  Localhost IPN callback URL detected. Using dev backend URL instead.');
      callbackUrl = DEV_IPN_URL;
    } else {
      console.log(`✅ Using IPN callback URL from environment: ${callbackUrl}`);
      return callbackUrl;
    }
  }
  
  // Priority 2: Check for ngrok URL in environment (for local development)
  const ngrokUrl = process.env.NGROK_URL;
  if (ngrokUrl && !ngrokUrl.includes('localhost') && !ngrokUrl.includes('127.0.0.1')) {
    callbackUrl = `${ngrokUrl}/api/pesapal/ipn`;
    console.log(`✅ Using ngrok URL for IPN callbacks (local development): ${callbackUrl}`);
    console.log(`⚠️  NOTE: Make sure this URL is also configured in PesaPal dashboard (Production credentials section)`);
    return callbackUrl;
  }
  
  // Priority 3: Check if we're in development backend
  const { isProduction, isCloudRun } = require('../utils/envDetection');
  if (isCloudRun() && process.env.NODE_ENV === 'development') {
    console.log(`✅ Using development backend IPN callback URL: ${DEV_IPN_URL}`);
    return DEV_IPN_URL;
  }
  
  // Priority 4: Check if we're in production
  if (isProduction()) {
    console.log(`✅ Using production IPN callback URL: ${PRODUCTION_IPN_URL}`);
    return PRODUCTION_IPN_URL;
  }
  
  // Priority 5: Fall back to dev backend URL for local development
  console.log(`⚠️  No ngrok URL found. Using development backend IPN URL for local development: ${DEV_IPN_URL}`);
  console.log(`⚠️  For local testing, set NGROK_URL in .env.local and configure that URL in PesaPal dashboard`);
  return DEV_IPN_URL;
};

/**
 * Register IPN (Instant Payment Notification) URL with PesaPal
 * This should be called once during setup, but we'll call it before each order if needed
 */
async function registerIPN() {
  try {
    if (registeredIPNId) {
      return registeredIPNId;
    }

    const token = await getAccessToken();
    const ipnUrl = getIPNCallbackUrl();
    
    const registerUrl = `${PESAPAL_BASE_URL}/api/URLSetup/RegisterIPN`;
    
    const response = await fetch(registerUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        url: ipnUrl,
        ipn_notification_type: 'GET'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ PesaPal IPN Registration Error (${response.status}):`, errorText);
      throw new Error(`Failed to register IPN: ${response.status} ${response.statusText}. Response: ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.ipn_id) {
      console.error('❌ No ipn_id in PesaPal response:', data);
      throw new Error('PesaPal did not return an IPN ID. Response: ' + JSON.stringify(data));
    }
    
    registeredIPNId = data.ipn_id;
    console.log(`✅ PesaPal IPN registered successfully. IPN ID: ${registeredIPNId}`);
    return registeredIPNId;
  } catch (error) {
    console.error('❌ Error registering PesaPal IPN:', error);
    throw error;
  }
}

/**
 * Submit order request to PesaPal and get payment URL
 * @param {Object} orderData - Order data
 * @param {string} orderData.id - Order ID
 * @param {string} orderData.currency - Currency code (e.g., 'KES')
 * @param {number} orderData.amount - Amount to charge
 * @param {string} orderData.description - Order description
 * @param {string} orderData.customerName - Customer name
 * @param {string} orderData.customerEmail - Customer email
 * @param {string} orderData.customerPhone - Customer phone number
 * @param {string} orderData.callbackUrl - URL to redirect after payment
 * @param {string} orderData.cancellationUrl - URL to redirect if payment is cancelled
 */
async function submitOrderRequest(orderData) {
  console.log('🔍 submitOrderRequest: Checking credentials...');
  console.log('   PESAPAL_CONSUMER_KEY:', process.env.PESAPAL_CONSUMER_KEY ? `SET (${process.env.PESAPAL_CONSUMER_KEY.length} chars)` : 'NOT SET');
  console.log('   PESAPAL_CONSUMER_SECRET:', process.env.PESAPAL_CONSUMER_SECRET ? `SET (${process.env.PESAPAL_CONSUMER_SECRET.length} chars)` : 'NOT SET');
  
  // Validate credentials at runtime
  if (!validatePesapalCredentials()) {
    console.error('❌ PesaPal credentials validation failed in submitOrderRequest');
    throw new Error('PesaPal credentials are required. Please set environment variables: PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET');
  }
  
  try {
    console.log('🔑 submitOrderRequest: Calling getAccessToken()...');
    const token = await getAccessToken();
    console.log('✅ submitOrderRequest: Got access token:', token ? 'YES' : 'NO');
    
    // Register IPN if not already registered
    const ipnId = await registerIPN();
    
    // Get redirect URLs - prioritize ngrok URL
    const getRedirectUrl = () => {
      // Priority 1: ngrok URL (for local development)
      const ngrokUrl = process.env.NGROK_URL;
      if (ngrokUrl) {
        return ngrokUrl;
      }
      
      // Priority 2: Explicit redirect URL
      if (process.env.PESAPAL_REDIRECT_URL) {
        return process.env.PESAPAL_REDIRECT_URL;
      }
      
      // Priority 3: Production/Dev URL (use environment variable or default)
      // Default to Netlify production URL since customer site is on Netlify
      const customerUrl = process.env.CUSTOMER_FRONTEND_URL || 'https://dialadrink.thewolfgang.tech';
      const { isProduction } = require('../utils/envDetection');
      if (isProduction() || process.env.NODE_ENV === 'production') {
        return customerUrl;
      }
      
      // Default for local development
      return 'http://localhost:3000';
    };
    
    const baseUrl = getRedirectUrl();
    const callbackUrl = orderData.callbackUrl || `${baseUrl}/payment-success?orderId=${orderData.id}`;
    const cancellationUrl = orderData.cancellationUrl || `${baseUrl}/payment-cancelled?orderId=${orderData.id}`;
    
    const submitUrl = `${PESAPAL_BASE_URL}/api/Transactions/SubmitOrderRequest`;
    
    const payload = {
      id: orderData.id, // Unique order tracking ID
      currency: orderData.currency || 'KES',
      amount: parseFloat(orderData.amount).toFixed(2),
      description: orderData.description || `Order #${orderData.id}`,
      callback_url: callbackUrl,
      redirect_mode: '',
      notification_id: ipnId,
      branch: orderData.branch || 'Default Branch',
      billing_address: {
        email_address: orderData.customerEmail || '',
        phone_number: orderData.customerPhone || '',
        country_code: 'KE',
        first_name: orderData.customerName?.split(' ')[0] || 'Customer',
        middle_name: '',
        last_name: orderData.customerName?.split(' ').slice(1).join(' ') || '',
        line_1: orderData.deliveryAddress || '',
        line_2: '',
        city: '',
        state: '',
        postal_code: '',
        zip_code: ''
      }
    };

    console.log('PesaPal Submit Order Request:', {
      id: payload.id,
      amount: payload.amount,
      currency: payload.currency,
      callback_url: callbackUrl,
      notification_id: ipnId,
      Environment: PESAPAL_ENVIRONMENT,
      BaseURL: PESAPAL_BASE_URL
    });
    
    const response = await fetch(submitUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('PesaPal Submit Order response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('PesaPal Submit Order error response:', errorData);
      throw new Error(`PesaPal Submit Order failed: ${response.status} ${response.statusText}. Response: ${errorData}`);
    }

    const data = await response.json();
    console.log('PesaPal Submit Order success response:', JSON.stringify(data, null, 2));
    
    if (!data.redirect_url) {
      console.error('❌ No redirect_url in PesaPal response:', data);
      throw new Error('PesaPal did not return a redirect URL. Response: ' + JSON.stringify(data));
    }
    
    return {
      success: true,
      redirectUrl: data.redirect_url,
      orderTrackingId: data.order_tracking_id || orderData.id,
      merchantReference: data.merchant_reference || orderData.id,
      rawResponse: data
    };
  } catch (error) {
    console.error('Error submitting PesaPal order request:', error);
    return {
      success: false,
      error: error.message || 'Failed to submit order request',
      redirectUrl: null,
      orderTrackingId: null,
      merchantReference: null,
      rawResponse: null
    };
  }
}

/**
 * Get transaction status from PesaPal
 * @param {string} orderTrackingId - Order tracking ID from PesaPal
 */
async function getTransactionStatus(orderTrackingId) {
  try {
    const token = await getAccessToken();
    const statusUrl = `${PESAPAL_BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`;
    
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get transaction status: ${response.status} ${response.statusText}. Response: ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting PesaPal transaction status:', error);
    throw error;
  }
}

module.exports = {
  submitOrderRequest,
  getTransactionStatus,
  registerIPN,
  getIPNCallbackUrl
};
