const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const db = require('../models');

router.post('/', async (req, res) => {
  try {
    const results = [];
    const csvFilePath = path.join(__dirname, '../../dial_a_drink_brandy_inventory.csv');

    console.log('CSV file path:', csvFilePath);
    console.log('File exists:', fs.existsSync(csvFilePath));
    
    if (!fs.existsSync(csvFilePath)) {
      return res.status(404).json({ success: false, message: 'Brandy CSV file not found.' });
    }

    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (data) => {
        console.log('Parsed brandy row:', data['Drink Name']);
        results.push(data);
      })
      .on('end', async () => {
        console.log(`Total brandy rows in CSV: ${results.length}`);
        let totalBrandyImported = 0;

        for (const row of results) {
          console.log(`Processing brandy row: ${row['Drink Name']}`);
          try {
            console.log(`Looking for category: "${row.Category}"`);
            const category = await db.Category.findOne({ where: { name: row.Category } });
            if (!category) {
              console.warn(`Category "${row.Category}" not found for brandy "${row['Drink Name']}". Skipping.`);
              continue;
            }
            console.log(`Found category: ${category.name} (ID: ${category.id})`);

            let subCategory = null;
            if (row.SubCategory && row.SubCategory !== 'No sub categories') {
              subCategory = await db.SubCategory.findOne({ where: { name: row.SubCategory, categoryId: category.id } });
              if (!subCategory) {
                console.warn(`SubCategory "${row.SubCategory}" not found for category "${row.Category}" and brandy "${row['Drink Name']}". Skipping subcategory assignment.`);
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

            // Check for existing brandy to avoid duplicates
            const existingBrandy = await db.Drink.findOne({
              where: {
                name: row['Drink Name'],
                categoryId: category.id,
                subCategoryId: subCategory ? subCategory.id : null,
              }
            });

            if (existingBrandy) {
              console.log(`Brandy "${row['Drink Name']}" already exists. Skipping.`);
              continue;
            }

            const price = row['Price (KES)'] && row['Price (KES)'].trim() !== ''
              ? parseFloat(row['Price (KES)'].replace(/,/g, ''))
              : 0;

            const brandy = await db.Drink.create({
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
            totalBrandyImported++;
            console.log(`Imported brandy: ${brandy.name}`);
          } catch (brandyError) {
            console.error(`Error importing brandy "${row['Drink Name']}":`, brandyError.message);
          }
        }
        res.status(200).json({ success: true, message: 'Brandy products imported successfully', totalBrandyImported });
      });
  } catch (error) {
    console.error('Error initiating brandy import:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
