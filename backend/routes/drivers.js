const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const { verifyAdmin } = require('./admin');
const { Expo } = require('expo-server-sdk');
const { checkDriverCreditLimit } = require('../utils/creditLimit');

/**
 * Calculate cash at hand for a driver from transactions
 * Cash at hand = Cash collected from pay_on_delivery orders - Cash settlements (remittances)
 * Note: cash_settlement transactions can be:
 *   - Positive: Cash received/recorded (should not affect cash at hand calculation)
 *   - Negative: Cash remitted to company (decreases cash at hand)
 * @param {number} driverId - Driver ID
 * @returns {Promise<number>} - Calculated cash at hand
 */
async function calculateCashAtHand(driverId) {
  try {
    // Get all cash collected from pay_on_delivery orders that are paid
    const cashOrders = await db.Order.findAll({
      where: {
        driverId: driverId,
        paymentType: 'pay_on_delivery',
        paymentStatus: 'paid',
        status: {
          [Op.in]: ['delivered', 'completed']
        }
      },
      attributes: ['id', 'totalAmount']
    });

    // Sum cash collected from orders
    const cashCollected = cashOrders.reduce((sum, order) => {
      return sum + (parseFloat(order.totalAmount) || 0);
    }, 0);

    // Get all cash settlement transactions where driver remits cash to company
    // These are negative amounts (cash going from driver to business)
    const cashSettlements = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'cash_settlement',
        status: 'completed',
        amount: {
          [Op.lt]: 0 // Only negative amounts (cash remitted)
        }
      },
      attributes: ['amount']
    });

    // Sum cash remitted (amounts are negative, so we add them to subtract from cash at hand)
    const cashRemitted = Math.abs(cashSettlements.reduce((sum, tx) => {
      return sum + (parseFloat(tx.amount) || 0);
    }, 0));

    // Cash at hand = Cash collected - Cash remitted
    const cashAtHand = cashCollected - cashRemitted;

    return Math.max(0, cashAtHand); // Ensure non-negative
  } catch (error) {
    console.error(`Error calculating cash at hand for driver ${driverId}:`, error);
    // On error, return 0
    return 0;
  }
}

