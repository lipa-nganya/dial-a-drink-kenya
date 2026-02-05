const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const { verifyAdmin } = require('./admin');
const { checkDriverCreditLimit } = require('../utils/creditLimit');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { getOrderFinancialBreakdown } = require('../utils/orderFinancials');

// Debug middleware - log ALL requests to drivers router
router.use((req, res, next) => {
  console.log(`🔍 [DRIVERS ROUTER] ${req.method} ${req.path} - OriginalUrl: ${req.originalUrl}`);
  if (req.path.includes('notifications') || req.originalUrl.includes('notifications')) {
    console.log(`🔍 [DRIVERS ROUTER] NOTIFICATION REQUEST DETECTED`);
    console.log(`🔍 [DRIVERS ROUTER] Path: ${req.path}, OriginalUrl: ${req.originalUrl}`);
    console.log(`🔍 [DRIVERS ROUTER] Authorization header:`, req.headers.authorization ? 'PRESENT' : 'MISSING');
  }
  next();
});

/**
 * Calculate cash at hand for a driver.
 * Pay on Delivery (cash): +50% delivery fee + order total per order.
 * Pay Now: -50% delivery fee per order. Minus settlements and approved submissions.
 * @param {number} driverId - Driver ID
 * @returns {Promise<number>} - Calculated cash at hand
 */
async function calculateCashAtHand(driverId) {
  try {
    let cashCollected = 0;
    const cashOrders = await db.Order.findAll({
      where: {
        driverId: driverId,
        paymentType: 'pay_on_delivery',
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        status: { [Op.in]: ['delivered', 'completed'] }
      },
      attributes: ['id']
    });
    for (const order of cashOrders) {
      try {
        const breakdown = await getOrderFinancialBreakdown(order.id);
        cashCollected += (breakdown.itemsTotal || 0) + (breakdown.deliveryFee || 0) * 0.5;
      } catch (e) {}
    }

    let cashDeductionPayNow = 0;
    const payNowOrders = await db.Order.findAll({
      where: {
        driverId: driverId,
        paymentType: 'pay_now',
        paymentStatus: 'paid',
        status: { [Op.in]: ['delivered', 'completed'] }
      },
      attributes: ['id']
    });
    for (const order of payNowOrders) {
      try {
        const breakdown = await getOrderFinancialBreakdown(order.id);
        cashDeductionPayNow += (breakdown.deliveryFee || 0) * 0.5;
      } catch (e) {}
    }

    const cashSettlements = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'cash_settlement',
        status: 'completed',
        amount: { [Op.lt]: 0 }
      },
      attributes: ['amount']
    });
    const approvedSubmissions = await db.CashSubmission.findAll({
      where: { driverId: driverId, status: 'approved' },
      attributes: ['amount']
    });
    const cashRemitted = Math.abs(cashSettlements.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0));
    const approvedTotal = approvedSubmissions.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);

    return cashCollected - cashDeductionPayNow - cashRemitted - approvedTotal;
  } catch (error) {
    console.error(`Error calculating cash at hand for driver ${driverId}:`, error);
    return 0;
  }
}

// Public routes (for driver app) - no authentication required
// NOTE: Notification routes have been moved to driver-notifications.js and mounted in app.js
// before this router to ensure they match before any /:id routes

/**
 * Get driver by phone number (for driver app)
 * GET /api/drivers/phone/:phoneNumber
 */
router.get('/phone/:phoneNumber', async (req, res) => {
  const TIMEOUT_MS = 60000; // 60 seconds
  const startTime = Date.now();
  let timeoutId = null;
  
  try {
    const { phoneNumber } = req.params;
    const cleanedPhone = phoneNumber.replace(/\D/g, '').trim();
    
    // Build all possible phone number variants
    const phoneVariants = new Set();
    phoneVariants.add(cleanedPhone);
    
    // Generate all possible formats
    if (cleanedPhone.startsWith('254') && cleanedPhone.length === 12) {
      // 254712345678 -> 0712345678, 712345678
      phoneVariants.add('0' + cleanedPhone.substring(3));
      phoneVariants.add(cleanedPhone.substring(3));
    } else if (cleanedPhone.startsWith('0') && cleanedPhone.length === 10) {
      // 0712345678 -> 254712345678, 712345678
      phoneVariants.add('254' + cleanedPhone.substring(1));
      phoneVariants.add(cleanedPhone.substring(1));
    } else if (cleanedPhone.length === 9 && cleanedPhone.startsWith('7')) {
      // 712345678 -> 254712345678, 0712345678
      phoneVariants.add('254' + cleanedPhone);
      phoneVariants.add('0' + cleanedPhone);
    } else if (cleanedPhone.length === 9 && !cleanedPhone.startsWith('7')) {
      // 123456789 -> 254123456789, 0123456789
      phoneVariants.add('254' + cleanedPhone);
      phoneVariants.add('0' + cleanedPhone);
    } else if (cleanedPhone.length === 10 && !cleanedPhone.startsWith('0') && !cleanedPhone.startsWith('254')) {
      // 10 digits without 0 or 254 prefix - try adding both
      phoneVariants.add('0' + cleanedPhone);
      phoneVariants.add('254' + cleanedPhone);
    }
    
    // Convert to array and filter out empty strings
    const variants = Array.from(phoneVariants).filter(v => v && v.length > 0);
    
    console.log(`🔍 Looking up driver with phone: ${phoneNumber} (cleaned: ${cleanedPhone})`);
    console.log(`📋 Trying ${variants.length} variants:`, variants);
    
    // Create a promise that will reject after 60 seconds
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        const elapsed = Date.now() - startTime;
        console.error(`⏱️ Driver lookup timeout after ${elapsed}ms for phone: ${phoneNumber}`);
        reject(new Error('Driver lookup timed out. Please try again or contact support.'));
      }, TIMEOUT_MS);
    });
    
    // Create the search promise
    const searchPromise = (async () => {
      // Try to find driver using all variants in a single query
      let driver = await db.Driver.findOne({
        where: {
          [Op.or]: variants.map(variant => ({
            phoneNumber: {
              [Op.iLike]: variant // Case-insensitive matching
            }
          }))
        }
      });
      
      // If still not found, try exact match with trimmed values
      if (!driver) {
        driver = await db.Driver.findOne({
          where: {
            [Op.or]: variants.map(variant => ({
              phoneNumber: db.sequelize.where(
                db.sequelize.fn('TRIM', db.sequelize.col('phoneNumber')),
                variant
              )
            }))
          }
        });
      }
      
      // Last resort: try LIKE pattern matching (for any whitespace or formatting issues)
      if (!driver) {
        for (const variant of variants) {
          driver = await db.Driver.findOne({
            where: {
              phoneNumber: {
                [Op.iLike]: `%${variant}%`
              }
            }
          });
          if (driver) {
            console.log(`✅ Found driver using LIKE pattern with variant: ${variant}`);
            break;
          }
        }
      }
      
      return driver;
    })();
    
    // Race between search and timeout
    const driver = await Promise.race([searchPromise, timeoutPromise]);
    
    // Clear timeout if search completed successfully
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    if (!driver) {
      const elapsed = Date.now() - startTime;
      console.error('❌ Driver not found for phone:', phoneNumber);
      console.error('📋 Tried variants:', variants);
      console.error(`⏱️ Search took ${elapsed}ms`);
      // Log all drivers in database for debugging (first 10)
      const allDrivers = await db.Driver.findAll({
        attributes: ['id', 'name', 'phoneNumber'],
        limit: 10
      });
      console.error('📋 Sample drivers in database:', allDrivers.map(d => ({ id: d.id, phone: d.phoneNumber })));
      return sendError(res, 'Driver not found', 404);
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`✅ Found driver #${driver.id} with phone: ${driver.phoneNumber} (took ${elapsed}ms)`);
    
    // Check if driver has PIN set (from database)
    const hasPin = driver.pinHash !== null && driver.pinHash !== '';
    
    // Don't return pinHash in response for security
    const driverData = driver.toJSON();
    delete driverData.pinHash;
    
    sendSuccess(res, {
      ...driverData,
      hasPin: hasPin
    });
  } catch (error) {
    // Clear timeout if error occurred
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    const elapsed = Date.now() - startTime;
    console.error('Error fetching driver by phone:', error);
    console.error(`⏱️ Error occurred after ${elapsed}ms`);
    
    // Check if it's a timeout error
    if (error.message && error.message.includes('timed out')) {
      return sendError(res, 'Driver lookup timed out after 60 seconds. Please try again or contact support.', 408);
    }
    
    sendError(res, error.message, 500);
  }
});

