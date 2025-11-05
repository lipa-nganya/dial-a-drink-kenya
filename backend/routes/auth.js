const express = require('express');
const router = express.Router();
const db = require('../models');
const smsService = require('../services/sms');
const emailService = require('../services/email');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * Generate a 6-digit OTP code (for customers)
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate a 4-digit OTP code (for drivers)
 */
function generateDriverOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Send OTP for phone login
 * POST /api/auth/send-otp
 */
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    // Clean phone number
    const cleanedPhone = phone.replace(/\D/g, '');
    
    // Check if phone number has associated orders (optional - allow login even without orders)
    const order = await db.Order.findOne({
      where: {
        customerPhone: {
          [db.Sequelize.Op.like]: `%${cleanedPhone}%`
        }
      },
      order: [['createdAt', 'DESC']]
    });

    // If no orders exist, still allow OTP (customer might be placing first order)
    // But we'll need customer name from somewhere - check if customer record exists
    let customerName = null;
    if (order) {
      customerName = order.customerName;
    } else {
      // Check if customer record exists
      const existingCustomer = await db.Customer.findOne({
        where: {
          [db.Sequelize.Op.or]: [
            { phone: cleanedPhone },
            { username: cleanedPhone }
          ]
        }
      });
      if (existingCustomer) {
        customerName = existingCustomer.customerName;
      }
    }

    // Check if this is a driver phone number
    // Try exact match first, then try with different formats
    let driver = await db.Driver.findOne({
      where: { phoneNumber: cleanedPhone }
    });
    
    // If not found, try with different phone formats
    if (!driver) {
      // Try with 0 prefix
      const phoneWithZero = '0' + cleanedPhone.substring(3);
      driver = await db.Driver.findOne({
        where: { phoneNumber: phoneWithZero }
      });
    }
    
    if (!driver) {
      // Try without country code
      const phoneWithoutCode = cleanedPhone.substring(3);
      driver = await db.Driver.findOne({
        where: { phoneNumber: phoneWithoutCode }
      });
    }
    
    // Generate OTP - 4 digits for drivers, 6 digits for customers
    const isDriver = !!driver;
    const otpCode = isDriver ? generateDriverOTP() : generateOTP();
    const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3 hours from now
    
    console.log(`📱 ${isDriver ? 'Driver' : 'Customer'} OTP generated: ${otpCode.length} digits`);
    if (driver) {
      console.log(`📱 Driver found: ${driver.name} (${driver.phoneNumber})`);
    }

    // Invalidate any existing unused OTPs for this phone number
    await db.Otp.update(
      { isUsed: true },
      {
        where: {
          phoneNumber: cleanedPhone,
          isUsed: false
        }
      }
    );

    // Create new OTP record
    const otp = await db.Otp.create({
      phoneNumber: cleanedPhone,
      otpCode: otpCode,
      expiresAt: expiresAt,
      isUsed: false,
      attempts: 0
    });

    // Send OTP via SMS (always send, not subject to admin SMS settings)
    const smsResult = await smsService.sendOTP(cleanedPhone, otpCode);

    // For drivers, always return success even if SMS fails
    // The OTP is generated and stored, admin can provide it from dashboard
    if (isDriver) {
      if (!smsResult.success) {
        console.error('Failed to send OTP to driver:', smsResult.error);
        console.log(`📱 Driver OTP generated (SMS failed): ${otpCode} - Admin can provide from dashboard`);
        
        // For drivers, always return success - they can get OTP from admin
        return res.status(200).json({
          success: true,
          message: 'OTP generated. Admin will provide the code.',
          phoneNumber: cleanedPhone,
          expiresAt: expiresAt.toISOString(),
          smsFailed: true,
          smsError: smsResult.error
        });
      }
      
      // SMS sent successfully for driver
      return res.status(200).json({
        success: true,
        message: 'OTP sent successfully',
        phoneNumber: cleanedPhone,
        expiresAt: expiresAt.toISOString()
      });
    }

    // For customers, handle SMS failures differently
    if (!smsResult.success) {
      console.error('Failed to send OTP:', smsResult.error);
      console.error('OTP Code generated (for testing):', otpCode);
      
      // If it's a credit issue, return a helpful error
      if (smsResult.code === 402 || smsResult.requiresTopUp) {
        return res.status(402).json({
          success: false,
          error: 'SMS service account has insufficient credits. OTP could not be sent. Please contact administrator.',
          requiresTopUp: true,
          otpCode: otpCode,
          note: 'OTP has been generated and stored in database. You can verify it manually if needed.'
        });
      }
      
      // For other errors, still return success but with a warning
      return res.status(200).json({
        success: false,
        error: smsResult.error || 'Failed to send OTP via SMS',
        note: 'OTP has been generated and stored in database. Please contact administrator for the code.'
      });
    }

    // Successfully sent OTP to customer
    res.status(200).json({
      success: true,
      message: 'OTP sent successfully. Please check your phone.',
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send OTP. Please try again.'
    });
  }
});

