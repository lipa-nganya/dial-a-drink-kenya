/**
 * Generate Supplier Inventory List
 * Creates a CSV file with:
 * - Product Name
 * - Purchase Price (calculated as 70% of selling price)
 * - Selling Price (customer-facing price)
 */

const fs = require('fs');
const path = require('path');
const db = require('../models');

async function generateSupplierInventory() {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful');
    
    // Get all drinks with their prices and related data
    const drinks = await db.Drink.findAll({
      include: [
        {
          model: db.Category,
          as: 'category',
          required: false,
          attributes: ['name']
        },
        {
          model: db.Brand,
          as: 'brand',
          required: false,
          attributes: ['name']
        }
      ],
      where: {
        price: {
          [db.Sequelize.Op.gt]: 0
        }
      },
      order: [
        [{ model: db.Category, as: 'category' }, 'name', 'ASC'],
        ['name', 'ASC']
      ],
      attributes: ['id', 'name', 'price', 'purchasePrice', 'barcode', 'stock']
    });
    
    console.log(`\n📊 Found ${drinks.length} products\n`);
    
    if (drinks.length === 0) {
      console.log('⚠️  No products found. Nothing to generate.');
      process.exit(0);
    }
    
    // Generate inventory list
    const inventoryList = drinks.map(drink => {
      const sellingPrice = parseFloat(drink.price) || 0;
      // Calculate purchase price as 70% of selling price
      const purchasePrice = (sellingPrice * 0.7).toFixed(2);
      
      return {
        'Product Name': drink.name,
        'Purchase Price (KES)': parseFloat(purchasePrice),
        'Selling Price (KES)': sellingPrice,
        'Category': drink.category?.name || 'N/A',
        'Brand': drink.brand?.name || 'N/A',
        'Barcode': drink.barcode || '',
        'Stock': drink.stock || 0,
        'Margin (%)': '30%',
        'Profit per Unit (KES)': (sellingPrice - parseFloat(purchasePrice)).toFixed(2)
      };
    });
    
    // Generate CSV content
    const headers = Object.keys(inventoryList[0]);
    const csvRows = [
      headers.join(','),
      ...inventoryList.map(item => 
        headers.map(header => {
          const value = item[header];
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ];
    
    const csvContent = csvRows.join('\n');
    
    // Generate JSON content
    const jsonContent = JSON.stringify(inventoryList, null, 2);
    
    // Save files
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const csvFileName = `supplier-inventory-${timestamp}.csv`;
    const jsonFileName = `supplier-inventory-${timestamp}.json`;
    
    const csvPath = path.join(__dirname, '..', '..', csvFileName);
    const jsonPath = path.join(__dirname, '..', '..', jsonFileName);
    
    fs.writeFileSync(csvPath, csvContent, 'utf8');
    fs.writeFileSync(jsonPath, jsonContent, 'utf8');
    
    console.log('✅ Supplier inventory list generated successfully!\n');
    console.log(`📄 CSV file: ${csvFileName}`);
    console.log(`📄 JSON file: ${jsonFileName}\n`);
    
    // Display summary
    const totalProducts = inventoryList.length;
    const totalPurchaseValue = inventoryList.reduce((sum, item) => sum + parseFloat(item['Purchase Price (KES)']), 0);
    const totalSellingValue = inventoryList.reduce((sum, item) => sum + parseFloat(item['Selling Price (KES)']), 0);
    const totalProfit = totalSellingValue - totalPurchaseValue;
    
    console.log('📊 Summary:');
    console.log(`   Total Products: ${totalProducts}`);
    console.log(`   Total Purchase Value: KES ${totalPurchaseValue.toFixed(2)}`);
    console.log(`   Total Selling Value: KES ${totalSellingValue.toFixed(2)}`);
    console.log(`   Total Potential Profit: KES ${totalProfit.toFixed(2)}`);
    console.log(`   Average Margin: 30%\n`);
    
    // Display first 10 items as preview
    console.log('📋 Preview (first 10 items):');
    console.log('─'.repeat(100));
    console.log(
      'Product Name'.padEnd(30) + 
      'Purchase Price'.padEnd(18) + 
      'Selling Price'.padEnd(18) + 
      'Margin'
    );
    console.log('─'.repeat(100));
    
    inventoryList.slice(0, 10).forEach(item => {
      console.log(
        item['Product Name'].substring(0, 28).padEnd(30) +
        `KES ${item['Purchase Price (KES)'].toFixed(2)}`.padEnd(18) +
        `KES ${item['Selling Price (KES)'].toFixed(2)}`.padEnd(18) +
        '30%'
      );
    });
    
    if (inventoryList.length > 10) {
      console.log(`\n... and ${inventoryList.length - 10} more items`);
    }
    
    console.log('\n✅ Done!');
    
  } catch (error) {
    console.error('❌ Error generating supplier inventory:', error);
    process.exit(1);
  } finally {
    await db.sequelize.close();
  }
}

// Run the script
generateSupplierInventory();
