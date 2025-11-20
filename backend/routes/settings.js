const express = require('express');
const router = express.Router();
const db = require('../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
    const absoluteUrl = `${req.protocol}://${req.get('host')}${relativePath}`;

    return res.json({
      url: absoluteUrl,
      path: relativePath,
      filename: req.file.filename
    });
  });
});

// Get setting by key
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const setting = await db.Settings.findOne({ where: { key } });
    
    if (!setting) {
      // Return default values for certain settings
      if (key === 'heroImage') {
        return res.json({ key: 'heroImage', value: '/assets/images/ads/hero-ad.png' });
      }
      if (key === 'deliveryTestMode') {
        return res.json({ key: 'deliveryTestMode', value: 'false' });
      }
      if (key === 'deliveryFeeWithAlcohol') {
        return res.json({ key: 'deliveryFeeWithAlcohol', value: '50' });
      }
      if (key === 'deliveryFeeWithoutAlcohol') {
        return res.json({ key: 'deliveryFeeWithoutAlcohol', value: '30' });
      }
      if (key === 'maxTipEnabled') {
        return res.json({ key: 'maxTipEnabled', value: 'false' });
      }
      if (key === 'driverPayPerDeliveryEnabled') {
        return res.json({ key: 'driverPayPerDeliveryEnabled', value: 'false' });
      }
      if (key === 'driverPayPerDeliveryAmount') {
        return res.json({ key: 'driverPayPerDeliveryAmount', value: '0' });
      }
      if (key === 'stockAlertQuantity') {
        return res.json({ key: 'stockAlertQuantity', value: '10' });
      }
      if (key === 'stockAlertRecipient') {
        return res.json({ key: 'stockAlertRecipient', value: '' });
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
    
    if (!value) {
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
router.get('/', async (req, res) => {
  try {
    const settings = await db.Settings.findAll();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


