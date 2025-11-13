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
 * Normalize a customer phone number to a canonical format (Kenyan numbers -> 2547...)
 */
function normalizeCustomerPhone(phone) {
  if (!phone) {
    return null;
  }

  const digits = phone.replace(/\D/g, '');
  if (!digits) {
    return null;
  }

  if (digits.startsWith('254') && digits.length === 12) {
    return digits;
  }

  if (digits.startsWith('0') && digits.length === 10) {
    return `254${digits.slice(1)}`;
  }

  if (digits.length === 9 && digits.startsWith('7')) {
    return `254${digits}`;
  }

  if (digits.length === 9 && !digits.startsWith('7')) {
    return digits;
  }

  return digits;
}

/**
 * Build a list of phone variants to search against when looking up customers
 */
function buildPhoneLookupVariants(phone) {
  const variants = new Set();
  if (!phone) {
    return [];
  }

  const digitsOnly = phone.replace(/\D/g, '');
  const normalized = normalizeCustomerPhone(phone);

  if (digitsOnly) {
    variants.add(digitsOnly);
  }

  if (normalized) {
    variants.add(normalized);
  }

  if (digitsOnly.startsWith('254')) {
    variants.add('0' + digitsOnly.slice(3));
    variants.add(digitsOnly.slice(3));
  }

  if (digitsOnly.startsWith('0') && digitsOnly.length === 10) {
    variants.add(`254${digitsOnly.slice(1)}`);
    variants.add(digitsOnly.slice(1));
  }

  if (digitsOnly.length === 9) {
    variants.add(`0${digitsOnly}`);
    variants.add(`254${digitsOnly}`);
  }

  return Array.from(variants).filter(Boolean);
}