/**
 * Verify OTP for phone login
 * POST /api/auth/verify-otp
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otpCode, otp: otpFromBody } = req.body; // Accept both 'otpCode' and 'otp' for compatibility

    // Use otpCode if provided, otherwise fall back to otp
    const codeToVerify = otpCode || otpFromBody;

    if (!phone || !codeToVerify) {
      console.error('OTP verification error - missing fields:', {
        phone: phone ? 'present' : 'missing',
        otpCode: otpCode ? 'present' : 'missing',
        otp: otpFromBody ? 'present' : 'missing',
        body: req.body
      });
      return res.status(400).json({
        success: false,
        error: 'Phone number and OTP code are required'
      });
    }

    const cleanedPhone = phone.replace(/\D/g, '');

    // Find the most recent unused OTP for this phone
    const otpRecord = await db.Otp.findOne({
      where: {
        phoneNumber: cleanedPhone,
        isUsed: false
      },
      order: [['createdAt', 'DESC']]
    });

    if (!otpRecord) {
      return res.status(404).json({
        success: false,
        error: 'No OTP found. Please request a new OTP.'
      });
    }

    // Check if OTP has expired
    if (new Date() > new Date(otpRecord.expiresAt)) {
      await otpRecord.update({ isUsed: true });
      return res.status(400).json({
        success: false,
        error: 'OTP has expired. Please request a new one.'
      });
    }

    // Check if OTP code matches
    const cleanedOtpCode = (codeToVerify || '').trim();
    if (otpRecord.otpCode !== cleanedOtpCode) {
      // Increment attempts
      await otpRecord.update({ attempts: otpRecord.attempts + 1 });
      
      // Block after 5 failed attempts
      if (otpRecord.attempts + 1 >= 5) {
        await otpRecord.update({ isUsed: true });
        return res.status(400).json({
          success: false,
          error: 'Too many failed attempts. Please request a new OTP.'
        });
      }

      return res.status(400).json({
        success: false,
        error: 'Invalid OTP code. Please try again.',
        remainingAttempts: 5 - (otpRecord.attempts + 1)
      });
    }

    // Mark OTP as used
    await otpRecord.update({ isUsed: true });

    // Check if this is a driver phone number FIRST
    let driver = await db.Driver.findOne({
      where: { phoneNumber: cleanedPhone }
    });
    
    // If not found, try with different phone formats
    if (!driver) {
      // Try with 0 prefix
      if (cleanedPhone.startsWith('254')) {
        const phoneWithZero = '0' + cleanedPhone.substring(3);
        driver = await db.Driver.findOne({
          where: { phoneNumber: phoneWithZero }
        });
      }
    }
    
    if (!driver) {
      // Try without country code
      if (cleanedPhone.startsWith('254')) {
        const phoneWithoutCode = cleanedPhone.substring(3);
        driver = await db.Driver.findOne({
          where: { phoneNumber: phoneWithoutCode }
        });
      }
    }
    
    if (!driver && !cleanedPhone.startsWith('254') && cleanedPhone.length === 9) {
      // Try adding 254 prefix
      const phoneWith254 = '254' + cleanedPhone;
      driver = await db.Driver.findOne({
        where: { phoneNumber: phoneWith254 }
      });
    }
    
    if (!driver && cleanedPhone.startsWith('0')) {
      // Try with 0 prefix then add 254
      const phoneWithoutZero = cleanedPhone.substring(1);
      const phoneWith254 = '254' + phoneWithoutZero;
      driver = await db.Driver.findOne({
        where: { phoneNumber: phoneWith254 }
      });
    }
    
    // If this is a driver, return simple success response
    if (driver) {
      console.log(`✅ Driver OTP verified for: ${driver.name} (${driver.phoneNumber})`);
      return res.json({
        success: true,
        isDriver: true,
        driver: {
          id: driver.id,
          name: driver.name,
          phoneNumber: driver.phoneNumber,
          status: driver.status
        }
      });
    }

    // Continue with customer logic if not a driver
    // Find customer's orders (if any)
    const orders = await db.Order.findAll({
      where: {
        customerPhone: {
          [db.Sequelize.Op.like]: `%${cleanedPhone}%`
        }
      },
      include: [{
        model: db.OrderItem,
        as: 'items',
        include: [{
          model: db.Drink,
          as: 'drink'
        }]
      }],
      order: [['createdAt', 'DESC']]
    });

    // Get customer info from order or create new customer record
    let customerEmail = null;
    let customerName = null;
    
    if (orders.length > 0) {
      const mostRecentOrder = orders[0];
      customerEmail = mostRecentOrder.customerEmail || null;
      customerName = mostRecentOrder.customerName;
    } else {
      // No orders yet - check if customer record exists
      const existingCustomer = await db.Customer.findOne({
        where: {
          [db.Sequelize.Op.or]: [
            { phone: cleanedPhone },
            { username: cleanedPhone }
          ]
        }
      });
      if (existingCustomer) {
        customerEmail = existingCustomer.email;
        customerName = existingCustomer.customerName;
      } else {
        // New customer - create record with minimal info
        customerName = 'Customer'; // Default name
      }
    }

    // Check if customer record exists
    let customer = await db.Customer.findOne({
      where: {
        [db.Sequelize.Op.or]: [
          { phone: cleanedPhone },
          { email: customerEmail },
          { username: cleanedPhone },
          { username: customerEmail }
        ]
      }
    });

    // Create or update customer record
    if (!customer) {
      customer = await db.Customer.create({
        phone: cleanedPhone,
        email: customerEmail,
        username: cleanedPhone, // Use phone as username by default
        customerName: customerName,
        hasSetPassword: false
      });
    } else {
      // Update customer info if needed
      await customer.update({
        phone: customer.phone || cleanedPhone,
        email: customer.email || customerEmail,
        customerName: customer.customerName || customerName
      });
    }

    // Return customer data - indicate if password needs to be set
    res.json({
      success: true,
      customer: {
        id: customer.id,
        phone: cleanedPhone,
        email: customerEmail,
        customerName: customerName,
        username: customer.username,
        hasSetPassword: customer.hasSetPassword,
        orders: orders
      },
      requiresPasswordSetup: !customer.hasSetPassword
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify OTP. Please try again.'
    });
  }
});

/**
 * Send email confirmation link
 * POST /api/auth/send-email-confirmation
 */
