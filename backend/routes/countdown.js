const express = require('express');
const router = express.Router();
const { Countdown, Drink } = require('../models');

// Get current active countdown
router.get('/current', async (req, res) => {
  try {
    // First check for expired countdowns and revert offers
    await checkExpiredCountdowns();
    
    const countdown = await Countdown.findOne({
      where: { isActive: true },
      order: [['createdAt', 'DESC']]
    });

    if (!countdown) {
      return res.json({ 
        active: false, 
        message: 'No active countdown' 
      });
    }

    const now = new Date();
    const startDate = new Date(countdown.startDate);
    const endDate = new Date(countdown.endDate);

    // Check if countdown is within the active period
    if (now < startDate) {
      return res.json({
        active: false,
        message: 'Countdown not started yet',
        startDate: startDate,
        endDate: endDate
      });
    }

    if (now > endDate) {
      // Countdown has ended - revert all offers and deactivate countdown
      await revertAllOffers();
      await countdown.update({ isActive: false });
      
      return res.json({
        active: false,
        message: 'Countdown has ended',
        startDate: startDate,
        endDate: endDate
      });
    }

    res.json({
      active: true,
      id: countdown.id,
      title: countdown.title,
      startDate: startDate,
      endDate: endDate,
      timeRemaining: endDate.getTime() - now.getTime()
    });
  } catch (error) {
    console.error('Error fetching countdown:', error);
    res.status(500).json({ error: 'Failed to fetch countdown' });
  }
});

// Get all countdowns (admin)
router.get('/', async (req, res) => {
  try {
    const countdowns = await Countdown.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json(countdowns);
  } catch (error) {
    console.error('Error fetching countdowns:', error);
    res.status(500).json({ error: 'Failed to fetch countdowns' });
  }
});

// Create new countdown (admin)
router.post('/', async (req, res) => {
  try {
    const { startDate, endDate, title } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    // Deactivate all existing countdowns and revert offers
    await Countdown.update(
      { isActive: false },
      { where: { isActive: true } }
    );

    // Revert all offers when creating new countdown
    await revertAllOffers();

    const countdown = await Countdown.create({
      startDate: start,
      endDate: end,
      title: title || 'Special Offer',
      isActive: true
    });

    res.json(countdown);
  } catch (error) {
    console.error('Error creating countdown:', error);
    res.status(500).json({ error: 'Failed to create countdown' });
  }
});

// Update countdown (admin)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, title, isActive } = req.body;

    const countdown = await Countdown.findByPk(id);
    if (!countdown) {
      return res.status(404).json({ error: 'Countdown not found' });
    }

    const updateData = {};
    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);
    if (title) updateData.title = title;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    await countdown.update(updateData);
    res.json(countdown);
  } catch (error) {
    console.error('Error updating countdown:', error);
    res.status(500).json({ error: 'Failed to update countdown' });
  }
});

// Delete countdown (admin)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const countdown = await Countdown.findByPk(id);
    
    if (!countdown) {
      return res.status(404).json({ error: 'Countdown not found' });
    }

    // Revert all offers when deleting countdown
    await revertAllOffers();

    await countdown.destroy();
    res.json({ message: 'Countdown deleted successfully' });
  } catch (error) {
    console.error('Error deleting countdown:', error);
    res.status(500).json({ error: 'Failed to delete countdown' });
  }
});

// Helper function to revert all offers
async function revertAllOffers() {
  try {
    const offerDrinks = await Drink.findAll({
      where: { isOnOffer: true }
    });

    for (const drink of offerDrinks) {
      if (drink.originalPrice) {
        await drink.update({
          isOnOffer: false,
          price: drink.originalPrice
        });
      }
    }
    console.log(`✅ Reverted ${offerDrinks.length} offers to original prices`);
  } catch (error) {
    console.error('Error reverting offers:', error);
  }
}

// Function to check and handle expired countdowns
async function checkExpiredCountdowns() {
  try {
    const activeCountdowns = await Countdown.findAll({
      where: { isActive: true }
    });

    const now = new Date();
    
    for (const countdown of activeCountdowns) {
      const endDate = new Date(countdown.endDate);
      
      if (now > endDate) {
        console.log(`⏰ Countdown "${countdown.title}" has expired, reverting offers...`);
        await revertAllOffers();
        await countdown.update({ isActive: false });
        console.log(`✅ Countdown "${countdown.title}" deactivated and offers reverted`);
      }
    }
  } catch (error) {
    console.error('Error checking expired countdowns:', error);
  }
}

// Manual endpoint to check and revert expired countdowns
router.post('/check-expired', async (req, res) => {
  try {
    await checkExpiredCountdowns();
    res.json({ message: 'Expired countdowns checked and offers reverted if necessary' });
  } catch (error) {
    console.error('Error checking expired countdowns:', error);
    res.status(500).json({ error: 'Failed to check expired countdowns' });
  }
});

module.exports = router;