/**
 * Diagnostic endpoint: List all drivers (for debugging phone number formats)
 * GET /api/drivers/debug/list
 */
router.get('/debug/list', async (req, res) => {
  try {
    const drivers = await db.Driver.findAll({
      attributes: ['id', 'name', 'phoneNumber', 'status'],
      limit: 50,
      order: [['createdAt', 'DESC']]
    });
    
    sendSuccess(res, {
      count: drivers.length,
      drivers: drivers.map(d => ({
        id: d.id,
        name: d.name,
        phoneNumber: d.phoneNumber,
        phoneLength: d.phoneNumber ? d.phoneNumber.length : 0,
        phoneFormat: d.phoneNumber ? 
          (d.phoneNumber.startsWith('254') ? '254' : 
           d.phoneNumber.startsWith('0') ? '0' : 
           d.phoneNumber.length === 9 ? '9-digit' : 'other') : 'null',
        status: d.status
      }))
    });
  } catch (error) {
    console.error('Error listing drivers for debug:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Update driver location (for driver app)
 * PUT /api/drivers/:id/location
 */
router.put('/:id/location', async (req, res) => {
  try {
    console.log('📍📍📍 LOCATION UPDATE REQUEST RECEIVED 📍📍📍');
    console.log('📍 Request params:', req.params);
    console.log('📍 Request body:', req.body);
    console.log('📍 Request headers:', req.headers);
    
    const { id } = req.params;
    const { latitude, longitude } = req.body;

    console.log(`📍 Processing location update for driver ID: ${id}`);
    console.log(`📍 Latitude: ${latitude}, Longitude: ${longitude}`);

    if (!latitude || !longitude) {
      console.log('❌ Missing latitude or longitude');
      return sendError(res, 'Latitude and longitude are required', 400);
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    console.log(`📍 Parsed values - Lat: ${lat}, Lng: ${lng}`);

    if (isNaN(lat) || isNaN(lng)) {
      console.log('❌ Invalid latitude or longitude values (NaN)');
      return sendError(res, 'Invalid latitude or longitude values', 400);
    }

    if (lat < -90 || lat > 90) {
      console.log(`❌ Latitude out of range: ${lat}`);
      return sendError(res, 'Latitude must be between -90 and 90', 400);
    }

    if (lng < -180 || lng > 180) {
      console.log(`❌ Longitude out of range: ${lng}`);
      return sendError(res, 'Longitude must be between -180 and 180', 400);
    }

    console.log(`📍 Looking up driver with ID: ${id}`);
    const driver = await db.Driver.findByPk(id);
    if (!driver) {
      console.log(`❌ Driver not found with ID: ${id}`);
      return sendError(res, 'Driver not found', 404);
    }

    console.log(`✅ Driver found: ${driver.name} (ID: ${driver.id})`);
    console.log(`📍 Updating location from (${driver.locationLatitude}, ${driver.locationLongitude}) to (${lat}, ${lng})`);

    await driver.update({
      locationLatitude: lat,
      locationLongitude: lng,
      lastActivity: new Date()
    });

    console.log(`✅✅✅ Updated location for driver ${driver.name} (ID: ${id}): ${lat}, ${lng}`);

    sendSuccess(res, {
      message: 'Location updated successfully',
      driver: {
        id: driver.id,
        name: driver.name,
        locationLatitude: driver.locationLatitude,
        locationLongitude: driver.locationLongitude
      }
    });
  } catch (error) {
    console.error('❌❌❌ Error updating driver location:', error);
    console.error('❌ Error stack:', error.stack);
    sendError(res, error.message, 500);
  }
});

/**
 * Update driver activity by phone number (for driver app)
 * PATCH /api/drivers/phone/:phoneNumber/activity
 */
router.patch('/phone/:phoneNumber/activity', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    
    // Try multiple phone number formats to find the driver
    let driver = await db.Driver.findOne({
      where: { phoneNumber: cleanedPhone }
    });
    
    // If not found, try with 0 prefix
    if (!driver && cleanedPhone.startsWith('254')) {
      const phoneWithZero = '0' + cleanedPhone.substring(3);
      driver = await db.Driver.findOne({
        where: { phoneNumber: phoneWithZero }
      });
    }
    
    // If not found, try without country code
    if (!driver && cleanedPhone.startsWith('254')) {
      const phoneWithoutCode = cleanedPhone.substring(3);
      driver = await db.Driver.findOne({
        where: { phoneNumber: phoneWithoutCode }
      });
    }
    
    // If not found, try adding 254 prefix
    if (!driver && !cleanedPhone.startsWith('254') && cleanedPhone.length === 9) {
      const phoneWith254 = '254' + cleanedPhone;
      driver = await db.Driver.findOne({
        where: { phoneNumber: phoneWith254 }
      });
    }
    
    // If not found, try with 0 prefix then add 254
    if (!driver && cleanedPhone.startsWith('0')) {
      const phoneWithoutZero = cleanedPhone.substring(1);
      const phoneWith254 = '254' + phoneWithoutZero;
      driver = await db.Driver.findOne({
        where: { phoneNumber: phoneWith254 }
      });
    }
    
    // Also try the original format with 0 prefix
    if (!driver && !cleanedPhone.startsWith('0') && !cleanedPhone.startsWith('254')) {
      const phoneWithZero = '0' + cleanedPhone;
      driver = await db.Driver.findOne({
        where: { phoneNumber: phoneWithZero }
      });
    }
    
    if (!driver) {
      return sendError(res, 'Driver not found', 404);
    }

    const { locationLatitude, locationLongitude } = req.body;
    
    const updateData = {
      lastActivity: new Date(),
      status: 'active' // Set status to active when they log in
    };
    
    // Update location if provided
    if (locationLatitude !== undefined && locationLongitude !== undefined) {
      updateData.locationLatitude = parseFloat(locationLatitude);
      updateData.locationLongitude = parseFloat(locationLongitude);
    }

    await driver.update(updateData);

    sendSuccess(res, driver);
  } catch (error) {
    console.error('Error updating driver activity:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Set PIN for driver (after OTP verification)
 * POST /api/drivers/phone/:phoneNumber/set-pin
 * POST /api/drivers/phone/:phoneNumber/setup-pin (alias for Android app compatibility)
 */
const handleSetPin = async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { pin } = req.body;
    
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return sendError(res, 'PIN must be exactly 4 digits');
    }
    
    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    
    // Find driver by phone number (try multiple formats)
    let driver = await db.Driver.findOne({
      where: { phoneNumber: cleanedPhone }
    });
    
    if (!driver && cleanedPhone.startsWith('254')) {
      const phoneWithZero = '0' + cleanedPhone.substring(3);
      driver = await db.Driver.findOne({
        where: { phoneNumber: phoneWithZero }
      });
    }
    
    if (!driver && cleanedPhone.startsWith('254')) {
      const phoneWithoutCode = cleanedPhone.substring(3);
      driver = await db.Driver.findOne({
        where: { phoneNumber: phoneWithoutCode }
      });
    }
    
    if (!driver && !cleanedPhone.startsWith('254') && cleanedPhone.length === 9) {
      const phoneWith254 = '254' + cleanedPhone;
      driver = await db.Driver.findOne({
        where: { phoneNumber: phoneWith254 }
      });
    }
    
    if (!driver && cleanedPhone.startsWith('0')) {
      const phoneWithoutZero = cleanedPhone.substring(1);
      const phoneWith254 = '254' + phoneWithoutZero;
      driver = await db.Driver.findOne({
        where: { phoneNumber: phoneWith254 }
      });
    }
    
    if (!driver && !cleanedPhone.startsWith('0') && !cleanedPhone.startsWith('254')) {
      const phoneWithZero = '0' + cleanedPhone;
      driver = await db.Driver.findOne({
        where: { phoneNumber: phoneWithZero }
      });
    }
    
    // If driver doesn't exist, create a new driver record
    // This allows new drivers to set up their PIN after OTP verification
    if (!driver) {
      console.log(`ℹ️ Driver not found for phone: ${cleanedPhone} - creating new driver record`);
      // Create a new driver with default name
      driver = await db.Driver.create({
        phoneNumber: cleanedPhone,
        name: 'Driver', // Default name - admin can update later
        status: 'offline',
        lastActivity: new Date()
      });
      console.log(`✅ Created new driver record with phone: ${cleanedPhone}`);
    }
    
    // Hash the PIN before storing
    const saltRounds = 10;
    const pinHash = await bcrypt.hash(pin, saltRounds);
    
    // Update driver with hashed PIN
    await driver.update({
      pinHash: pinHash,
      lastActivity: new Date(),
      status: 'active'
    });
    
    console.log(`✅ PIN set for driver: ${driver.name} (${driver.phoneNumber})`);
    
    sendSuccess(res, null, 'PIN set successfully');
  } catch (error) {
    console.error('Error setting PIN:', error);
    sendError(res, error.message, 500);
  }
};

// Register both routes for compatibility
router.post('/phone/:phoneNumber/set-pin', handleSetPin);
router.post('/phone/:phoneNumber/setup-pin', handleSetPin);

/**
 * Verify PIN for driver login
 * POST /api/drivers/phone/:phoneNumber/verify-pin
 */
router.post('/phone/:phoneNumber/verify-pin', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { pin } = req.body;
    
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return sendError(res, 'PIN must be exactly 4 digits');
    }
    
    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    
    // Find driver by phone number (try multiple formats)
    let driver = await db.Driver.findOne({
      where: { phoneNumber: cleanedPhone }
    });
    
    if (!driver && cleanedPhone.startsWith('254')) {
      const phoneWithZero = '0' + cleanedPhone.substring(3);
      driver = await db.Driver.findOne({
        where: { phoneNumber: phoneWithZero }
      });
    }
    
    if (!driver && cleanedPhone.startsWith('254')) {
      const phoneWithoutCode = cleanedPhone.substring(3);
      driver = await db.Driver.findOne({
        where: { phoneNumber: phoneWithoutCode }
      });
    }
    
    if (!driver && !cleanedPhone.startsWith('254') && cleanedPhone.length === 9) {
      const phoneWith254 = '254' + cleanedPhone;
      driver = await db.Driver.findOne({
        where: { phoneNumber: phoneWith254 }
      });
    }
    
    if (!driver && cleanedPhone.startsWith('0')) {
      const phoneWithoutZero = cleanedPhone.substring(1);
      const phoneWith254 = '254' + phoneWithoutZero;
      driver = await db.Driver.findOne({
        where: { phoneNumber: phoneWith254 }
      });
    }
    
    if (!driver && !cleanedPhone.startsWith('0') && !cleanedPhone.startsWith('254')) {
      const phoneWithZero = '0' + cleanedPhone;
      driver = await db.Driver.findOne({
        where: { phoneNumber: phoneWithZero }
      });
    }
    
    if (!driver) {
      return sendError(res, 'Driver not found', 404);
    }
    
    if (!driver.pinHash) {
      return sendError(res, 'PIN not set. Please set up your PIN first.');
    }
    
    // Verify PIN
    const isPinValid = await bcrypt.compare(pin, driver.pinHash);
    
    if (!isPinValid) {
      return sendError(res, 'Invalid PIN');
    }
    
    // Update last activity and status
    await driver.update({
      lastActivity: new Date(),
      status: 'active'
    });
    
    console.log(`✅ PIN verified for driver: ${driver.name} (${driver.phoneNumber})`);
    
    // Don't return pinHash in response
    const driverData = driver.toJSON();
    delete driverData.pinHash;
    
    sendSuccess(res, {
      driver: driverData
    }, 'PIN verified successfully');
  } catch (error) {
    console.error('Error verifying PIN:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Verify OTP for driver (after send-otp)
 * POST /api/drivers/phone/:phone/verify-otp
 */
router.post('/phone/:phone/verify-otp', async (req, res) => {
  try {
    const { phone } = req.params;
    const { otpCode, otp } = req.body;
    const codeToVerify = otpCode || otp;

    if (!codeToVerify) {
      return sendError(res, 'OTP code is required', 400);
    }

    const cleanedPhone = phone.replace(/\D/g, '');
    const phoneVariants = new Set();
    phoneVariants.add(cleanedPhone);
    
    // Generate all possible formats
    if (cleanedPhone.startsWith('254') && cleanedPhone.length === 12) {
      phoneVariants.add('0' + cleanedPhone.substring(3));
      phoneVariants.add(cleanedPhone.substring(3));
    } else if (cleanedPhone.startsWith('0') && cleanedPhone.length === 10) {
      phoneVariants.add('254' + cleanedPhone.substring(1));
      phoneVariants.add(cleanedPhone.substring(1));
    } else if (cleanedPhone.length === 9 && cleanedPhone.startsWith('7')) {
      phoneVariants.add('254' + cleanedPhone);
      phoneVariants.add('0' + cleanedPhone);
    }

    const variants = Array.from(phoneVariants).filter(v => v && v.length > 0);

    // Clean and normalize OTP code (remove whitespace, ensure string)
    const cleanedOtpCode = String(codeToVerify || '').trim().replace(/\s/g, '');

    if (!cleanedOtpCode) {
      return sendError(res, 'OTP code is required', 400);
    }

    console.log(`🔍 Verifying OTP for phone: ${phone} (cleaned: ${cleanedPhone}), variants: ${variants.join(', ')}, OTP: ${cleanedOtpCode}`);

    // Find OTP record - try all phone variants and match OTP code (case-insensitive, trimmed)
    let otpRecord = null;
    for (const variant of variants) {
      // Find OTP records for this phone number (not used, not expired)
      console.log(`🔍 Searching for OTP with phone variant: ${variant}`);
      const otpRecords = await db.Otp.findAll({
        where: {
          phoneNumber: {
            [Op.iLike]: variant
          },
          isUsed: false
        },
        order: [['createdAt', 'DESC']]
      });
      console.log(`📋 Found ${otpRecords.length} unused OTP records for variant: ${variant}`);

      // Check each OTP record - compare codes after trimming and normalizing
      for (const record of otpRecords) {
        // Normalize OTP codes: convert to string, trim, remove all whitespace
        const recordOtpCode = String(record.otpCode || '').trim().replace(/\s/g, '');
        const normalizedOtpCode = cleanedOtpCode.trim().replace(/\s/g, '');
        
        // Log comparison for debugging
        console.log(`🔍 Comparing OTP: stored="${recordOtpCode}" (type: ${typeof record.otpCode}, length: ${recordOtpCode.length}) vs entered="${normalizedOtpCode}" (type: ${typeof codeToVerify}, length: ${normalizedOtpCode.length})`);
        
        // Try string comparison first (strict match after normalization)
        let isMatch = recordOtpCode === normalizedOtpCode;
        
        // Fallback: try numeric comparison if both are valid numbers
        if (!isMatch && /^\d+$/.test(recordOtpCode) && /^\d+$/.test(normalizedOtpCode)) {
          const recordNum = parseInt(recordOtpCode, 10);
          const enteredNum = parseInt(normalizedOtpCode, 10);
          if (!isNaN(recordNum) && !isNaN(enteredNum)) {
            isMatch = recordNum === enteredNum;
            if (isMatch) {
              console.log(`✅ OTP match found via numeric comparison: ${recordNum} === ${enteredNum}`);
            }
          }
        }
        
        if (isMatch) {
          otpRecord = record;
          console.log(`✅ Found matching OTP record for variant: ${variant}`);
          break;
        } else {
          console.log(`❌ OTP mismatch: stored="${recordOtpCode}" !== entered="${normalizedOtpCode}"`);
        }
      }
      if (otpRecord) break;
    }

    if (!otpRecord) {
      console.log(`❌ No matching OTP found for phone: ${cleanedPhone}, OTP entered: "${cleanedOtpCode}"`);
      // Log recent OTPs for debugging
      try {
        const recentOtps = await db.Otp.findAll({
          where: {
            phoneNumber: {
              [Op.iLike]: cleanedPhone
            }
          },
          order: [['createdAt', 'DESC']],
          limit: 5
        });
        console.log(`📋 Recent OTPs for this phone (showing last 5):`, recentOtps.map(o => ({
          otpCode: o.otpCode,
          otpCodeType: typeof o.otpCode,
          otpCodeLength: String(o.otpCode || '').length,
          isUsed: o.isUsed,
          expiresAt: o.expiresAt,
          createdAt: o.createdAt,
          timeAgo: `${Math.round((new Date() - new Date(o.createdAt)) / 1000)}s ago`
        })));
        
        // Also log the exact OTP codes for easier debugging
        if (recentOtps.length > 0) {
          const latestOtp = recentOtps[0];
          console.log(`📋 Latest OTP details: code="${latestOtp.otpCode}", stored as type ${typeof latestOtp.otpCode}, entered="${cleanedOtpCode}", entered as type ${typeof codeToVerify}`);
        }
      } catch (logError) {
        console.error('Error logging recent OTPs:', logError);
      }
      return sendError(res, 'Invalid or expired OTP code. Please check the code and try again.', 400);
    }

    // Check if OTP is expired
    if (new Date() > new Date(otpRecord.expiresAt)) {
      console.log(`❌ OTP expired. Expires at: ${otpRecord.expiresAt}, Current: ${new Date()}`);
      return sendError(res, 'OTP code has expired', 400);
    }

    // Find driver by phone (driver may not exist for new accounts)
    let driver = null;
    for (const variant of variants) {
      driver = await db.Driver.findOne({
        where: {
          phoneNumber: {
            [Op.iLike]: variant
          }
        }
      });
      if (driver) break;
    }

    // For new driver accounts, driver may not exist yet - that's OK
    // The driver will be created by admin or during PIN setup
    if (!driver) {
      console.log(`ℹ️ Driver not found for phone: ${cleanedPhone} - this is OK for new accounts`);
    }

    // Mark OTP as used
    await otpRecord.update({ isUsed: true });

    // If driver exists, update activity
    if (driver) {
      await driver.update({
        lastActivity: new Date(),
        status: 'active'
      });

      // Don't return pinHash in response
      const driverData = driver.toJSON();
      delete driverData.pinHash;

      sendSuccess(res, {
        driver: driverData,
        hasPin: !!driver.pinHash
      }, 'OTP verified successfully');
    } else {
      // Driver doesn't exist yet (new account) - return success with minimal info
      console.log(`✅ OTP verified for new driver account with phone: ${cleanedPhone}`);
      sendSuccess(res, {
        driver: null,
        hasPin: false,
        phoneNumber: cleanedPhone
      }, 'OTP verified successfully. Please proceed to set up your PIN.');
    }
  } catch (error) {
    console.error('Error verifying OTP for driver:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Register or update driver push token (native FCM/APNs)
 * POST /api/drivers/push-token
 */
router.post('/push-token', async (req, res) => {
  try {
    const { driverId, pushToken, tokenType, error, errorCode, errorName } = req.body || {};

    // Log ALL push-token requests for debugging
    console.log('📱 ===== PUSH TOKEN REQUEST RECEIVED =====');
    console.log(`📱 Driver ID: ${driverId}`);
    console.log(`📱 Token Type: ${tokenType || 'not provided'}`);
    console.log(`📱 Has Token: ${!!pushToken}`);
    console.log(`📱 Has Error: ${!!error}`);
    if (error) console.log(`📱 Error: ${error}`);
    if (errorCode) console.log(`📱 Error Code: ${errorCode}`);
    console.log('==========================================');

    // If this is a "starting" message, just log it
    if (tokenType === 'starting') {
      console.log('✅ Push token registration function was called');
      return sendSuccess(res, null, 'Registration started');
    }

    // If this is an error notification (token acquisition failed), log it but don't fail
    if (error && tokenType === 'error') {
      console.log('📱 ===== PUSH TOKEN REGISTRATION FAILURE REPORT =====');
      console.log(`📱 Driver ID: ${driverId}`);
      console.log(`📱 Error: ${error}`);
      console.log(`📱 Error Code: ${errorCode || 'N/A'}`);
      console.log(`📱 Error Name: ${errorName || 'N/A'}`);
      console.log('📱 This means the app could not acquire a push token');
      console.log('📱 Possible causes:');
      console.log('   1. google-services.json missing or incorrectly configured');
      console.log('   2. FCM credentials not configured');
      console.log('   3. Notification permissions not granted');
      console.log('   4. getDevicePushTokenAsync() failed');
      
      // Still return success so app doesn't retry unnecessarily
      return sendSuccess(res, {
        driverId: driverId,
        error: error
      }, 'Error logged - push token registration failed on device');
    }

    if (!driverId || !pushToken) {
      return sendError(res, 'driverId and pushToken are required', 400);
    }

    const driver = await db.Driver.findByPk(driverId);
    if (!driver) {
      return sendError(res, 'Driver not found', 404);
    }

    const detectedTokenType = tokenType || 'FCM/Native';
    
    console.log(`📱 ===== SAVING PUSH TOKEN =====`);
    console.log(`📱 Driver ID: ${driverId}`);
    console.log(`📱 Token type (from app): ${tokenType || 'not provided'}`);
    console.log(`📱 Detected token type: ${detectedTokenType}`);
    console.log(`📱 Token format: FCM/APNs (long string)`);
    console.log(`📱 Token preview: ${pushToken.substring(0, 50)}...`);
    console.log(`📱 Token length: ${pushToken.length} characters`);

    // Accept native FCM/APNs tokens
    // FCM tokens: Long alphanumeric string (for Android standalone builds)
    // APNs tokens: Hex string (for iOS standalone builds)
    
    if (!pushToken || pushToken.length < 10) {
      console.error(`❌ Invalid push token: too short or empty`);
      return sendError(res, 'Invalid push token format', 400);
    }

    // Save the token regardless of type
    console.log(`📱 Saving ${detectedTokenType} push token for driver #${driverId}...`);
    driver.pushToken = pushToken;
    await driver.save();
    
    // Verify token was saved
    const savedDriver = await db.Driver.findByPk(driverId);
    if (savedDriver.pushToken === pushToken) {
      console.log(`✅ ✅ ✅ Push token successfully saved for driver #${driverId}`);
      console.log(`✅ Token type: ${detectedTokenType}`);
      console.log(`✅ Token will be routed to: Firebase Cloud Messaging (FCM)`);
    } else {
      console.error(`❌ Push token verification failed for driver #${driverId}`);
    }

    sendSuccess(res, {
      driverId: driver.id, 
      pushToken: driver.pushToken,
      tokenType: detectedTokenType
    });
  } catch (error) {
    console.error('❌ Error saving driver push token:', error);
    sendError(res, 'Failed to save push token', 500);
  }
});

/**
 * Update driver status (driver can update their own status)
 * PATCH /api/drivers/:id/status
 */
router.patch('/:id/status', async (req, res) => {
  try {
    console.log('🔄 Driver status update request received');
    console.log('   Method:', req.method);
    console.log('   Path:', req.path);
    console.log('   Params:', req.params);
    console.log('   Body:', req.body);
    console.log('   Headers:', JSON.stringify(req.headers, null, 2));
    
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status || !['active', 'offline', 'inactive', 'on_delivery'].includes(status)) {
      console.log('❌ Invalid status:', status);
      return sendError(res, 'Invalid status. Must be one of: active, offline, inactive, on_delivery', 400);
    }
    
    const driver = await db.Driver.findByPk(id);
    if (!driver) {
      console.log('❌ Driver not found:', id);
      return sendError(res, 'Driver not found', 404);
    }
    
    console.log('✅ Driver found:', driver.name, 'Current status:', driver.status);
    
    const oldStatus = driver.status;
    await driver.update({ 
      status: status,
      lastActivity: new Date()
    });
    
    // Reload driver to get updated data
    await driver.reload();
    
    // If status changed, emit notification to admin
    if (status !== oldStatus) {
      const io = req.app.get('io');
      if (io) {
        const driverData = driver.toJSON();
        
        // Send notification when rider starts or ends shift
        if ((oldStatus === 'offline' || oldStatus === 'inactive') && status === 'active') {
          // Rider started shift
          io.to('admin').emit('driver-shift-started', {
            driverId: driver.id,
            driverName: driver.name,
            message: `${driver.name} has started shift`,
            driver: driverData
          });
          console.log(`📢 Notified admin: ${driver.name} has started shift`);
        } else if (oldStatus === 'active' && (status === 'offline' || status === 'inactive')) {
          // Rider ended shift
          io.to('admin').emit('driver-shift-ended', {
            driverId: driver.id,
            driverName: driver.name,
            message: `${driver.name} has ended shift`,
            driver: driverData
          });
          console.log(`📢 Notified admin: ${driver.name} has ended shift`);
        }
        
        // Also emit a general driver status update
        io.to('admin').emit('driver-status-updated', {
          driverId: driver.id,
          driver: driverData,
          oldStatus: oldStatus,
          newStatus: status
        });
      }
    }
    
    sendSuccess(res, driver);
  } catch (error) {
    console.error('Error updating driver status:', error);
    sendError(res, error.message, 500);
  }
});


// Admin routes - require admin authentication
// IMPORTANT: All routes after this line require admin authentication
router.use((req, res, next) => {
  // Log ALL requests hitting admin middleware to debug routing issues
  console.log(`🔒 [ADMIN MIDDLEWARE] ${req.method} ${req.path} - OriginalUrl: ${req.originalUrl}`);
  console.log(`🔒 [ADMIN MIDDLEWARE] Params:`, JSON.stringify(req.params));
  if (req.path.includes('notifications')) {
    console.error(`❌ [ADMIN MIDDLEWARE ERROR] Notification route hit admin middleware!`);
    console.error(`❌ Path: ${req.path}, Method: ${req.method}`);
    console.error(`❌ This should NOT happen - notification routes are public!`);
    console.error(`❌ Route stack:`, router.stack.map((s, i) => ({
      index: i,
      path: s.route?.path,
      methods: s.route ? Object.keys(s.route.methods) : 'middleware'
    })).slice(0, 20));
  }
  verifyAdmin(req, res, next);
});

/**
 * Get latest OTP for a driver (admin only)
 * GET /api/drivers/:id/latest-otp
 */
router.get('/:id/latest-otp', async (req, res) => {
  try {
    const driver = await db.Driver.findByPk(req.params.id);
    if (!driver) {
      return sendError(res, 'Driver not found', 404);
    }

    // Get the latest unused OTP for this driver's phone number
    // Try multiple phone number formats to find the OTP
    const cleanedDriverPhone = driver.phoneNumber.replace(/\D/g, '');
    let latestOtp = await db.Otp.findOne({
      where: {
        phoneNumber: cleanedDriverPhone,
        isUsed: false
      },
      order: [['createdAt', 'DESC']]
    });

    // If not found, try with different formats
    if (!latestOtp) {
      // Try with 0 prefix
      const phoneWithZero = '0' + cleanedDriverPhone.substring(3);
      latestOtp = await db.Otp.findOne({
        where: {
          phoneNumber: phoneWithZero,
          isUsed: false
        },
        order: [['createdAt', 'DESC']]
      });
    }

    if (!latestOtp) {
      // Try without country code
      const phoneWithoutCode = cleanedDriverPhone.substring(3);
      latestOtp = await db.Otp.findOne({
        where: {
          phoneNumber: phoneWithoutCode,
          isUsed: false
        },
        order: [['createdAt', 'DESC']]
      });
    }

    // Also try with 254 prefix
    if (!latestOtp && !cleanedDriverPhone.startsWith('254')) {
      const phoneWith254 = '254' + cleanedDriverPhone.replace(/^0/, '');
      latestOtp = await db.Otp.findOne({
        where: {
          phoneNumber: phoneWith254,
          isUsed: false
        },
        order: [['createdAt', 'DESC']]
      });
    }

    if (!latestOtp) {
      return res.json({
        hasOtp: false,
        message: 'No active OTP found for this driver'
      });
    }

    // Check if OTP is expired
    const isExpired = new Date() > new Date(latestOtp.expiresAt);
    
    res.json({
      hasOtp: true,
      otpCode: latestOtp.otpCode,
      expiresAt: latestOtp.expiresAt,
      isExpired: isExpired,
      createdAt: latestOtp.createdAt,
      attempts: latestOtp.attempts
    });
  } catch (error) {
    console.error('Error fetching driver OTP:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Get all drivers
 * GET /api/drivers
 */
router.get('/', async (req, res) => {
  try {
    // Get actual columns that exist in the database for Driver
    let validDriverAttributes, validWalletAttributes;
    try {
      const [existingDriverColumns] = await db.sequelize.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'drivers' ORDER BY column_name"
      );
      const driverColumnNames = new Set(existingDriverColumns.map(col => col.column_name.toLowerCase()));
      
      // Map model attributes to database column names and filter to only existing columns
      validDriverAttributes = [];
      for (const [attrName, attrDef] of Object.entries(db.Driver.rawAttributes)) {
        const dbColumnName = attrDef.field || attrName;
        // Check if the database column exists (case-insensitive)
        if (driverColumnNames.has(dbColumnName.toLowerCase())) {
          validDriverAttributes.push(attrName);
        }
      }
      
      // Get actual columns that exist in the database for DriverWallet
      const [existingWalletColumns] = await db.sequelize.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'driver_wallets' ORDER BY column_name"
      );
      const walletColumnNames = new Set(existingWalletColumns.map(col => col.column_name.toLowerCase()));
      
      // Map model attributes to database column names and filter to only existing columns
      validWalletAttributes = [];
      for (const [attrName, attrDef] of Object.entries(db.DriverWallet.rawAttributes)) {
        const dbColumnName = attrDef.field || attrName;
        // Check if the database column exists (case-insensitive)
        if (walletColumnNames.has(dbColumnName.toLowerCase())) {
          validWalletAttributes.push(attrName);
        }
      }
    } catch (schemaError) {
      // Fallback: use safe default attributes if schema query fails
      console.warn('⚠️ Could not query information_schema, using default attributes:', schemaError.message);
      validDriverAttributes = ['id', 'name', 'phoneNumber', 'status', 'createdAt', 'updatedAt'];
      validWalletAttributes = ['id', 'driverId', 'balance', 'createdAt', 'updatedAt'];
    }
    
    // Try to order by lastActivity first, fallback to createdAt if column doesn't exist
    let drivers;
    try {
      drivers = await db.Driver.findAll({
        attributes: validDriverAttributes,
        include: [{
          model: db.DriverWallet,
          as: 'wallet',
          required: false,
          attributes: validWalletAttributes
        }],
        order: [['lastActivity', 'DESC'], ['createdAt', 'DESC']]
      });
    } catch (orderError) {
      // If lastActivity column doesn't exist, order by createdAt only
      if (orderError.message && orderError.message.includes('column') && orderError.message.includes('lastActivity')) {
        console.warn('⚠️ lastActivity column not found, ordering by createdAt only');
        drivers = await db.Driver.findAll({
          attributes: validDriverAttributes,
          include: [{
            model: db.DriverWallet,
            as: 'wallet',
            required: false,
            attributes: validWalletAttributes
          }],
          order: [['createdAt', 'DESC']]
        });
      } else {
        throw orderError;
      }
    }
    
    // Add credit limit status and cash at hand to each driver
    // CRITICAL: Sync cash at hand value to ensure it matches driver app display
    const driversWithCreditStatus = await Promise.all(drivers.map(async (driver) => {
      const driverData = driver.toJSON();
      
      // Sync cash at hand: Pay on Delivery cash (50% fee + order total) - Pay Now (50% fee) - settlements - approved submissions
      try {
        const cashOrders = await db.Order.findAll({
          where: {
            driverId: driver.id,
            paymentType: 'pay_on_delivery',
            paymentMethod: 'cash',
            paymentStatus: 'paid',
            status: { [Op.in]: ['delivered', 'completed'] }
          },
          attributes: ['id']
        });
        let cashCollected = 0;
        for (const order of cashOrders) {
          try {
            const breakdown = await getOrderFinancialBreakdown(order.id);
            cashCollected += (breakdown.itemsTotal || 0) + (breakdown.deliveryFee || 0) * 0.5;
          } catch (e) {}
        }

        const payNowOrders = await db.Order.findAll({
          where: {
            driverId: driver.id,
            paymentType: 'pay_now',
            paymentStatus: 'paid',
            status: { [Op.in]: ['delivered', 'completed'] }
          },
          attributes: ['id']
        });
        let cashDeductionPayNow = 0;
        for (const order of payNowOrders) {
          try {
            const breakdown = await getOrderFinancialBreakdown(order.id);
            cashDeductionPayNow += (breakdown.deliveryFee || 0) * 0.5;
          } catch (e) {}
        }
        
        const cashSettlements = await db.Transaction.findAll({
          where: {
            driverId: driver.id,
            transactionType: 'cash_settlement',
            status: 'completed',
            amount: { [Op.lt]: 0 }
          },
          attributes: ['amount']
        });
        
        const approvedCashSubmissions = await db.CashSubmission.findAll({
          where: { driverId: driver.id, status: 'approved' },
          attributes: ['amount']
        });
        
        const cashRemitted = Math.abs(cashSettlements.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0));
        const approvedSubmissionsTotal = approvedCashSubmissions.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
        
        const calculatedCashAtHand = cashCollected - cashDeductionPayNow - cashRemitted - approvedSubmissionsTotal;
        const storedCashAtHand = parseFloat(driverData.cashAtHand || 0);
        
        // ALWAYS sync database value to ensure consistency between admin and driver app
        // Always use calculated value as source of truth and update database
        // This ensures both endpoints return the same value
        if (Math.abs(storedCashAtHand - calculatedCashAtHand) > 0.01 || storedCashAtHand === 0 || isNaN(storedCashAtHand)) {
          await driver.update({ cashAtHand: calculatedCashAtHand });
          // Reload driver to get updated value
          await driver.reload();
          const updatedValue = parseFloat(driver.cashAtHand || 0);
          driverData.cashAtHand = updatedValue;
          console.log(`🔄 [Cash At Hand Sync] Driver ${driver.id}: Updated from ${storedCashAtHand} to ${calculatedCashAtHand} (cashCollected: ${cashCollected}, payNowDeduction: ${cashDeductionPayNow}, cashRemitted: ${cashRemitted}, approvedSubmissions: ${approvedSubmissionsTotal})`);
        } else {
          // Even if values match, use calculated value to ensure consistency
          driverData.cashAtHand = calculatedCashAtHand;
          console.log(`✅ [Cash At Hand Sync] Driver ${driver.id}: Value in sync (DB: ${storedCashAtHand}, using calculated: ${calculatedCashAtHand})`);
        }
      } catch (syncError) {
        // If sync fails, use stored value
        console.error(`⚠️ Error syncing cash at hand for driver ${driver.id}:`, syncError);
        driverData.cashAtHand = parseFloat(driverData.cashAtHand || 0);
      }
      
      // Use synced cashAtHand value for credit check
      // Reload driver one more time to ensure creditCheck gets the latest value
      await driver.reload();
      const creditCheck = await checkDriverCreditLimit(driver.id, false);
      
      // CRITICAL: Always use the synced driverData.cashAtHand value, not creditCheck.cashAtHand
      // This ensures consistency - creditCheck might read a stale value from cache
      driverData.creditStatus = {
        exceeded: creditCheck.exceeded,
        cashAtHand: driverData.cashAtHand, // Use synced value from our calculation (source of truth)
        creditLimit: creditCheck.creditLimit,
        canAcceptOrders: creditCheck.canAcceptOrders,
        canUpdateOrders: creditCheck.canUpdateOrders
      };
      
      // Log for debugging
      if (Math.abs(creditCheck.cashAtHand - driverData.cashAtHand) > 0.01) {
        console.log(`⚠️ [Cash At Hand Mismatch] Driver ${driver.id}: creditCheck.cashAtHand=${creditCheck.cashAtHand}, synced value=${driverData.cashAtHand}`);
      }
      
      return driverData;
    }));
    
    res.json(driversWithCreditStatus);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch drivers' });
  }
});

/**
 * Send WhatsApp invitation to driver
 * POST /api/drivers/:id/invite-whatsapp
 * NOTE: This route must be defined BEFORE /:id to ensure proper matching
 */
router.post('/:id/invite-whatsapp', async (req, res) => {
  try {
    const { id } = req.params;
    const { appUrl } = req.body || {}; // Optional app download URL
    
    const driver = await db.Driver.findByPk(id);
    if (!driver) {
      return sendError(res, 'Driver not found', 404);
    }
    
    if (!driver.phoneNumber) {
      return sendError(res, 'Driver has no phone number');
    }
    
    const whatsappService = require('../services/whatsapp');
    const result = await whatsappService.sendDriverInvitation(
      driver.phoneNumber,
      driver.name,
      appUrl || process.env.DRIVER_APP_URL || null,
      null // Will use custom message from settings
    );
    
    if (!result.success) {
      return sendError(res, result.error);
    }
    
    console.log(`📱 WhatsApp invitation generated for driver: ${driver.name} (${driver.phoneNumber})`);
    
    sendSuccess(res, {
      whatsappLink: result.whatsappLink,
      message: result.message,
      phoneNumber: result.phoneNumber,
      driverName: driver.name
    });
  } catch (error) {
    console.error('Error generating WhatsApp invitation:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Get driver by ID
 * GET /api/drivers/:id
 */
router.get('/:id', async (req, res) => {
  console.log(`🔒 [ADMIN ROUTE] GET /:id matched - path: ${req.path}, params:`, req.params);
  console.log(`🔒 [ADMIN ROUTE] WARNING: This route matched ${req.path} - if this is /6/notifications, there's a routing bug!`);
  try {
    const driver = await db.Driver.findByPk(req.params.id);
    if (!driver) {
      return sendError(res, 'Driver not found', 404);
    }
    sendSuccess(res, driver);
  } catch (error) {
    console.error('Error fetching driver:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Create new driver
 * POST /api/drivers
 */
router.post('/', async (req, res) => {
  try {
    const { name, phoneNumber, status } = req.body;

    if (!name || !phoneNumber) {
      return sendError(res, 'Driver name and phone number are required');
    }

    // Validate phone number format
    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    if (cleanedPhone.length < 9) {
      return sendError(res, 'Invalid phone number format');
    }

    // Check if driver with this phone number already exists
    const existingDriver = await db.Driver.findOne({
      where: { phoneNumber: cleanedPhone }
    });

    if (existingDriver) {
      return sendError(res, 'Driver with this phone number already exists');
    }

    const driver = await db.Driver.create({
      name: name.trim(),
      phoneNumber: cleanedPhone,
      status: status || 'offline',
      lastActivity: new Date()
    });

    res.status(201).json(driver);
  } catch (error) {
    console.error('Error creating driver:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Update driver
 * PUT /api/drivers/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, phoneNumber, status, creditLimit, cashAtHand } = req.body;
    const driver = await db.Driver.findByPk(req.params.id);

    if (!driver) {
      return sendError(res, 'Driver not found', 404);
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (phoneNumber !== undefined) {
      const cleanedPhone = phoneNumber.replace(/\D/g, '');
      if (cleanedPhone.length < 9) {
        return sendError(res, 'Invalid phone number format');
      }
      
      // Check if another driver has this phone number
      const existingDriver = await db.Driver.findOne({
        where: { 
          phoneNumber: cleanedPhone,
          id: { [db.Sequelize.Op.ne]: req.params.id }
        }
      });

      if (existingDriver) {
        return sendError(res, 'Another driver with this phone number already exists');
      }
      
      updateData.phoneNumber = cleanedPhone;
    }
    if (status !== undefined) updateData.status = status;
    if (creditLimit !== undefined) {
      const parsedLimit = parseFloat(creditLimit);
      if (isNaN(parsedLimit) || parsedLimit < 0) {
        return sendError(res, 'Credit limit must be a non-negative number');
      }
      updateData.creditLimit = parsedLimit;
    }
    if (cashAtHand !== undefined && cashAtHand !== null && cashAtHand !== '') {
      const parsedCash = parseFloat(cashAtHand);
      if (isNaN(parsedCash) || parsedCash < 0) {
        return sendError(res, 'Cash at hand must be a non-negative number');
      }
      updateData.cashAtHand = parsedCash;
    }

    const oldStatus = driver.status;
    await driver.update(updateData);
    
    // Reload driver to get updated data
    await driver.reload();
    
    // If status changed, emit notification to admin
    if (status !== undefined && status !== oldStatus) {
      const io = req.app.get('io');
      if (io) {
        const driverData = driver.toJSON();
        
        // Send notification when rider starts or ends shift
        if ((oldStatus === 'offline' || oldStatus === 'inactive') && status === 'active') {
          // Rider started shift
          io.to('admin').emit('driver-shift-started', {
            driverId: driver.id,
            driverName: driver.name,
            message: `${driver.name} has started shift`,
            driver: driverData
          });
          console.log(`📢 Notified admin: ${driver.name} has started shift`);
        } else if (oldStatus === 'active' && (status === 'offline' || status === 'inactive')) {
          // Rider ended shift
          io.to('admin').emit('driver-shift-ended', {
            driverId: driver.id,
            driverName: driver.name,
            message: `${driver.name} has ended shift`,
            driver: driverData
          });
          console.log(`📢 Notified admin: ${driver.name} has ended shift`);
        }
        
        // Also emit a general driver status update
        io.to('admin').emit('driver-status-updated', {
          driverId: driver.id,
          driver: driverData,
          oldStatus: oldStatus,
          newStatus: status
        });
      }
    }
    
    sendSuccess(res, driver);
  } catch (error) {
    console.error('Error updating driver:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Update driver last activity
 * PATCH /api/drivers/:id/activity
 */
router.patch('/:id/activity', async (req, res) => {
  try {
    const driver = await db.Driver.findByPk(req.params.id);
    if (!driver) {
      return sendError(res, 'Driver not found', 404);
    }

    const { locationLatitude, locationLongitude } = req.body;
    
    const updateData = {
      lastActivity: new Date()
    };
    
    // Update location if provided
    if (locationLatitude !== undefined && locationLongitude !== undefined) {
      updateData.locationLatitude = parseFloat(locationLatitude);
      updateData.locationLongitude = parseFloat(locationLongitude);
    }

    await driver.update(updateData);

    sendSuccess(res, driver);
  } catch (error) {
    console.error('Error updating driver activity:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Delete driver
 * DELETE /api/drivers/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const driver = await db.Driver.findByPk(req.params.id);
    if (!driver) {
      return sendError(res, 'Driver not found', 404);
    }

    await driver.destroy();
    res.json({ message: 'Driver deleted successfully' });
  } catch (error) {
    console.error('Error deleting driver:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Receive push token diagnostics from app
 * POST /api/drivers/push-token-diagnostics
 */
router.post('/push-token-diagnostics', async (req, res) => {
  try {
    const { driverId, diagnostics } = req.body || {};
    
    if (!driverId || !diagnostics) {
      return sendError(res, 'driverId and diagnostics are required');
    }

    console.log('🔍 ===== PUSH TOKEN DIAGNOSTICS RECEIVED =====');
    console.log(`📱 Driver ID: ${driverId}`);
    console.log(`📱 Platform: ${diagnostics.platform}`);
    console.log(`📱 Timestamp: ${diagnostics.timestamp}`);
    console.log('');
    
    // Log each test result
    if (diagnostics.results.permissions) {
      const p = diagnostics.results.permissions;
      console.log('📋 Test 1 - Permissions:');
      console.log(`   Status: ${p.status}`);
      console.log(`   Granted: ${p.granted ? '✅' : '❌'}`);
      if (p.error) console.log(`   Error: ${p.error}`);
    }
    
    if (diagnostics.results.buildType) {
      const b = diagnostics.results.buildType;
      console.log('📋 Test 2 - Build Type:');
      console.log(`   App Ownership: ${b.appOwnership}`);
      console.log(`   Execution Environment: ${b.executionEnvironment}`);
      console.log(`   Is Standalone: ${b.isStandalone ? '✅' : '❌'}`);
      console.log(`   __DEV__: ${b.__DEV__}`);
    }
    
    if (diagnostics.results.googleServices) {
      const g = diagnostics.results.googleServices;
      console.log('📋 Test 3 - Google Services:');
      console.log(`   Configured: ${g.configured ? '✅' : '❌'}`);
      console.log(`   Path: ${g.path}`);
      if (g.error) console.log(`   Error: ${g.error}`);
    }
    
    if (diagnostics.results.nativeToken) {
      const n = diagnostics.results.nativeToken;
      console.log('📋 Test 4 - Native FCM Token:');
      if (n.success) {
        console.log(`   ✅ SUCCESS! Token obtained`);
        console.log(`   Token Type: ${n.tokenType}`);
        console.log(`   Token Length: ${n.tokenLength}`);
        console.log(`   Token Preview: ${n.tokenPreview}...`);
      } else {
        console.log(`   ❌ FAILED!`);
        console.log(`   Error: ${n.error}`);
        console.log(`   Error Code: ${n.errorCode || 'N/A'}`);
        console.log(`   Error Name: ${n.errorName || 'N/A'}`);
        if (n.errorStack) console.log(`   Stack: ${n.errorStack.substring(0, 200)}...`);
      }
    }
    
    // Expo token diagnostics removed - using native FCM only
    
    if (diagnostics.results.apiConnectivity) {
      const a = diagnostics.results.apiConnectivity;
      console.log('📋 Test 6 - API Connectivity:');
      console.log(`   Can Reach Backend: ${a.canReachBackend ? '✅' : '❌'}`);
      if (a.error) console.log(`   Error: ${a.error}`);
    }
    
    console.log('');
    console.log('🔍 ===== DIAGNOSTICS SUMMARY =====');
    
    // Determine root cause
    let rootCause = 'Unknown';
    if (diagnostics.results.permissions && !diagnostics.results.permissions.granted) {
      rootCause = 'Permissions not granted';
    } else if (diagnostics.results.nativeToken && !diagnostics.results.nativeToken.success) {
      rootCause = `Native token generation failed: ${diagnostics.results.nativeToken.error}`;
    // Expo token check removed - using native FCM only
    } else if (diagnostics.results.nativeToken && diagnostics.results.nativeToken.success) {
      rootCause = 'Token generation successful - issue may be in registration flow';
    }
    
    console.log(`🎯 ROOT CAUSE: ${rootCause}`);
    console.log('==========================================');
    
    res.json({ 
      success: true, 
      message: 'Diagnostics received',
      rootCause: rootCause,
      diagnostics: diagnostics
    });
  } catch (error) {
    console.error('❌ Error processing diagnostics:', error);
    res.status(500).json({ error: 'Failed to process diagnostics' });
  }
});

/**
 * Get push token status for a driver (admin only)
 * GET /api/drivers/:driverId/push-token-status
 */
router.get('/:driverId/push-token-status', async (req, res) => {
  try {
    const { driverId } = req.params;
    const driver = await db.Driver.findByPk(driverId);
    
    if (!driver) {
      return sendError(res, 'Driver not found', 404);
    }
    
    res.json({
      driverId: driver.id,
      driverName: driver.name,
      phoneNumber: driver.phoneNumber,
      hasPushToken: !!driver.pushToken,
      pushToken: driver.pushToken ? driver.pushToken.substring(0, 50) + '...' : null,
      tokenType: driver.pushToken ? 'FCM/APNs' : null,
      tokenLength: driver.pushToken ? driver.pushToken.length : 0,
      lastActivity: driver.lastActivity,
      status: driver.status
    });
  } catch (error) {
    console.error('❌ Error getting push token status:', error);
    res.status(500).json({ error: 'Failed to get push token status' });
  }
});

/**
 * Test push notification endpoint
 * POST /api/drivers/test-push/:driverId
 */
router.post('/test-push/:driverId', async (req, res) => {
  try {
    console.log(`🧪 TEST-PUSH REQUEST RECEIVED: driverId=${req.params.driverId}`);
    console.log(`🧪 Request headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`🧪 Request body:`, JSON.stringify(req.body, null, 2));
    
    const { driverId } = req.params;
    
    // Get actual columns that exist in the database for Driver
    let validDriverAttributes;
    try {
      const [existingDriverColumns] = await db.sequelize.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'drivers' ORDER BY column_name"
      );
      const driverColumnNames = new Set(existingDriverColumns.map(col => col.column_name.toLowerCase()));
      
      validDriverAttributes = [];
      for (const [attrName, attrDef] of Object.entries(db.Driver.rawAttributes)) {
        const dbColumnName = attrDef.field || attrName;
        if (driverColumnNames.has(dbColumnName.toLowerCase())) {
          validDriverAttributes.push(attrName);
        }
      }
    } catch (schemaError) {
      console.warn('⚠️ Could not query information_schema for drivers, using default attributes:', schemaError.message);
      validDriverAttributes = ['id', 'name', 'phoneNumber', 'status', 'pushToken', 'createdAt', 'updatedAt'];
    }
    
    const driver = await db.Driver.findByPk(driverId, {
      attributes: validDriverAttributes
    });
    
    if (!driver) {
      console.error(`❌ Driver not found: ${driverId}`);
      return sendError(res, 'Driver not found', 404);
    }
    
    if (!driver.pushToken) {
      console.error(`❌ Driver ${driver.name || driverId} has no push token registered`);
      return sendError(res, 'Driver has no push token registered');
    }
    
    const pushNotifications = require('../services/pushNotifications');
    
    console.log(`🧪 Testing push notification for driver ${driver.name || driverId} (ID: ${driverId})`);
    console.log(`🧪 Push token: ${driver.pushToken.substring(0, 30)}...`);
    
    // Send test notification with type "test-notification" to trigger overlay
    const message = {
      sound: 'default',
      title: 'Test Notification',
      body: `Test push notification for ${driver.name}`,
      data: {
        type: 'test-notification',
        driverName: driver.name,
      },
      priority: 'high',
      badge: 1,
      channelId: 'order-assignments',
    };
    
    // Send notification via native FCM (no Expo support)
    console.log(`🧪 Sending test notification via native FCM`);
    const result = await pushNotifications.sendFCMNotification(driver.pushToken, message);
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Test push notification sent successfully',
        receipt: result.receipt 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to send push notification',
        details: result 
      });
    }
  } catch (error) {
    console.error('Error testing push notification:', error);
    sendError(res, error.message, 500);
  }
});

module.exports = router;

