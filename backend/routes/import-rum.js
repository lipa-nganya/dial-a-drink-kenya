const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const db = require('../models');

router.post('/', async (req, res) => {
  try {
    const results = [];
    const csvFilePath = path.join(__dirname, '../../dial_a_drink_rum_inventory.csv');

    if (!fs.existsSync(csvFilePath)) {
      return res.status(404).json({ success: false, message: 'Rum CSV file not found.' });
    }

    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (data) => {
        console.log('Parsed rum row:', data['Drink Name']);
        results.push(data);
      })
      .on('end', async () => {
        console.log(`Total rum rows in CSV: ${results.length}`);
        let totalRumImported = 0;

        for (const row of results) {
          console.log(`Processing rum row: ${row['Drink Name']}`);
          try {
            console.log(`Looking for category: "${row.Category}"`);
            const category = await db.Category.findOne({ where: { name: row.Category } });
            if (!category) {
              console.warn(`Category "${row.Category}" not found for rum "${row['Drink Name']}". Skipping.`);
              continue;
            }
            console.log(`Found category: ${category.name} (ID: ${category.id})`);

            let subCategory = null;
            if (row.SubCategory && row.SubCategory !== 'No sub categories') {
              subCategory = await db.SubCategory.findOne({ where: { name: row.SubCategory, categoryId: category.id } });
              if (!subCategory) {
                console.warn(`SubCategory "${row.SubCategory}" not found for category "${row.Category}" and rum "${row['Drink Name']}". Skipping subcategory assignment.`);
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

            // Temporarily skip duplicate check to force import all products
            // const existingRum = await db.Drink.findOne({
            //   where: {
            //     name: row['Drink Name'],
            //     categoryId: category.id,
            //     subCategoryId: subCategory ? subCategory.id : null,
            //   }
            // });

            // if (existingRum) {
            //   console.log(`Rum "${row['Drink Name']}" already exists. Skipping.`);
            //   continue;
            // }

            const price = row['Price (KES)'] && row['Price (KES)'].trim() !== ''
              ? parseFloat(row['Price (KES)'].replace(/,/g, ''))
              : 0;

            try {
              const rum = await db.Drink.create({
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
              totalRumImported++;
              console.log(`✅ Imported rum: ${rum.name}`);
            } catch (createError) {
              console.error(`❌ Failed to create rum "${row['Drink Name']}":`, createError.message);
            }
          } catch (rumError) {
            console.error(`Error importing rum "${row['Drink Name']}":`, rumError.message);
          }
        }
        res.status(200).json({ success: true, message: 'Rum products imported successfully', totalRumImported });
      });
  } catch (error) {
    console.error('Error initiating rum import:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