router.post('/send-email-confirmation', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required'
      });
    }

    // Check if email has associated orders (optional - allow login even without orders)
    const order = await db.Order.findOne({
      where: {
        customerEmail: email
      },
      order: [['createdAt', 'DESC']]
    });

    // If no orders exist, still allow email confirmation (customer might be placing first order)
    // Check if customer record exists
    let customerName = null;
    if (order) {
      customerName = order.customerName;
    } else {
      const existingCustomer = await db.Customer.findOne({
        where: {
          [db.Sequelize.Op.or]: [
            { email: email },
            { username: email }
          ]
        }
      });
      if (existingCustomer) {
        customerName = existingCustomer.customerName;
      }
    }

    // Generate confirmation token
    const token = emailService.generateEmailToken();
    const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3 hours from now

    // Invalidate any existing unused tokens for this email
    await db.EmailConfirmation.update(
      { isUsed: true },
      {
        where: {
          email: email,
          isUsed: false
        }
      }
    );

    // Create new email confirmation record
    const emailConfirmation = await db.EmailConfirmation.create({
      email: email,
      token: token,
      expiresAt: expiresAt,
      isUsed: false
    });

    // Send email confirmation link
    const emailResult = await emailService.sendEmailConfirmation(email, token);

    if (!emailResult.success) {
      console.error('Failed to send email:', emailResult.error);
      // Log detailed error for debugging
      console.error('Email error details:', {
        error: emailResult.error,
        email: email,
        smtpConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
      });
      
      // Don't fail the request - allow user to continue without email
      // Return success but indicate email wasn't sent
      return res.status(200).json({
        success: false,
        message: 'Email confirmation could not be sent. You can continue without logging in.',
        error: emailResult.error || 'Email service temporarily unavailable',
        allowContinue: true
      });
    }

    res.json({
      success: true,
      message: 'Confirmation email sent. Please check your inbox.',
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    console.error('Error sending email confirmation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send confirmation email. Please try again.'
    });
  }
});

