const axios = require('axios');

/**
 * Format phone number for Kenyan numbers
 * Converts 07xxxxxxxx to 2547xxxxxxxx
 * Leaves 254xxxxxxxx as is
 */
function formatPhoneNumber(phone) {
  if (!phone) return null;
  
  // Remove any spaces, dashes, or special characters
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // If starts with 0, replace with 254
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.substring(1);
  }
  
  // If doesn't start with 254, add it
  if (!cleaned.startsWith('254')) {
    cleaned = '254' + cleaned;
  }
  
  // Remove any non-digit characters
  cleaned = cleaned.replace(/\D/g, '');
  
  // Ensure it's a valid Kenyan number format (254xxxxxxxxx)
  if (cleaned.length === 12 && cleaned.startsWith('254')) {
    return cleaned;
  }
  
  // If format is invalid, try to fix common issues
  if (cleaned.length === 13 && cleaned.startsWith('254')) {
    return cleaned; // Some numbers might have an extra digit
  }
  
  console.warn(`Invalid phone number format: ${phone} -> ${cleaned}`);
  return cleaned; // Return anyway, let API handle validation
}

/**
 * Send SMS using Advanta SMS API
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} message - SMS message (must be GSM7 compatible)
 * @returns {Promise<Object>} Response from SMS API
 */
async function sendSMS(phoneNumber, message) {
  try {
    const apiKey = process.env.ADVANTA_API_KEY || '172172cbc7c1e27c9447c94a8ea4a34a';
    const partnerID = process.env.ADVANTA_PARTNER_ID || '14944';
    const shortcode = process.env.ADVANTA_SENDER_ID || 'AdvantaSMS';
    // Advanta API base URL - can be configured via environment variable
    const baseUrl = process.env.ADVANTA_API_URL || 'https://quicksms.advantasms.com';
    
    // Format phone number
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    if (!formattedPhone) {
      throw new Error(`Invalid phone number: ${phoneNumber}`);
    }
    
    // Prepare request payload
    const payload = {
      apikey: apiKey,
      partnerID: partnerID,
      message: message,
      shortcode: shortcode,
      mobile: formattedPhone
    };
    
    console.log(`📱 Sending SMS to ${formattedPhone} via Advanta API`);
    
    // Send SMS via POST
    const response = await axios.post(
      `${baseUrl}/api/services/sendsms`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      }
    );
    
    // Check response
    if (response.data && response.data.responses) {
      const smsResponse = response.data.responses[0];
      
      if (smsResponse['response-code'] === 200) {
        console.log(`✅ SMS sent successfully to ${formattedPhone}. Message ID: ${smsResponse.messageid}`);
        return {
          success: true,
          messageId: smsResponse.messageid,
          mobile: smsResponse.mobile,
          networkId: smsResponse.networkid
        };
      } else {
        console.error(`❌ SMS failed for ${formattedPhone}:`, smsResponse['response-description']);
        return {
          success: false,
          error: smsResponse['response-description'],
          code: smsResponse['response-code']
        };
      }
    } else if (response.data && response.data['response-code']) {
      // Error response format
      console.error(`❌ SMS API error:`, response.data['response-description']);
      return {
        success: false,
        error: response.data['response-description'],
        code: response.data['response-code']
      };
    } else {
      console.error(`❌ Unexpected SMS API response:`, response.data);
      return {
        success: false,
        error: 'Unexpected response format',
        data: response.data
      };
    }
  } catch (error) {
    console.error(`❌ Error sending SMS to ${phoneNumber}:`, error.message);
    
    if (error.response) {
      // API returned error response
      console.error('API error response:', error.response.data);
      return {
        success: false,
        error: error.response.data?.message || error.response.statusText,
        code: error.response.status
      };
    } else if (error.request) {
      // Request made but no response
      console.error('No response from SMS API');
      return {
        success: false,
        error: 'No response from SMS service',
        code: 'TIMEOUT'
      };
    } else {
      // Other error
      return {
        success: false,
        error: error.message
      };
    }
  }
}

/**
 * Send SMS to multiple recipients
 * @param {Array<string>} phoneNumbers - Array of phone numbers
 * @param {string} message - SMS message
 * @returns {Promise<Array>} Array of results for each recipient
 */
