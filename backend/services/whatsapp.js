/**
 * WhatsApp Integration Service
 * 
 * This service provides functionality to send WhatsApp messages to drivers and customers.
 * Currently uses WhatsApp Web links (wa.me) for simplicity. Can be extended to use
 * WhatsApp Business API or other services in the future.
 */

/**
 * Format phone number for WhatsApp (international format with country code)
 * Converts 07xxxxxxxx to 2547xxxxxxxx
 * Leaves 254xxxxxxxx as is
 */
function formatPhoneForWhatsApp(phone) {
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
  
  return cleaned; // Return anyway, let WhatsApp handle validation
}

/**
 * Generate WhatsApp Web link (wa.me) with pre-filled message
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} message - Message to pre-fill
 * @returns {string} WhatsApp Web URL
 */
function generateWhatsAppLink(phoneNumber, message) {
  const formattedPhone = formatPhoneForWhatsApp(phoneNumber);
  if (!formattedPhone) {
    throw new Error('Invalid phone number format');
  }
  
  // URL encode the message
  const encodedMessage = encodeURIComponent(message);
  
  // Generate wa.me link
  return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
}

/**
 * Get custom invitation message from settings or use default
 * @returns {Promise<string>} Custom message template or default
 */
async function getCustomDriverInvitationMessage() {
  try {
    const db = require('../models');
    const setting = await db.Settings.findOne({ 
      where: { key: 'whatsappDriverInvitationMessage' } 
    });
    
    if (setting && setting.value && setting.value.trim()) {
      console.log('📝 Using custom WhatsApp message from settings (length:', setting.value.length, ')');
      console.log('📝 Custom message preview:', setting.value.substring(0, 100));
      return setting.value.trim();
    }
    
    console.log('📝 No custom message found in database, using default message');
    
    // Return default message if no custom message is set
    return `Hello {driverName}! 👋

You've been invited to join the Dial A Drink driver app! 🚗

To get started:
1. Download the driver app
2. Log in using your phone number (the number we have on file)
3. You'll receive an OTP code to verify your account
4. Set up your 4-digit PIN to secure your account

Once logged in, you'll be able to:
✅ View and accept delivery orders
✅ Track your earnings
✅ Update your delivery status
✅ Manage your profile

If you have any questions, please contact us.

Welcome aboard! 🎉`;
  } catch (error) {
    console.error('Error fetching custom WhatsApp message:', error);
    // Return default message on error
    return `Hello {driverName}! 👋

You've been invited to join the Dial A Drink driver app! 🚗

To get started:
1. Download the driver app
2. Log in using your phone number (the number we have on file)
3. You'll receive an OTP code to verify your account
4. Set up your 4-digit PIN to secure your account

Once logged in, you'll be able to:
✅ View and accept delivery orders
✅ Track your earnings
✅ Update your delivery status
✅ Manage your profile

If you have any questions, please contact us.

Welcome aboard! 🎉`;
  }
}

/**
 * Convert markdown links to WhatsApp-friendly format
 * WhatsApp auto-detects URLs, so we convert [text](url) to "text - url" or just "url"
 * @param {string} text - Text with markdown links
 * @returns {string} Text with converted links
 */
function convertMarkdownLinksForWhatsApp(text) {
  // Convert [text](url) to "text - url" format for WhatsApp
  // WhatsApp will auto-detect the URL
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    return `${text} - ${url}`;
  });
}

/**
 * Generate invitation message for drivers
 * @param {string} driverName - Name of the driver
 * @param {string} appUrl - URL to download/access the app (optional)
 * @param {string} customMessage - Optional custom message template (if not provided, will fetch from settings)
 * @returns {Promise<string>} Formatted invitation message
 */
