const express = require('express');
const router = express.Router();
const db = require('../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const sharp = require('sharp');
const { Storage } = require('@google-cloud/storage');

const heroImageUploadDir = path.join(__dirname, '../public/uploads/hero');

if (!fs.existsSync(heroImageUploadDir)) {
  fs.mkdirSync(heroImageUploadDir, { recursive: true });
}

const heroImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, heroImageUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname) || '.png';
    cb(null, `hero-${uniqueSuffix}${extension}`);
  }
});

const heroImageUpload = multer({
  storage: heroImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  }
});

const isCloudRuntime = Boolean(process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT);
const cloudStorageBucket =
  process.env.HERO_IMAGE_BUCKET ||
  process.env.CLOUD_STORAGE_BUCKET ||
  process.env.FIREBASE_STORAGE_BUCKET ||
  'dialadrink-production-images';
let storageClient = null;

const getStorageClient = () => {
  if (!storageClient) {
    storageClient = new Storage();
  }
  return storageClient;
};

const uploadHeroToCloudStorage = async (localFilePath) => {
  const filename = `hero-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
  const objectPath = `hero/${filename}`;
  const optimizedLocalPath = path.join(os.tmpdir(), filename);

  // Produce a web-optimized hero image for LCP:
  // - webp format (better compression vs png/jpeg)
  // - max width tuned for hero rendering while preserving quality on HiDPI
  // - strip metadata to reduce bytes
  await sharp(localFilePath)
    .rotate()
    .resize({ width: 1400, withoutEnlargement: true })
    .webp({ quality: 72, effort: 5 })
    .toFile(optimizedLocalPath);

  const storage = getStorageClient();
  const bucket = storage.bucket(cloudStorageBucket);
  await bucket.upload(optimizedLocalPath, {
    destination: objectPath,
    resumable: false,
    metadata: {
      cacheControl: 'public, max-age=31536000, immutable',
      contentType: 'image/webp'
    }
  });

  try {
    fs.unlinkSync(optimizedLocalPath);
  } catch (unlinkErr) {
    console.warn('Could not remove optimized hero temp file:', unlinkErr.message);
  }

  return `https://storage.googleapis.com/${cloudStorageBucket}/${objectPath}`;
};

router.post('/heroImage/upload', (req, res) => {
  heroImageUpload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message });
    }

    if (err) {
      return res.status(400).json({ error: err.message || 'Failed to upload image' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    const relativePath = `/uploads/hero/${req.file.filename}`;
    const finish = async () => {
      try {
        // In Cloud Run/GCP, persist hero image in GCS so deploys/revisions do not wipe it.
        if (isCloudRuntime) {
          const cloudUrl = await uploadHeroToCloudStorage(req.file.path);
          try {
            fs.unlinkSync(req.file.path);
          } catch (unlinkErr) {
            // Non-fatal cleanup failure
            console.warn('Could not remove temp hero upload file:', unlinkErr.message);
          }
          return res.json({
            url: cloudUrl,
            path: cloudUrl,
            filename: req.file.filename
          });
        }

        // Local/dev fallback: serve from local uploads folder.
        const forwardedProto = req.get('X-Forwarded-Proto');
        const useHttps = forwardedProto === 'https' || process.env.NODE_ENV === 'production';
        const finalProtocol = useHttps ? 'https' : req.protocol;
        const absoluteUrl = `${finalProtocol}://${req.get('host')}${relativePath}`;
        return res.json({
          url: absoluteUrl,
          path: relativePath,
          filename: req.file.filename
        });
      } catch (uploadError) {
        console.error('Hero image upload failed:', uploadError);
        return res.status(500).json({ error: 'Failed to persist hero image upload' });
      }
    };

    finish();
  });
});