/**
 * Send OTP for phone login
 * POST /api/auth/send-otp
 */
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    const rawContext =
      req.body?.userType ||
      req.body?.context ||
      req.body?.clientType ||
      req.body?.audience ||
      req.body?.role ||
      '';
    const normalizedContext =
      typeof rawContext === 'string' ? rawContext.trim().toLowerCase() : '';
    const forceCustomer = normalizedContext === 'customer';
    const forceDriver = normalizedContext === 'driver';

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    // Clean phone number
    const cleanedPhone = phone.replace(/\D/g, '');
    const normalizedPhone = normalizeCustomerPhone(phone) || cleanedPhone;
    const phoneLookupVariants = buildPhoneLookupVariants(phone);
    
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
    let driver = null;
    if (!forceCustomer) {
      const driverLookup = phoneLookupVariants.length
        ? phoneLookupVariants
        : [cleanedPhone];

      driver = await db.Driver.findOne({
        where: {
          phoneNumber: {
            [db.Sequelize.Op.in]: driverLookup
          }
        }
      });
    }
    
    // Generate OTP - 4 digits for drivers, 6 digits for customers
    const isDriver = forceDriver || (!!driver && !forceCustomer);
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

    // Ensure a customer record exists so admins can retrieve OTPs even if SMS fails
    let customerRecord = null;
    if (!isDriver) {
      const customerLookup = [
        normalizedPhone ? { phone: normalizedPhone } : null,
        normalizedPhone ? { username: normalizedPhone } : null,
        cleanedPhone ? { phone: cleanedPhone } : null,
        cleanedPhone ? { username: cleanedPhone } : null
      ].filter(Boolean);

      if (customerLookup.length) {
        customerRecord = await db.Customer.findOne({
          where: {
            [db.Sequelize.Op.or]: customerLookup
          }
        });
      }

      if (!customerRecord) {
        customerRecord = await db.Customer.create({
          phone: normalizedPhone || cleanedPhone,
          username: normalizedPhone || cleanedPhone,
          customerName: customerName || null,
          hasSetPassword: false
        });
      } else {
        const updates = {};
        if (!customerRecord.phone && (normalizedPhone || cleanedPhone)) {
          updates.phone = normalizedPhone || cleanedPhone;
        }
        if (!customerRecord.username && (normalizedPhone || cleanedPhone)) {
          updates.username = normalizedPhone || cleanedPhone;
        }
        if (!customerRecord.customerName && customerName) {
          updates.customerName = customerName;
        }
        if (Object.keys(updates).length) {
          await customerRecord.update(updates);
        }
      }
    }

    // For customers, handle SMS failures - always allow OTP entry
    // Admin can retrieve OTP from dashboard
    if (!smsResult.success) {
      console.error('Failed to send OTP:', smsResult.error);
      console.log(`📱 Customer OTP generated (SMS failed): ${otpCode} - Admin can provide from dashboard`);
      
      // Always return success with note that admin can provide OTP
      // This allows customer to proceed to OTP entry screen
      return res.status(200).json({
        success: true,
        message: 'OTP generated. Admin will provide the code if SMS failed.',
        phoneNumber: cleanedPhone,
        expiresAt: expiresAt.toISOString(),
        smsFailed: true,
        smsError: smsResult.error,
        note: 'SMS delivery failed. Please contact administrator for the OTP code, or try again later.'
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
    const rawContext =
      req.body?.userType ||
      req.body?.context ||
      req.body?.clientType ||
      req.body?.audience ||
      req.body?.role ||
      '';
    const normalizedContext =
      typeof rawContext === 'string' ? rawContext.trim().toLowerCase() : '';
    const forceCustomer = normalizedContext === 'customer';
    const forceDriver = normalizedContext === 'driver';
    const phoneLookupVariants = buildPhoneLookupVariants(phone);

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
    const normalizedPhone = normalizeCustomerPhone(phone) || cleanedPhone;

    const candidatePhones = new Set();
    candidatePhones.add(cleanedPhone);
    if (normalizedPhone) {
      candidatePhones.add(normalizedPhone.replace(/\D/g, ''));
    }
    phoneLookupVariants.forEach((variant) => {
      const digits = (variant || '').replace(/\D/g, '');
      if (digits) {
        candidatePhones.add(digits);
      }
    });

    const otpRecord = await db.Otp.findOne({
      where: {
        phoneNumber: {
          [db.Sequelize.Op.in]: Array.from(candidatePhones)
        },
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
    let driver = null;
    if (!forceCustomer) {
      const driverLookup = new Set(phoneLookupVariants);
      driverLookup.add(cleanedPhone);
      driverLookup.add(normalizedPhone);

      driver = await db.Driver.findOne({
        where: {
          phoneNumber: {
            [db.Sequelize.Op.in]: Array.from(driverLookup).filter(Boolean)
          }
        }
      });
    }
    
    const isDriver = forceDriver || (!!driver && !forceCustomer);
    
    // If this is a driver, return simple success response
    if (isDriver) {
      if (driver) {
        console.log(`✅ Driver OTP verified for: ${driver.name} (${driver.phoneNumber})`);
      } else {
        console.log('✅ Driver OTP verified (driver context enforced)');
      }
      return res.json({
        success: true,
        isDriver: true,
        driver: {
          id: driver?.id || null,
          name: driver?.name || null,
          phoneNumber: driver?.phoneNumber || cleanedPhone,
          status: driver?.status || null
        }
      });
    }

    // Continue with customer logic if not a driver
    // Find customer's orders (if any)
    const phoneQueryConditions = phoneLookupVariants.length
      ? phoneLookupVariants.map((variant) => ({
          customerPhone: {
            [db.Sequelize.Op.like]: `%${variant}%`
          }
        }))
      : [{
          customerPhone: {
            [db.Sequelize.Op.like]: `%${cleanedPhone}%`
          }
        }];

    const orders = await db.Order.findAll({
      where: {
        [db.Sequelize.Op.or]: phoneQueryConditions
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
    const customerLookupConditions = [
      ...phoneLookupVariants.flatMap((variant) => ([
        { phone: variant },
        { username: variant }
      ])),
      customerEmail ? { email: customerEmail } : null,
      customerEmail ? { username: customerEmail } : null
    ].filter(Boolean);

    let customer = await db.Customer.findOne({
      where: {
        [db.Sequelize.Op.or]: customerLookupConditions.length
          ? customerLookupConditions
          : [{ phone: cleanedPhone }]
      }
    });

    // Create or update customer record
    if (!customer) {
      customer = await db.Customer.create({
        phone: normalizedPhone || cleanedPhone,
        email: customerEmail,
        username: normalizedPhone || cleanedPhone,
        customerName: customerName,
        hasSetPassword: false
      });
    } else {
      // Update customer info if needed
      await customer.update({
        phone: normalizedPhone || customer.phone || cleanedPhone,
        email: customer.email || customerEmail,
        customerName: customer.customerName || customerName,
        username: normalizedPhone || customer.username || cleanedPhone
      });
    }

    // Return customer data - indicate if password needs to be set
    res.json({
      success: true,
      customer: {
        id: customer.id,
        phone: customer.phone || normalizedPhone,
        email: customerEmail,
        customerName: customerName,
        username: customer.username,
        hasSetPassword: customer.hasSetPassword,
        hasSetPin: customer.hasSetPassword,
        orders: orders
      },
      requiresPasswordSetup: !customer.hasSetPassword,
      requiresPinSetup: !customer.hasSetPassword
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
        hasSetPin: customer.hasSetPassword,
        orders: orders
      },
      requiresPasswordSetup: !customer.hasSetPassword,
      requiresPinSetup: !customer.hasSetPassword
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
 * Set 4-digit PIN for customer (after first-time OTP verification)
 * POST /api/auth/set-pin
 */
const handleSetCustomerPin = async (req, res) => {
  try {
    const { customerId, phone, pin, confirmPin } = req.body;

    if (!customerId || !pin) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID and PIN are required'
      });
    }

    if (pin !== undefined && typeof pin === 'string' && pin.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'PIN is required'
      });
    }

    if (pin && !/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        error: 'PIN must be exactly 4 digits'
      });
    }

    if (confirmPin !== undefined && pin !== confirmPin) {
      return res.status(400).json({
        success: false,
        error: 'PIN entries do not match'
      });
    }

    const customer = await db.Customer.findByPk(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    const normalizedPhone = normalizeCustomerPhone(phone || customer.phone || customer.username);
    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        error: 'A valid phone number is required to set a PIN'
      });
    }

    const hashedPin = await bcrypt.hash(pin, 10);

    await customer.update({
      password: hashedPin,
      username: normalizedPhone,
      phone: normalizedPhone,
      hasSetPassword: true
    });

    res.json({
      success: true,
      message: 'PIN set successfully'
    });
  } catch (error) {
    console.error('Error setting customer PIN:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set PIN. Please try again.'
    });
  }
};