/**
 * Verify email confirmation token
 * GET /api/auth/verify-email?token=...
 */
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Verification token is required'
      });
    }

    // Find the email confirmation record
    const emailConfirmation = await db.EmailConfirmation.findOne({
      where: {
        token: token,
        isUsed: false
      }
    });

    if (!emailConfirmation) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired verification token'
      });
    }

    // Check if token has expired
    if (new Date() > new Date(emailConfirmation.expiresAt)) {
      await emailConfirmation.update({ isUsed: true });
      return res.status(400).json({
        success: false,
        error: 'Verification token has expired. Please request a new one.'
      });
    }

    // Mark token as used
    await emailConfirmation.update({ isUsed: true });

    // Find customer's orders (if any)
    const orders = await db.Order.findAll({
      where: {
        customerEmail: emailConfirmation.email
      },
      include: [{
        model: db.OrderItem,
        as: 'items',
        include: [{
          model: db.Drink,
          as: 'drink'
        }]
      }],
      order: [['createdAt', 'DESC']]
    });

    // Get customer info from order or create new customer record
    let customerPhone = null;
    let customerName = null;
    
    if (orders.length > 0) {
      const mostRecentOrder = orders[0];
      customerPhone = mostRecentOrder.customerPhone || null;
      customerName = mostRecentOrder.customerName;
    } else {
      // No orders yet - check if customer record exists
      const existingCustomer = await db.Customer.findOne({
        where: {
          [db.Sequelize.Op.or]: [
            { email: emailConfirmation.email },
            { username: emailConfirmation.email }
          ]
        }
      });
      if (existingCustomer) {
        customerPhone = existingCustomer.phone;
        customerName = existingCustomer.customerName;
      } else {
        // New customer - create record with minimal info
        customerName = 'Customer'; // Default name
      }
    }

    // Check if customer record exists
    let customer = await db.Customer.findOne({
      where: {
        [db.Sequelize.Op.or]: [
          { email: emailConfirmation.email },
          { phone: customerPhone },
          { username: emailConfirmation.email },
          { username: customerPhone }
        ]
      }
    });

    // Create or update customer record
    if (!customer) {
      customer = await db.Customer.create({
        email: emailConfirmation.email,
        phone: customerPhone,
        username: emailConfirmation.email, // Use email as username by default
        customerName: customerName,
        hasSetPassword: false
      });
    } else {
      // Update customer info if needed
      await customer.update({
        email: customer.email || emailConfirmation.email,
        phone: customer.phone || customerPhone,
        customerName: customer.customerName || customerName
      });
    }

    // Return customer data - indicate if password needs to be set
    res.json({
      success: true,
      customer: {
        id: customer.id,
        email: emailConfirmation.email,
        phone: customerPhone,
        customerName: customerName,
        username: customer.username,
        hasSetPassword: customer.hasSetPassword,
        orders: orders
      },
      requiresPasswordSetup: !customer.hasSetPassword
    });
  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify email. Please try again.'
    });
  }
});

/**
 * Set password for customer (after first-time OTP/email verification)
 * POST /api/auth/set-password
 */
router.post('/set-password', async (req, res) => {
  try {
    const { customerId, username, password } = req.body;

    if (!customerId || !username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID, username, and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    // Find customer
    const customer = await db.Customer.findByPk(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update customer with password
    await customer.update({
      password: hashedPassword,
      username: username, // Save username (email or phone)
      hasSetPassword: true
    });

    res.json({
      success: true,
      message: 'Password set successfully'
    });
  } catch (error) {
    console.error('Error setting password:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set password. Please try again.'
    });
  }
});

/**
 * Login with password (for returning customers)
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    // Find customer by username (can be email or phone)
    const customer = await db.Customer.findOne({
      where: {
        username: username
      }
    });

    if (!customer) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    // Check if password is set
    if (!customer.hasSetPassword || !customer.password) {
      return res.status(400).json({
        success: false,
        error: 'Password not set. Please use OTP or email verification to set your password first.'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, customer.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    // Find customer's orders
    const orders = await db.Order.findAll({
      where: {
        [db.Sequelize.Op.or]: [
          { customerEmail: customer.email },
          { customerPhone: customer.phone }
        ]
      },
      include: [{
        model: db.OrderItem,
        as: 'items',
        include: [{
          model: db.Drink,
          as: 'drink'
        }]
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      customer: {
        id: customer.id,
        email: customer.email,
        phone: customer.phone,
        customerName: customer.customerName,
        username: customer.username,
        orders: orders
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log in. Please try again.'
    });
  }
});

/**
 * Check if customer has password set
 * POST /api/auth/check-password-status
 */
router.post('/check-password-status', async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        error: 'Email or phone number is required'
      });
    }

    const cleanedPhone = phone ? phone.replace(/\D/g, '') : null;

    // Find customer
    const customer = await db.Customer.findOne({
      where: {
        [db.Sequelize.Op.or]: [
          email ? { email: email } : null,
          cleanedPhone ? { phone: cleanedPhone } : null,
          email ? { username: email } : null,
          cleanedPhone ? { username: cleanedPhone } : null
        ].filter(Boolean)
      }
    });

    if (!customer) {
      return res.json({
        success: true,
        hasPassword: false,
        requiresSetup: true
      });
    }

    res.json({
      success: true,
      hasPassword: customer.hasSetPassword || false,
      requiresSetup: !customer.hasSetPassword,
      username: customer.username
    });
  } catch (error) {
    console.error('Error checking password status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check password status'
    });
  }
});

module.exports = router;

