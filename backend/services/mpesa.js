const crypto = require('crypto');

// M-Pesa Production credentials (must be set via environment variables)
const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE;
const MPESA_PASSKEY = process.env.MPESA_PASSKEY;

// Validate required credentials - don't throw during module load, check at runtime
const validateMpesaCredentials = () => {
  if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET || !MPESA_SHORTCODE || !MPESA_PASSKEY) {
    console.error('❌ M-Pesa credentials missing! Please set:');
    console.error('   MPESA_CONSUMER_KEY');
    console.error('   MPESA_CONSUMER_SECRET');
    console.error('   MPESA_SHORTCODE');
    console.error('   MPESA_PASSKEY');
    return false;
  }
  return true;
};
// Determine callback URL based on environment
const getCallbackUrl = () => {
  let callbackUrl = process.env.MPESA_CALLBACK_URL;
  
  // Priority 1: If MPESA_CALLBACK_URL is explicitly set, use it (for ngrok or custom URLs)
  if (callbackUrl) {
    // Validate it's a proper URL
    if (callbackUrl.includes('localhost') || callbackUrl.includes('127.0.0.1')) {
      throw new Error('❌ Localhost callback URL detected. M-Pesa requires a publicly accessible URL. Please set MPESA_CALLBACK_URL to your ngrok URL in .env file.');
    }
    console.log(`✅ Using callback URL from environment: ${callbackUrl}`);
    return callbackUrl;
  }
  
  // Priority 2: Check for ngrok URL in environment (common ngrok env var)
  const ngrokUrl = process.env.NGROK_URL;
  if (ngrokUrl) {
    callbackUrl = `${ngrokUrl}/api/mpesa/callback`;
    console.log(`✅ Using ngrok URL for callbacks: ${callbackUrl}`);
    return callbackUrl;
  }
  
  // Priority 3: Check if we're in production or Cloud Run (cloud-dev)
  // Cloud Run services have NODE_ENV=production or are detected by hostname
  const isCloudRun = process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT;
  if (process.env.NODE_ENV === 'production' || process.env.RENDER || isCloudRun) {
    callbackUrl = 'https://dialadrink-backend-910510650031.us-central1.run.app/api/mpesa/callback';
    console.log(`✅ Using production callback URL: ${callbackUrl}`);
    return callbackUrl;
  }
  
  // Local development: NO FALLBACK - require explicit configuration
  throw new Error('❌ No callback URL configured for local development. Please set MPESA_CALLBACK_URL in .env file to your ngrok URL (e.g., https://your-ngrok-url.ngrok-free.dev/api/mpesa/callback)');
};

// Get callback URL function - call at runtime to ensure environment is loaded
const getMpesaCallbackUrl = () => getCallbackUrl();

const MPESA_ENVIRONMENT = process.env.MPESA_ENVIRONMENT || 'production'; // Default to production

// M-Pesa API endpoints
const MPESA_BASE_URL = MPESA_ENVIRONMENT === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

let accessToken = null;
let tokenExpiry = null;

/**
 * Get M-Pesa access token
 */
