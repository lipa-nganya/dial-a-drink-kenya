const express = require('express');
const router = express.Router();
const db = require('../models');

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


