const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const db = require('../models');

// Test import of first few smoke products
router.post('/test-csv-import', async (req, res) => {
  try {
    console.log('Starting test CSV import...');
    
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
        
        const subCategory = await db.SubCategory.findOne({ where: { name: 'Cigarettes', categoryId: category.id } });
        console.log('Found subcategory:', subCategory ? subCategory.name : 'NOT FOUND');
        
        // Import first 3 products
        let imported = 0;
        for (let i = 0; i < Math.min(3, results.length); i++) {
          const row = results[i];
          console.log(`Importing product ${i + 1}: ${row['Drink Name']}`);
          
          try {
            const price = row['Price (KES)'] && row['Price (KES)'].trim() !== '' 
              ? parseFloat(row['Price (KES)'].replace(/,/g, '')) 
              : 0;
            
            const product = await db.Drink.create({
              name: row['Drink Name'],
              description: row.Description,
              price: price,
              categoryId: category.id,
              subCategoryId: subCategory.id,
              capacity: row.Capacity ? [row.Capacity] : [],
              capacityPricing: row.Capacity && row['Price (KES)'] && row['Price (KES)'].trim() !== '' ? [{
                capacity: row.Capacity,
                originalPrice: price,
                currentPrice: price
              }] : [],
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
          message: `Test CSV import completed. Imported ${imported} products.`,
          imported: imported
        });
      });
      
  } catch (error) {
    console.error('Error in test CSV import:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
