async function getAccessToken() {
  try {
    // Check if we have a valid cached token
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
      return accessToken;
    }

    // Validate credentials are set
    if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET) {
      throw new Error('M-Pesa credentials (CONSUMER_KEY and CONSUMER_SECRET) are required');
    }

    const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
    const tokenUrl = `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`;
    
    console.log(`🔑 Requesting M-Pesa access token from: ${MPESA_BASE_URL}`);
    console.log(`📋 Environment: ${MPESA_ENVIRONMENT}`);
    console.log(`🔐 Consumer Key: ${MPESA_CONSUMER_KEY.substring(0, 10)}...`);
    
    const response = await fetch(tokenUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ M-Pesa OAuth Error (${response.status}):`, errorText);
      console.error(`❌ Token URL: ${tokenUrl}`);
      console.error(`❌ Environment: ${MPESA_ENVIRONMENT}`);
      console.error(`❌ Base URL: ${MPESA_BASE_URL}`);
      
      // Provide helpful error message
      if (response.status === 400) {
        throw new Error(`M-Pesa authentication failed (400). This usually means:
1. Credentials are invalid or expired
2. Credentials don't match the environment (sandbox creds with production API or vice versa)
3. Consumer Key or Consumer Secret is incorrect
Current environment: ${MPESA_ENVIRONMENT}, API: ${MPESA_BASE_URL}`);
      }
      throw new Error(`Failed to get access token: ${response.status} ${response.statusText}. Response: ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.access_token) {
      console.error('❌ No access_token in M-Pesa response:', data);
      throw new Error('M-Pesa did not return an access token. Response: ' + JSON.stringify(data));
    }
    
    accessToken = data.access_token;
    // Set expiry to 55 minutes (tokens expire in 1 hour, but we refresh earlier)
    tokenExpiry = Date.now() + (55 * 60 * 1000);
    
    console.log(`✅ M-Pesa access token obtained successfully (expires in 55 minutes)`);
    return accessToken;
  } catch (error) {
    console.error('❌ Error getting M-Pesa access token:', error);
    throw error;
  }
}

/**
 * Generate password for M-Pesa API
 */
function generatePassword() {
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
  const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
  return { password, timestamp };
}

/**
 * Format phone number to M-Pesa format (254XXXXXXXXX)
 */
function formatPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    throw new Error('Phone number is required');
  }

  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Handle different formats
  if (cleaned.startsWith('0')) {
    // Convert 07... to 2547... (replace leading 0 with 254)
    cleaned = '254' + cleaned.substring(1);
  } else if (cleaned.startsWith('254')) {
    // Already in correct format (254XXXXXXXXX)
    cleaned = cleaned;
  } else if (cleaned.startsWith('7') && cleaned.length === 9) {
    // 7XXXXXXXX format (9 digits starting with 7)
    cleaned = '254' + cleaned;
  } else if (cleaned.length === 9 && cleaned.startsWith('7')) {
    // 7XXXXXXXX format (9 digits)
    cleaned = '254' + cleaned;
  } else {
    // If it doesn't match any pattern, try to fix it
    // If it's 10 digits starting with 0, remove the 0 and add 254
    if (cleaned.length === 10 && cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    } else {
      // For other cases, assume it needs 254 prefix if it's 9 digits
      if (cleaned.length === 9) {
        cleaned = '254' + cleaned;
      }
    }
  }
  
  // Ensure it's 12 digits (254 + 9 digits)
  if (cleaned.length !== 12 || !cleaned.startsWith('254')) {
    throw new Error(`Invalid phone number format: ${phone}. Expected format: 0712345678 or 254712345678. Got: ${cleaned} (${cleaned.length} digits)`);
  }
  
  return cleaned;
}

/**
 * Initiate M-Pesa STK Push
 * @param {string} phoneNumber - Customer phone number (Safaricom)
 * @param {number} amount - Amount to charge
 * @param {string} accountReference - Reference for the transaction
 * @param {string} transactionDesc - Description of the transaction
 */