async function sendBulkSMS(phoneNumbers, message) {
  const results = [];
  
  for (const phone of phoneNumbers) {
    try {
      const result = await sendSMS(phone, message);
      results.push({
        phone,
        ...result
      });
      
      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      results.push({
        phone,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}

/**
 * Send OTP using Advanta SMS API (sendotp endpoint)
 * This endpoint is specifically for OTP and transactional messages
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} otpCode - OTP code to send
 * @returns {Promise<Object>} Response from SMS API
 */
async function sendOTP(phoneNumber, otpCode) {
  try {
    const apiKey = process.env.ADVANTA_API_KEY || '172172cbc7c1e27c9447c94a8ea4a34a';
    const partnerID = process.env.ADVANTA_PARTNER_ID || '14944';
    const shortcode = process.env.ADVANTA_SENDER_ID || 'AdvantaSMS';
    const baseUrl = process.env.ADVANTA_API_URL || 'https://quicksms.advantasms.com';
    
    // Format phone number
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    if (!formattedPhone) {
      throw new Error(`Invalid phone number: ${phoneNumber}`);
    }
    
    // OTP message with 3-hour validity
    const message = `Your Dial A Drink login code is: ${otpCode}. This code is valid for 3 hours. Do not share this code with anyone.`;
    
    // Prepare request payload for sendotp endpoint
    const payload = {
      apikey: apiKey,
      partnerID: partnerID,
      message: message,
      shortcode: shortcode,
      mobile: formattedPhone
    };
    
    console.log(`📱 Sending OTP to ${formattedPhone} via Advanta OTP API`);
    console.log(`📱 API URL: ${baseUrl}/api/services/sendotp`);
    console.log(`📱 Payload:`, JSON.stringify(payload, null, 2));
    console.log(`📱 API Key configured: ${apiKey ? 'Yes' : 'No'}`);
    console.log(`📱 Partner ID: ${partnerID}`);
    console.log(`📱 Sender ID: ${shortcode}`);
    
    // Send OTP via POST to sendotp endpoint
    const response = await axios.post(
      `${baseUrl}/api/services/sendotp`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // Increased to 30 seconds
      }
    );
    
    console.log(`📱 Advanta API Response Status: ${response.status}`);
    console.log(`📱 Advanta API Response Data:`, JSON.stringify(response.data, null, 2));
    
    // Check response
    if (response.data && response.data.responses) {
      const otpResponse = response.data.responses[0];
      
      if (otpResponse['response-code'] === 200) {
        console.log(`✅ OTP sent successfully to ${formattedPhone}. Message ID: ${otpResponse.messageid}`);
        return {
          success: true,
          messageId: otpResponse.messageid,
          mobile: otpResponse.mobile,
          networkId: otpResponse.networkid
        };
      } else {
        console.error(`❌ OTP failed for ${formattedPhone}:`, otpResponse['response-description']);
        return {
          success: false,
          error: otpResponse['response-description'],
          code: otpResponse['response-code']
        };
      }
    } else if (response.data && response.data['response-code']) {
      // Error response format
      console.error(`❌ OTP API error:`, response.data['response-description']);
      return {
        success: false,
        error: response.data['response-description'],
        code: response.data['response-code']
      };
    } else {
      console.error(`❌ Unexpected OTP API response:`, response.data);
      return {
        success: false,
        error: 'Unexpected response format',
        data: response.data
      };
    }
  } catch (error) {
    console.error(`❌ Error sending OTP to ${phoneNumber}:`, error.message);
    
    if (error.response) {
      // API returned error response
      const errorData = error.response.data || {};
      const errorMessage = errorData.message || errorData.error || error.response.statusText;
      const statusCode = error.response.status;
      
      console.error('API error response:', errorData);
      console.error('API error status:', statusCode);
      
      // Special handling for 402 (insufficient credits)
      if (statusCode === 402) {
        console.error('⚠️  ADVANTA ACCOUNT HAS INSUFFICIENT CREDITS!');
        console.error('⚠️  Please top up your Advanta SMS account to continue sending OTPs.');
        return {
          success: false,
          error: 'SMS service account has insufficient credits. Please contact administrator.',
          code: 402,
          details: errorMessage,
          requiresTopUp: true
        };
      }
      
      return {
        success: false,
        error: errorMessage,
        code: statusCode,
        details: errorData
      };
    } else if (error.request) {
      // Request made but no response
      console.error('No response from OTP API');
      return {
        success: false,
        error: 'No response from SMS service. Please check your internet connection.',
        code: 'TIMEOUT'
      };
    } else {
      // Other error
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = {
  sendSMS,
  sendBulkSMS,
  sendOTP,
  formatPhoneNumber
};

