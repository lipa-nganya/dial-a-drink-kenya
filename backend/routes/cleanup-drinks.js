const express = require('express');
const router = express.Router();
const db = require('../models');

// Remove drinks that are not from the Dial A Drink Kenya website
router.delete('/cleanup-old-drinks', async (req, res) => {
  try {
    // Get all drinks created before the website import (before 2025-10-28)
    const oldDrinks = await db.Drink.findAll({
      where: {
        createdAt: {
          [db.Sequelize.Op.lt]: new Date('2025-10-28T00:00:00.000Z')
        }
      }
    });

    console.log(`Found ${oldDrinks.length} old drinks to remove:`);
    oldDrinks.forEach(drink => {
      console.log(`- ${drink.name} (ID: ${drink.id}) - ${drink.category?.name || 'Unknown Category'}`);
    });

    // First, remove any order items that reference these drinks
    const oldDrinkIds = oldDrinks.map(drink => drink.id);
    if (oldDrinkIds.length > 0) {
      const deletedOrderItems = await db.OrderItem.destroy({
        where: {
          drinkId: {
            [db.Sequelize.Op.in]: oldDrinkIds
          }
        }
      });
      console.log(`Removed ${deletedOrderItems} order items referencing old drinks`);
    }

    // Now delete the old drinks
    const deletedCount = await db.Drink.destroy({
      where: {
        createdAt: {
          [db.Sequelize.Op.lt]: new Date('2025-10-28T00:00:00.000Z')
        }
      }
    });

    // Get remaining drinks count
    const remainingDrinks = await db.Drink.count();

    res.status(200).json({
      success: true,
      message: 'Old drinks removed successfully',
      deletedCount: deletedCount,
      remainingDrinks: remainingDrinks,
      deletedDrinks: oldDrinks.map(drink => ({
        id: drink.id,
        name: drink.name,
        category: drink.category?.name || 'Unknown'
      }))
    });

  } catch (error) {
    console.error('Error removing old drinks:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
