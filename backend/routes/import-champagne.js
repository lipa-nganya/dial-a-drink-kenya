const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const db = require('../models');

router.post('/', async (req, res) => {
  try {
    const results = [];
    const csvFilePath = path.join(__dirname, '../../dial_a_drink_champagne_inventory.csv');

    if (!fs.existsSync(csvFilePath)) {
      return res.status(404).json({ success: false, message: 'Champagne CSV file not found.' });
    }

    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (data) => {
        console.log('Parsed champagne row:', data['Drink Name']);
        results.push(data);
      })
      .on('end', async () => {
        console.log(`Total champagne rows in CSV: ${results.length}`);
        let totalChampagneImported = 0;

        for (const row of results) {
          console.log(`Processing champagne row: ${row['Drink Name']}`);
          try {
            console.log(`Looking for category: "${row.Category}"`);
            const category = await db.Category.findOne({ where: { name: row.Category } });
            if (!category) {
              console.warn(`Category "${row.Category}" not found for champagne "${row['Drink Name']}". Skipping.`);
              continue;
            }
            console.log(`Found category: ${category.name} (ID: ${category.id})`);

            let subCategory = null;
            if (row.SubCategory && row.SubCategory !== 'No sub categories') {
              subCategory = await db.SubCategory.findOne({ where: { name: row.SubCategory, categoryId: category.id } });
              if (!subCategory) {
                console.warn(`SubCategory "${row.SubCategory}" not found for category "${row.Category}" and champagne "${row['Drink Name']}". Skipping subcategory assignment.`);
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
            // const existingChampagne = await db.Drink.findOne({
            //   where: {
            //     name: row['Drink Name'],
            //     categoryId: category.id,
            //     subCategoryId: subCategory ? subCategory.id : null,
            //   }
            // });

            // if (existingChampagne) {
            //   console.log(`Champagne "${row['Drink Name']}" already exists. Skipping.`);
            //   continue;
            // }

            const price = row['Price (KES)'] && row['Price (KES)'].trim() !== ''
              ? parseFloat(row['Price (KES)'].replace(/,/g, ''))
              : 0;

            try {
              const champagne = await db.Drink.create({
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
              totalChampagneImported++;
              console.log(`✅ Imported champagne: ${champagne.name}`);
            } catch (createError) {
              console.error(`❌ Failed to create champagne "${row['Drink Name']}":`, createError.message);
              // Try to update existing instead
              try {
                const existing = await db.Drink.findOne({
                  where: {
                    name: row['Drink Name'],
                    categoryId: category.id
                  }
                });
                if (existing) {
                  await existing.update({
                    description: row.Description,
                    price: price,
                    subCategoryId: subCategory ? subCategory.id : null,
                    abv: row.ABV ? parseFloat(row.ABV.replace('%', '')) : null,
                    capacity: row.Capacity ? [row.Capacity] : [],
                    capacityPricing: capacityPricing,
                    isPopular: row['Special Notes'] && row['Special Notes'].includes('Popular'),
                    isOnOffer: row['Special Notes'] && row['Special Notes'].includes('Discount'),
                    originalPrice: price,
                  });
                  totalChampagneImported++;
                  console.log(`✅ Updated existing champagne: ${existing.name}`);
                }
              } catch (updateError) {
                console.error(`❌ Failed to update champagne "${row['Drink Name']}":`, updateError.message);
              }
            }
          } catch (champagneError) {
            console.error(`Error importing champagne "${row['Drink Name']}":`, champagneError.message);
          }
        }
        res.status(200).json({ success: true, message: 'Champagne products imported successfully', totalChampagneImported });
      });
  } catch (error) {
    console.error('Error initiating champagne import:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