async function initiateSTKPush(phoneNumber, amount, accountReference, transactionDesc) {
  // Validate credentials at runtime
  if (!validateMpesaCredentials()) {
    throw new Error('M-Pesa credentials are required. Please set environment variables: MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY');
  }
  
  try {
    // Format phone number first to catch any formatting errors early
    let formattedPhone;
    try {
      formattedPhone = formatPhoneNumber(phoneNumber);
      console.log(`Phone number formatted: ${phoneNumber} -> ${formattedPhone}`);
    } catch (formatError) {
      console.error('Phone number formatting error:', formatError);
      throw new Error(`Invalid phone number: ${formatError.message}`);
    }

    const token = await getAccessToken();
    const { password, timestamp } = generatePassword();

    // Get callback URL at runtime
    const callbackUrl = getMpesaCallbackUrl();
    
    const payload = {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.ceil(amount), // M-Pesa requires integer amounts
      PartyA: formattedPhone,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: accountReference,
      TransactionDesc: transactionDesc
    };

    console.log('M-Pesa STK Push Request:', {
      BusinessShortCode: MPESA_SHORTCODE,
      PhoneNumber: formattedPhone,
      Amount: Math.ceil(amount),
      CallBackURL: callbackUrl,
      AccountReference: accountReference,
      Environment: MPESA_ENVIRONMENT,
      BaseURL: MPESA_BASE_URL
    });
    
    // Validate callback URL format
    if (!callbackUrl.startsWith('https://') && !callbackUrl.startsWith('http://')) {
      throw new Error(`Invalid callback URL format: ${callbackUrl}. Must start with http:// or https://`);
    }
    
    // Ensure callback URL is publicly accessible (not localhost)
    if (callbackUrl.includes('localhost') || callbackUrl.includes('127.0.0.1')) {
      throw new Error(`Callback URL cannot be localhost: ${callbackUrl}. M-Pesa requires a publicly accessible URL.`);
    }

    console.log('Sending STK Push request to M-Pesa...');
    const response = await fetch(`${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('M-Pesa STK Push response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('M-Pesa STK Push error response:', errorData);
      throw new Error(`M-Pesa STK Push failed: ${response.status} ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log('M-Pesa STK Push success response:', JSON.stringify(data, null, 2));
    console.log('ResponseCode:', data.ResponseCode);
    console.log('CheckoutRequestID:', data.CheckoutRequestID);
    console.log('CustomerMessage:', data.CustomerMessage);
    console.log('MerchantRequestID:', data.MerchantRequestID);
    return data;
  } catch (error) {
    console.error('Error initiating M-Pesa STK Push:', error);
    throw error;
  }
}

/**
 * Check M-Pesa transaction status
 */
async function checkTransactionStatus(checkoutRequestID) {
  try {
    const token = await getAccessToken();
    const { password, timestamp } = generatePassword();

    const payload = {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestID
    };

    const response = await fetch(`${MPESA_BASE_URL}/mpesa/stkpushquery/v1/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Failed to check transaction status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error checking transaction status:', error);
    throw error;
  }
}

/**
 * Initiate M-Pesa B2C (Business to Customer) payment
 * This is used to send money from the business to customers/drivers
 * @param {string} phoneNumber - Recipient phone number (Safaricom)
 * @param {number} amount - Amount to send
 * @param {string} remarks - Remarks/description for the transaction
 * @param {string} occasion - Occasion description (optional)
 */
async function initiateB2C(phoneNumber, amount, remarks = 'Driver withdrawal', occasion = 'Withdrawal') {
  // Validate credentials at runtime
  if (!validateMpesaCredentials()) {
    throw new Error('M-Pesa credentials are required. Please set environment variables: MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY');
  }
  
  try {
    // Format phone number first
    let formattedPhone;
    try {
      formattedPhone = formatPhoneNumber(phoneNumber);
      console.log(`Phone number formatted for B2C: ${phoneNumber} -> ${formattedPhone}`);
    } catch (formatError) {
      console.error('Phone number formatting error:', formatError);
      throw new Error(`Invalid phone number: ${formatError.message}`);
    }

    const token = await getAccessToken();
    
    // Get B2C callback URL
    const getB2CCallbackUrl = () => {
      let callbackUrl = process.env.MPESA_B2C_CALLBACK_URL;
      
      if (callbackUrl) {
        if (callbackUrl.includes('localhost') || callbackUrl.includes('127.0.0.1')) {
          throw new Error('❌ Localhost B2C callback URL detected. M-Pesa requires a publicly accessible URL. Please set MPESA_B2C_CALLBACK_URL to your ngrok URL in .env file.');
        }
        console.log(`✅ Using B2C callback URL from environment: ${callbackUrl}`);
        return callbackUrl;
      }
      
      const ngrokUrl = process.env.NGROK_URL;
      if (ngrokUrl) {
        callbackUrl = `${ngrokUrl}/api/mpesa/b2c-callback`;
        console.log(`✅ Using ngrok URL for B2C callbacks: ${callbackUrl}`);
        return callbackUrl;
      }
      
      if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
        callbackUrl = 'https://dialadrink-backend-910510650031.us-central1.run.app/api/mpesa/b2c-callback';
        console.log(`✅ Using production B2C callback URL: ${callbackUrl}`);
        return callbackUrl;
      }
      
      throw new Error('❌ No B2C callback URL configured for local development. Please set MPESA_B2C_CALLBACK_URL in .env file to your ngrok URL.');
    };

    const callbackUrl = getB2CCallbackUrl();
    
    // Generate initiator name and password
    // Note: For B2C, you need Security Credential (encrypted password)
    // This is different from STK push. You'll need to set MPESA_SECURITY_CREDENTIAL in env
    const MPESA_INITIATOR_NAME = process.env.MPESA_INITIATOR_NAME || 'testapi';
    const MPESA_SECURITY_CREDENTIAL = process.env.MPESA_SECURITY_CREDENTIAL;
    const MPESA_B2C_SHORTCODE = process.env.MPESA_B2C_SHORTCODE || MPESA_SHORTCODE;
    
    if (!MPESA_SECURITY_CREDENTIAL) {
      throw new Error('MPESA_SECURITY_CREDENTIAL is required for B2C transactions. Please set it in environment variables.');
    }

    // Generate command ID and timeout URL
    const commandId = 'BusinessPayment'; // For sending money to customer
    const timeoutUrl = callbackUrl; // Same as callback URL for simplicity
    
    const payload = {
      InitiatorName: MPESA_INITIATOR_NAME,
      SecurityCredential: MPESA_SECURITY_CREDENTIAL,
      CommandID: commandId,
      Amount: Math.ceil(amount), // M-Pesa requires integer amounts
      PartyA: MPESA_B2C_SHORTCODE,
      PartyB: formattedPhone,
      Remarks: remarks,
      QueueTimeOutURL: timeoutUrl,
      ResultURL: callbackUrl,
      Occasion: occasion
    };

    console.log('M-Pesa B2C Request:', {
      InitiatorName: MPESA_INITIATOR_NAME,
      CommandID: commandId,
      PartyA: MPESA_B2C_SHORTCODE,
      PartyB: formattedPhone,
      Amount: Math.ceil(amount),
      ResultURL: callbackUrl,
      Environment: MPESA_ENVIRONMENT,
      BaseURL: MPESA_BASE_URL
    });
    
    // Validate callback URL format
    if (!callbackUrl.startsWith('https://') && !callbackUrl.startsWith('http://')) {
      throw new Error(`Invalid callback URL format: ${callbackUrl}. Must start with http:// or https://`);
    }
    
    if (callbackUrl.includes('localhost') || callbackUrl.includes('127.0.0.1')) {
      throw new Error(`Callback URL cannot be localhost: ${callbackUrl}. M-Pesa requires a publicly accessible URL.`);
    }

    console.log('Sending B2C request to M-Pesa...');
    const response = await fetch(`${MPESA_BASE_URL}/mpesa/b2c/v1/paymentrequest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('M-Pesa B2C response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('M-Pesa B2C error response:', errorData);
      throw new Error(`M-Pesa B2C failed: ${response.status} ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log('M-Pesa B2C success response:', JSON.stringify(data, null, 2));
    console.log('ResponseCode:', data.ResponseCode);
    console.log('OriginatorConversationID:', data.OriginatorConversationID);
    console.log('ConversationID:', data.ConversationID);
    console.log('ResponseDescription:', data.ResponseDescription);
    
    return {
      success: data.ResponseCode === '0',
      responseCode: data.ResponseCode,
      responseDescription: data.ResponseDescription,
      originatorConversationID: data.OriginatorConversationID,
      conversationID: data.ConversationID,
      data: data
    };
  } catch (error) {
    console.error('Error initiating M-Pesa B2C:', error);
    throw error;
  }
}

module.exports = {
  initiateSTKPush,
  checkTransactionStatus,
  formatPhoneNumber,
  getMpesaCallbackUrl,
  initiateB2C
};

