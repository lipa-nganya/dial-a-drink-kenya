const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const db = require('../models');

// Import smoke products from CSV
router.post('/import-smokes', async (req, res) => {
  try {
    const results = [];
    const csvFilePath = path.join(__dirname, '../../dial_a_drink_smokes_inventory.csv');

    if (!fs.existsSync(csvFilePath)) {
      return res.status(404).json({ success: false, message: 'Smokes CSV file not found.' });
    }

    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (data) => {
        console.log('Parsed row:', data['Drink Name']);
        results.push(data);
      })
      .on('end', async () => {
        console.log(`Total rows in CSV: ${results.length}`);
        let totalSmokesImported = 0;
        
        for (const row of results) {
          console.log(`Processing row: ${row['Drink Name']}`);
          try {
            console.log(`Looking for category: "${row.Category}"`);
            const category = await db.Category.findOne({ where: { name: row.Category } });
            if (!category) {
              console.warn(`Category "${row.Category}" not found for smoke "${row['Drink Name']}". Skipping.`);
              continue;
            }
            console.log(`Found category: ${category.name} (ID: ${category.id})`);

            let subCategory = null;
            if (row.SubCategory && row.SubCategory !== 'No sub categories') {
              subCategory = await db.SubCategory.findOne({ where: { name: row.SubCategory, categoryId: category.id } });
              if (!subCategory) {
                console.warn(`SubCategory "${row.SubCategory}" not found for category "${row.Category}" and smoke "${row['Drink Name']}". Skipping subcategory assignment.`);
              }
            }

            const capacityPricing = [];
            if (row.Capacity && row['Price (KES)'] && row['Price (KES)'].trim() !== '') {
              capacityPricing.push({
                capacity: row.Capacity,
                originalPrice: parseFloat(row['Price (KES)'].replace(/,/g, '')),
                currentPrice: parseFloat(row['Price (KES)'].replace(/,/g, ''))
              });
            }

            // Skip duplicate check for now to force import all products

            const price = row['Price (KES)'] && row['Price (KES)'].trim() !== '' 
              ? parseFloat(row['Price (KES)'].replace(/,/g, '')) 
              : 0;

            const smoke = await db.Drink.create({
              name: row['Drink Name'],
              description: row.Description,
              price: price,
              categoryId: category.id,
              subCategoryId: subCategory ? subCategory.id : null,
              abv: row.ABV ? parseFloat(row.ABV.replace('%', '')) : null,
              capacity: row.Capacity ? [row.Capacity] : [],
              capacityPricing: capacityPricing,
              isAvailable: true,
              isPopular: row['Special Notes'] && row['Special Notes'].includes('Popular'),
              isOnOffer: row['Special Notes'] && row['Special Notes'].includes('Discount'),
              originalPrice: price,
            });
            totalSmokesImported++;
            console.log(`Imported smoke: ${smoke.name}`);
          } catch (smokeError) {
            console.error(`Error importing smoke "${row['Drink Name']}":`, smokeError.message);
          }
        }
        res.status(200).json({ success: true, message: 'Smoke products imported successfully', totalSmokesImported });
      });
  } catch (error) {
    console.error('Error initiating smokes import:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