async function generateDriverInvitationMessage(driverName, appUrl = null, customMessage = null) {
  let messageTemplate = customMessage;
  
  // If no custom message provided, fetch from settings
  if (!messageTemplate) {
    messageTemplate = await getCustomDriverInvitationMessage();
  }
  
  console.log('📝 Message template length:', messageTemplate?.length || 0);
  console.log('📝 Message template preview:', messageTemplate?.substring(0, 100) || 'empty');
  
  // Replace {driverName} placeholder with actual driver name
  let message = messageTemplate.replace(/{driverName}/g, driverName);
  
  // Convert markdown links to WhatsApp-friendly format
  message = convertMarkdownLinksForWhatsApp(message);
  
  // Add app URL if provided
  if (appUrl) {
    message = `${message}\n\nDownload the app here: ${appUrl}`;
  }
  
  console.log('📝 Final message length:', message.length);
  console.log('📝 Final message preview:', message.substring(0, 150));
  
  return message;
}

/**
 * Generate invitation message for customers
 * @param {string} customerName - Name of the customer
 * @param {string} appUrl - URL to download/access the app (optional)
 * @returns {string} Formatted invitation message
 */
function generateCustomerInvitationMessage(customerName, appUrl = null) {
  const baseMessage = `Hello ${customerName}! 👋

Thank you for being a valued customer of Dial A Drink! 🍻

We're excited to invite you to use our mobile app for a better ordering experience!

With our app, you can:
✅ Browse our full menu
✅ Place orders easily
✅ Track your orders in real-time
✅ Save your favorite delivery addresses
✅ View your order history
✅ Get exclusive offers and promotions

${appUrl ? `Download the app here: ${appUrl}` : 'Download the app from your app store'}

If you need any assistance, our support team is here to help!

Happy ordering! 🎉`;

  return baseMessage;
}

/**
 * Send WhatsApp invitation to driver
 * This opens WhatsApp Web/App with pre-filled message
 * @param {string} phoneNumber - Driver's phone number
 * @param {string} driverName - Driver's name
 * @param {string} appUrl - Optional app download URL
 * @param {string} customMessage - Optional custom message template
 * @returns {Promise<Object>} Result with WhatsApp link
 */
async function sendDriverInvitation(phoneNumber, driverName, appUrl = null, customMessage = null) {
  try {
    const message = await generateDriverInvitationMessage(driverName, appUrl, customMessage);
    const whatsappLink = generateWhatsAppLink(phoneNumber, message);
    
    return {
      success: true,
      whatsappLink: whatsappLink,
      message: message,
      phoneNumber: formatPhoneForWhatsApp(phoneNumber)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send WhatsApp invitation to customer
 * This opens WhatsApp Web/App with pre-filled message
 * @param {string} phoneNumber - Customer's phone number
 * @param {string} customerName - Customer's name
 * @param {string} appUrl - Optional app download URL
 * @returns {Object} Result with WhatsApp link
 */
function sendCustomerInvitation(phoneNumber, customerName, appUrl = null) {
  try {
    const message = generateCustomerInvitationMessage(customerName, appUrl);
    const whatsappLink = generateWhatsAppLink(phoneNumber, message);
    
    return {
      success: true,
      whatsappLink: whatsappLink,
      message: message,
      phoneNumber: formatPhoneForWhatsApp(phoneNumber)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send custom WhatsApp message
 * @param {string} phoneNumber - Recipient's phone number
 * @param {string} message - Custom message to send
 * @returns {Object} Result with WhatsApp link
 */
function sendCustomMessage(phoneNumber, message) {
  try {
    const whatsappLink = generateWhatsAppLink(phoneNumber, message);
    
    return {
      success: true,
      whatsappLink: whatsappLink,
      message: message,
      phoneNumber: formatPhoneForWhatsApp(phoneNumber)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  formatPhoneForWhatsApp,
  generateWhatsAppLink,
  generateDriverInvitationMessage,
  generateCustomerInvitationMessage,
  sendDriverInvitation,
  sendCustomerInvitation,
  sendCustomMessage
};

