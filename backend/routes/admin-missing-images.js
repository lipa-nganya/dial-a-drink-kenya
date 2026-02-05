const express = require('express');
const router = express.Router();
const db = require('../models');

// Admin endpoint: list drinks whose images are still on Cloudinary
router.get('/drinks/missing-images', async (req, res) => {
  try {
    const drinks = await db.Drink.findAll({
      where: {
        image: {
          [db.Sequelize.Op.like]: 'https://res.cloudinary.com%',
        },
      },
      attributes: ['id', 'name', 'image', 'categoryId', 'brandId'],
      order: [['name', 'ASC']],
      include: [
        {
          model: db.Category,
          as: 'category',
          attributes: ['id', 'name'],
          required: false,
        },
        {
          model: db.Brand,
          as: 'brand',
          attributes: ['id', 'name'],
          required: false,
        },
      ],
    });

    res.json({
      count: drinks.length,
      items: drinks,
    });
  } catch (error) {
    console.error('Error fetching drinks with missing local images:', error);
    res.status(500).json({ error: 'Failed to fetch drinks with missing local images' });
  }
});

module.exports = router;