// Public routes (for driver app) - no authentication required
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
      return res.status(404).json({ error: 'Driver not found' });
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`✅ Found driver #${driver.id} with phone: ${driver.phoneNumber} (took ${elapsed}ms)`);
    
    // Check if driver has PIN set (from database)
    const hasPin = driver.pinHash !== null && driver.pinHash !== '';
    
    // Don't return pinHash in response for security
    const driverData = driver.toJSON();
    delete driverData.pinHash;
    
    res.json({
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
      return res.status(408).json({ 
        error: 'Driver lookup timed out after 60 seconds. Please try again or contact support.',
        timeout: true
      });
    }
    
    res.status(500).json({ error: error.message });
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
    
    res.json({
      success: true,
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
    res.status(500).json({ error: error.message });
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
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    console.log(`📍 Parsed values - Lat: ${lat}, Lng: ${lng}`);

    if (isNaN(lat) || isNaN(lng)) {
      console.log('❌ Invalid latitude or longitude values (NaN)');
      return res.status(400).json({ error: 'Invalid latitude or longitude values' });
    }

    if (lat < -90 || lat > 90) {
      console.log(`❌ Latitude out of range: ${lat}`);
      return res.status(400).json({ error: 'Latitude must be between -90 and 90' });
    }

    if (lng < -180 || lng > 180) {
      console.log(`❌ Longitude out of range: ${lng}`);
      return res.status(400).json({ error: 'Longitude must be between -180 and 180' });
    }

    console.log(`📍 Looking up driver with ID: ${id}`);
    const driver = await db.Driver.findByPk(id);
    if (!driver) {
      console.log(`❌ Driver not found with ID: ${id}`);
      return res.status(404).json({ error: 'Driver not found' });
    }

    console.log(`✅ Driver found: ${driver.name} (ID: ${driver.id})`);
    console.log(`📍 Updating location from (${driver.locationLatitude}, ${driver.locationLongitude}) to (${lat}, ${lng})`);

    await driver.update({
      locationLatitude: lat,
      locationLongitude: lng,
      lastActivity: new Date()
    });

    console.log(`✅✅✅ Updated location for driver ${driver.name} (ID: ${id}): ${lat}, ${lng}`);

    res.json({
      success: true,
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
    res.status(500).json({ error: error.message });
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
      return res.status(404).json({ error: 'Driver not found' });
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

    res.json(driver);
  } catch (error) {
    console.error('Error updating driver activity:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Set PIN for driver (after OTP verification)
 * POST /api/drivers/phone/:phoneNumber/set-pin
 */
router.post('/phone/:phoneNumber/set-pin', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { pin } = req.body;
    
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
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
      return res.status(404).json({ error: 'Driver not found' });
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
    
    res.json({
      success: true,
      message: 'PIN set successfully'
    });
  } catch (error) {
    console.error('Error setting PIN:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Verify PIN for driver login
 * POST /api/drivers/phone/:phoneNumber/verify-pin
 */
router.post('/phone/:phoneNumber/verify-pin', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { pin } = req.body;
    
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
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
      return res.status(404).json({ error: 'Driver not found' });
    }
    
    if (!driver.pinHash) {
      return res.status(400).json({ error: 'PIN not set. Please set up your PIN first.' });
    }
    
    // Verify PIN
    const isPinValid = await bcrypt.compare(pin, driver.pinHash);
    
    if (!isPinValid) {
      return res.status(401).json({ error: 'Invalid PIN' });
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
    
    res.json({
      success: true,
      driver: driverData,
      message: 'PIN verified successfully'
    });
  } catch (error) {
    console.error('Error verifying PIN:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Register or update driver Expo push token
 * POST /api/drivers/push-token
 */
router.post('/push-token', async (req, res) => {
  try {
    const { driverId, pushToken } = req.body || {};

    if (!driverId || !pushToken) {
      return res.status(400).json({ error: 'driverId and pushToken are required' });
    }

    const driver = await db.Driver.findByPk(driverId);
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    if (!Expo.isExpoPushToken(pushToken)) {
      console.warn(`⚠️ Invalid Expo push token received for driver #${driverId}: ${pushToken}`);
      return res.status(400).json({ error: 'Invalid Expo push token' });
    }

    driver.pushToken = pushToken;
    await driver.save();

    res.json({ success: true, driverId: driver.id, pushToken: driver.pushToken });
  } catch (error) {
    console.error('Error saving driver push token:', error);
    res.status(500).json({ error: 'Failed to save push token' });
  }
});

// Admin routes - require admin authentication
router.use(verifyAdmin);

/**
 * Get latest OTP for a driver (admin only)
 * GET /api/drivers/:id/latest-otp
 */
router.get('/:id/latest-otp', async (req, res) => {
  try {
    const driver = await db.Driver.findByPk(req.params.id);
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
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
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all drivers
 * GET /api/drivers
 */
router.get('/', async (req, res) => {
  try {
    // Try to order by lastActivity first, fallback to createdAt if column doesn't exist
    let drivers;
    try {
      drivers = await db.Driver.findAll({
        include: [{
          model: db.DriverWallet,
          as: 'wallet',
          required: false
        }],
        order: [['lastActivity', 'DESC'], ['createdAt', 'DESC']]
      });
    } catch (orderError) {
      // If lastActivity column doesn't exist, order by createdAt only
      if (orderError.message && orderError.message.includes('column') && orderError.message.includes('lastActivity')) {
        console.warn('⚠️ lastActivity column not found, ordering by createdAt only');
        drivers = await db.Driver.findAll({
          include: [{
            model: db.DriverWallet,
            as: 'wallet',
            required: false
          }],
          order: [['createdAt', 'DESC']]
        });
      } else {
        throw orderError;
      }
    }
    
    // Add credit limit status and calculated cash at hand to each driver
    const driversWithCreditStatus = await Promise.all(drivers.map(async (driver) => {
      const driverData = driver.toJSON();
      const creditCheck = await checkDriverCreditLimit(driver.id);
      driverData.creditStatus = {
        exceeded: creditCheck.exceeded,
        balance: creditCheck.balance,
        creditLimit: creditCheck.creditLimit,
        debt: creditCheck.debt,
        canAcceptOrders: creditCheck.canAcceptOrders
      };
      
      // Calculate cash at hand from transactions (overrides stored value)
      const calculatedCashAtHand = await calculateCashAtHand(driver.id);
      driverData.cashAtHand = calculatedCashAtHand;
      
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
      return res.status(404).json({ error: 'Driver not found' });
    }
    
    if (!driver.phoneNumber) {
      return res.status(400).json({ error: 'Driver has no phone number' });
    }
    
    const whatsappService = require('../services/whatsapp');
    const result = await whatsappService.sendDriverInvitation(
      driver.phoneNumber,
      driver.name,
      appUrl || process.env.DRIVER_APP_URL || null,
      null // Will use custom message from settings
    );
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    console.log(`📱 WhatsApp invitation generated for driver: ${driver.name} (${driver.phoneNumber})`);
    
    res.json({
      success: true,
      whatsappLink: result.whatsappLink,
      message: result.message,
      phoneNumber: result.phoneNumber,
      driverName: driver.name
    });
  } catch (error) {
    console.error('Error generating WhatsApp invitation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get driver by ID
 * GET /api/drivers/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const driver = await db.Driver.findByPk(req.params.id);
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    res.json(driver);
  } catch (error) {
    console.error('Error fetching driver:', error);
    res.status(500).json({ error: error.message });
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
      return res.status(400).json({ error: 'Driver name and phone number are required' });
    }

    // Validate phone number format
    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    if (cleanedPhone.length < 9) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Check if driver with this phone number already exists
    const existingDriver = await db.Driver.findOne({
      where: { phoneNumber: cleanedPhone }
    });

    if (existingDriver) {
      return res.status(400).json({ error: 'Driver with this phone number already exists' });
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
    res.status(500).json({ error: error.message });
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
      return res.status(404).json({ error: 'Driver not found' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (phoneNumber !== undefined) {
      const cleanedPhone = phoneNumber.replace(/\D/g, '');
      if (cleanedPhone.length < 9) {
        return res.status(400).json({ error: 'Invalid phone number format' });
      }
      
      // Check if another driver has this phone number
      const existingDriver = await db.Driver.findOne({
        where: { 
          phoneNumber: cleanedPhone,
          id: { [db.Sequelize.Op.ne]: req.params.id }
        }
      });

      if (existingDriver) {
        return res.status(400).json({ error: 'Another driver with this phone number already exists' });
      }
      
      updateData.phoneNumber = cleanedPhone;
    }
    if (status !== undefined) updateData.status = status;
    if (creditLimit !== undefined) {
      const parsedLimit = parseFloat(creditLimit);
      if (isNaN(parsedLimit) || parsedLimit < 0) {
        return res.status(400).json({ error: 'Credit limit must be a non-negative number' });
      }
      updateData.creditLimit = parsedLimit;
    }
    if (cashAtHand !== undefined) {
      const parsedCash = parseFloat(cashAtHand);
      if (isNaN(parsedCash) || parsedCash < 0) {
        return res.status(400).json({ error: 'Cash at hand must be a non-negative number' });
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
    
    res.json(driver);
  } catch (error) {
    console.error('Error updating driver:', error);
    res.status(500).json({ error: error.message });
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
      return res.status(404).json({ error: 'Driver not found' });
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

    res.json(driver);
  } catch (error) {
    console.error('Error updating driver activity:', error);
    res.status(500).json({ error: error.message });
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
      return res.status(404).json({ error: 'Driver not found' });
    }

    await driver.destroy();
    res.json({ message: 'Driver deleted successfully' });
  } catch (error) {
    console.error('Error deleting driver:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Test push notification endpoint
 * POST /api/drivers/test-push/:driverId
 */
router.post('/test-push/:driverId', async (req, res) => {
  try {
    const { driverId } = req.params;
    const driver = await db.Driver.findByPk(driverId);
    
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    
    if (!driver.pushToken) {
      return res.status(400).json({ error: 'Driver has no push token registered' });
    }
    
    const pushNotifications = require('../services/pushNotifications');
    const testOrder = {
      id: 999,
      customerName: 'Test Customer',
      customerPhone: '0712345678',
      deliveryAddress: 'Test Address',
      totalAmount: '100.00'
    };
    
    console.log(`🧪 Testing push notification for driver ${driver.name} (ID: ${driverId})`);
    console.log(`🧪 Push token: ${driver.pushToken.substring(0, 30)}...`);
    
    const result = await pushNotifications.sendOrderNotification(driver.pushToken, testOrder);
    
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
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