// Get setting by key
router.get('/:key', async (req, res) => {
  try {
    // Cache settings for 10 minutes to reduce database load
    // Settings like hero image, brand focus, etc. don't change frequently
    res.set('Cache-Control', 'public, max-age=600, s-maxage=600');

    const { key } = req.params;
    const setting = await db.Settings.findOne({ where: { key } });
    
    if (!setting) {
      // Return default values for certain settings
      // Include updatedAt so clients can cache-bust hero image the same as DB-backed rows
      if (key === 'heroImage') {
        return res.json({
          key: 'heroImage',
          value: '/assets/images/ads/hero-ad.png',
          updatedAt: new Date(0).toISOString()
        });
      }
      if (key === 'heroImageLinkType') {
        return res.json({ key: 'heroImageLinkType', value: 'none' });
      }
      if (key === 'heroImageLinkTargetId') {
        return res.json({ key: 'heroImageLinkTargetId', value: '' });
      }
      if (key === 'deliveryTestMode') {
        return res.json({ key: 'deliveryTestMode', value: 'false' });
      }
      if (key === 'deliveryFeeMode') {
        return res.json({ key: 'deliveryFeeMode', value: 'fixed' });
      }
      if (key === 'deliveryFeeWithAlcohol') {
        return res.json({ key: 'deliveryFeeWithAlcohol', value: '50' });
      }
      if (key === 'deliveryFeeWithoutAlcohol') {
        return res.json({ key: 'deliveryFeeWithoutAlcohol', value: '30' });
      }
      if (key === 'deliveryFeePerKmWithAlcohol') {
        return res.json({ key: 'deliveryFeePerKmWithAlcohol', value: '20' });
      }
      if (key === 'deliveryFeePerKmWithoutAlcohol') {
        return res.json({ key: 'deliveryFeePerKmWithoutAlcohol', value: '15' });
      }
      if (key === 'maxTipEnabled') {
        return res.json({ key: 'maxTipEnabled', value: 'false' });
      }
      if (key === 'driverPayPerDeliveryEnabled') {
        return res.json({ key: 'driverPayPerDeliveryEnabled', value: 'false' });
      }
      if (key === 'driverPayPerDeliveryMode') {
        return res.json({ key: 'driverPayPerDeliveryMode', value: 'amount' });
      }
      if (key === 'driverPayPerDeliveryAmount') {
        return res.json({ key: 'driverPayPerDeliveryAmount', value: '0' });
      }
      if (key === 'driverPayPerDeliveryPercentage') {
        return res.json({ key: 'driverPayPerDeliveryPercentage', value: '30' });
      }
      if (key === 'stockAlertQuantity') {
        return res.json({ key: 'stockAlertQuantity', value: '10' });
      }
      if (key === 'stockAlertRecipient') {
        return res.json({ key: 'stockAlertRecipient', value: '' });
      }
      if (key === 'whatsappDriverInvitationMessage') {
        // Return default invitation message
        const defaultMessage = `Hello {driverName}! 👋

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
        return res.json({ key: 'whatsappDriverInvitationMessage', value: defaultMessage });
      }
      if (key === 'brandFocus') {
        return res.json({ key: 'brandFocus', value: '' });
      }
      if (key === 'loanDeductionFrequency') {
        // Default: 24 hours (1 day)
        const defaultFrequency = JSON.stringify({ days: 1, hours: 0, minutes: 0 });
        return res.json({ key: 'loanDeductionFrequency', value: defaultFrequency });
      }
      if (key === 'loanDeductionAmount') {
        // Default: 150 KES
        return res.json({ key: 'loanDeductionAmount', value: '150' });
      }
      if (key === 'adminAccessPaywall') {
        return res.json({ key: 'adminAccessPaywall', value: 'false' });
      }
      if (key === 'seoMetaTitle') {
        return res.json({ key: 'seoMetaTitle', value: 'Alcohol Delivery Nairobi - Dial A Drink Kenya - 24 hours Fast Delivery' });
      }
      if (key === 'seoMetaDescription') {
        return res.json({ key: 'seoMetaDescription', value: 'Alcohol delivery in Nairobi and its environs in under 30 minutes! Wide variety of whisky, wine, cognacs, gin etc Call 0723688108 to order.' });
      }
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    res.json(setting);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update or create setting
router.put('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (key === 'adminAccessPaywall') {
      return res.status(403).json({
        error: 'This setting can only be updated by a super-super admin via PUT /api/admin/settings/admin-access-paywall.'
      });
    }
    
    // Allow empty string for certain settings like brandFocus
    if (value === undefined || value === null) {
      return res.status(400).json({ error: 'Value is required' });
    }
    
    const [setting, created] = await db.Settings.findOrCreate({
      where: { key },
      defaults: { value }
    });
    
    if (!created) {
      setting.value = value;
      await setting.save();
    }
    
    res.json(setting);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all settings
// Get multiple settings in one query (for homepage optimization)
router.get('/batch/:keys', async (req, res) => {
  try {
    // Cache for 10 minutes
    res.set('Cache-Control', 'public, max-age=600, s-maxage=600');
    
    const { keys } = req.params;
    const keyArray = keys.split(',').map(k => k.trim());
    
    const settings = await db.Settings.findAll({
      where: { key: keyArray }
    });
    
    // Convert to key-value object
    const result = {};
    settings.forEach(setting => {
      result[setting.key] = {
        key: setting.key,
        value: setting.value,
        updatedAt: setting.updatedAt
      };
    });
    
    // Add defaults for missing keys
    keyArray.forEach(key => {
      if (!result[key]) {
        if (key === 'heroImage') {
          result[key] = {
            key: 'heroImage',
            value: '/assets/images/ads/hero-ad.png',
            updatedAt: new Date(0).toISOString()
          };
        } else if (key === 'seoMetaTitle') {
          result[key] = {
            key: 'seoMetaTitle',
            value: 'Alcohol Delivery Nairobi - Dial A Drink Kenya - 24 hours Fast Delivery'
          };
        } else if (key === 'seoMetaDescription') {
          result[key] = {
            key: 'seoMetaDescription',
            value: 'Alcohol delivery in Nairobi and its environs in under 30 minutes! Wide variety of whisky, wine, cognacs, gin etc Call 0723688108 to order.'
          };
        }
      }
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching batch settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.get('/', async (req, res) => {
  try {
    const settings = await db.Settings.findAll();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