router.post('/set-pin', handleSetCustomerPin);
router.post('/set-password', handleSetCustomerPin); // Legacy alias

/**
 * Login with phone + PIN (primary) or legacy username/password fallback
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { phone, pin, username, password } = req.body;

    const usingPinLogin = Boolean(phone && pin);
    const usingLegacyLogin = !usingPinLogin && Boolean(username && password);

    if (!usingPinLogin && !usingLegacyLogin) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and PIN are required'
      });
    }

    if (usingPinLogin) {
      const phoneVariants = buildPhoneLookupVariants(phone);
      const customer = await db.Customer.findOne({
        where: {
          [db.Sequelize.Op.or]: phoneVariants.length
            ? phoneVariants.flatMap((variant) => ([
                { phone: variant },
                { username: variant }
              ]))
            : [{ phone: phone.replace(/\D/g, '') }]
        }
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found. Please request an OTP to set up your PIN.',
          requiresPinSetup: true
        });
      }

      if (!customer.hasSetPassword || !customer.password) {
        return res.status(400).json({
          success: false,
          error: 'PIN not set. Please verify your phone via OTP to create one.',
          requiresPinSetup: true
        });
      }

      const isValidPin = await bcrypt.compare(pin, customer.password);

      if (!isValidPin) {
        return res.status(401).json({
          success: false,
          error: 'Invalid PIN. Please try again or request an OTP to reset it.'
        });
      }

      const orderPhoneVariants = buildPhoneLookupVariants(customer.phone || phone);
      const orderConditions = orderPhoneVariants.map((variant) => ({
        customerPhone: { [db.Sequelize.Op.like]: `%${variant}%` }
      }));

      if (customer.phone) {
        orderConditions.push({
          customerPhone: { [db.Sequelize.Op.like]: `%${customer.phone}%` }
        });
      }

      if (customer.email) {
        orderConditions.push({
          customerEmail: customer.email
        });
      }

      if (!orderConditions.length) {
        orderConditions.push({
          customerPhone: { [db.Sequelize.Op.like]: `%${phone.replace(/\D/g, '')}%` }
        });
      }

      const orders = await db.Order.findAll({
        where: {
          [db.Sequelize.Op.or]: orderConditions
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

      return res.json({
        success: true,
        customer: {
          id: customer.id,
          email: customer.email,
          phone: customer.phone,
          customerName: customer.customerName,
          username: customer.username,
          hasSetPin: true,
          orders: orders
        },
        authMethod: 'pin'
      });
    }

    // Legacy fallback to support existing sessions (email/phone + password)
    const customer = await db.Customer.findOne({
      where: {
        username: username
      }
    });

    if (!customer) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    if (!customer.hasSetPassword || !customer.password) {
      return res.status(400).json({
        success: false,
        error: 'PIN not set. Please use phone + OTP to create one.',
        requiresPinSetup: true
      });
    }

    const isValidPassword = await bcrypt.compare(password, customer.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const orders = await db.Order.findAll({
      where: {
        [db.Sequelize.Op.or]: [
          customer.email ? { customerEmail: customer.email } : null,
          customer.phone ? { customerPhone: customer.phone } : null
        ].filter(Boolean)
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
        hasSetPin: true,
        orders: orders
      },
      authMethod: 'legacy'
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
 * Check if customer has PIN set
 * POST /api/auth/check-pin-status
 */
router.post('/check-pin-status', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    const phoneVariants = buildPhoneLookupVariants(phone);

    const customer = await db.Customer.findOne({
      where: {
        [db.Sequelize.Op.or]: phoneVariants.length
          ? phoneVariants.flatMap((variant) => ([
              { phone: variant },
              { username: variant }
            ]))
          : [{ phone: phone.replace(/\D/g, '') }]
      }
    });

    if (!customer) {
      return res.json({
        success: true,
        hasPin: false,
        requiresSetup: true
      });
    }

    res.json({
      success: true,
      hasPin: Boolean(customer.hasSetPassword && customer.password),
      requiresSetup: !(customer.hasSetPassword && customer.password),
      username: customer.username,
      phone: customer.phone
    });
  } catch (error) {
    console.error('Error checking PIN status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check PIN status'
    });
  }
});

module.exports = router;

