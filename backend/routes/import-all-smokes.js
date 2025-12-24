const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const db = require('../models');

// Import all smoke products
router.post('/import-all-smokes', async (req, res) => {
  try {
    console.log('Starting full smoke import...');
    
    const results = [];
    const csvFilePath = path.join(__dirname, '../../dial_a_drink_smokes_inventory.csv');
    
    console.log('CSV file path:', csvFilePath);
    console.log('File exists:', fs.existsSync(csvFilePath));
    
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (data) => {
        console.log('Parsed row:', data['Drink Name']);
        results.push(data);
      })
      .on('end', async () => {
        console.log(`Total rows parsed: ${results.length}`);
        
        const category = await db.Category.findOne({ where: { name: 'Smokes' } });
        console.log('Found category:', category ? category.name : 'NOT FOUND');
        
        let imported = 0;
        for (const row of results) {
          console.log(`Importing product: ${row['Drink Name']}`);
          
          try {
            const subCategory = await db.SubCategory.findOne({ 
              where: { name: row.SubCategory, categoryId: category.id } 
            });
            
            const price = row['Price (KES)'] && row['Price (KES)'].trim() !== '' 
              ? parseFloat(row['Price (KES)'].replace(/,/g, '')) 
              : 0;
            
            const capacityPricing = [];
            if (row.Capacity && row['Price (KES)'] && row['Price (KES)'].trim() !== '') {
              capacityPricing.push({
                capacity: row.Capacity,
                originalPrice: price,
                currentPrice: price
              });
            }
            
            const product = await db.Drink.create({
              name: row['Drink Name'],
              description: row.Description,
              price: price,
              categoryId: category.id,
              subCategoryId: subCategory ? subCategory.id : null,
              capacity: row.Capacity ? [row.Capacity] : [],
              capacityPricing: capacityPricing,
              isAvailable: true,
              originalPrice: price,
            });
            
            console.log(`Successfully imported: ${product.name}`);
            imported++;
          } catch (error) {
            console.error(`Error importing ${row['Drink Name']}:`, error.message);
          }
        }
        
        res.status(200).json({
          success: true,
          message: `Full smoke import completed. Imported ${imported} products.`,
          imported: imported
        });
      });
      
  } catch (error) {
    console.error('Error in full smoke import:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
































