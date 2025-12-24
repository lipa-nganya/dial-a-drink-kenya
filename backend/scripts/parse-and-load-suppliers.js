const fs = require('fs');

// Read the supplier rows
const supplierRowsPath = '/tmp/supplier-rows.txt';
const rows = fs.readFileSync(supplierRowsPath, 'utf8').split('\n').filter(line => line.trim());

const suppliers = [];

rows.forEach((row, index) => {
  if (!row.trim()) return;
  
  const parts = row.trim().split(/\s+/);
  let name = '';
  let phone = null;
  let email = null;
  let balance = '0.00';
  
  let nameParts = [];
  let foundPhone = false;
  let foundEmail = false;
  let foundBalance = false;
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    // Check if it's a phone number (7-12 digits, may start with 0 or 254)
    if (!foundPhone && part.match(/^(0|254)?\d{7,12}$/)) {
      phone = part;
      foundPhone = true;
      continue;
    }
    
    // Check if it's an email
    if (!foundEmail && part.includes('@')) {
      // Email might be split across parts, collect until we hit a number or end
      let emailParts = [part];
      let j = i + 1;
      while (j < parts.length && !parts[j].match(/^-?\d+\.?\d*$/) && !parts[j].match(/^\d{7,12}$/)) {
        if (parts[j].includes('@') || parts[j].match(/^[a-zA-Z0-9._-]+$/)) {
          emailParts.push(parts[j]);
          j++;
        } else {
          break;
        }
      }
      email = emailParts.join('').replace(/\s/g, '').replace(/\.co,ke/g, '.co.ke');
      i = j - 1;
      foundEmail = true;
      continue;
    }
    
    // Check if it's a balance (number with optional decimal, can be negative)
    if (!foundBalance && part.match(/^-?\d+\.?\d*$/)) {
      balance = parseFloat(part).toFixed(2);
      foundBalance = true;
      continue;
    }
    
    // Otherwise, it's part of the name
    if (!foundPhone && !foundEmail && !foundBalance) {
      nameParts.push(part);
    }
  }
  
  name = nameParts.join(' ').trim();
  
  // Clean up name (remove quotes, fix spacing)
  name = name.replace(/^["']|["']$/g, '').replace(/\s+/g, ' ').trim();
  
  // Clean up email
  if (email) {
    email = email.replace(/\s/g, '').replace(/\.co,ke/g, '.co.ke');
    // Fix common email issues
    email = email.replace(/\s+@\s+/g, '@');
    email = email.replace(/\s+/g, '');
  }
  
  if (name && name.length > 1) {
    suppliers.push({
      name: name,
      phone: phone || null,
      email: email || null,
      openingBalance: parseFloat(balance) || 0
    });
  }
});

console.log(`Parsed ${suppliers.length} suppliers\n`);

// Write to JSON for review
fs.writeFileSync(
  '/Users/maria/dial-a-drink/backend/scripts/all-suppliers.json',
  JSON.stringify(suppliers, null, 2)
);

console.log('Sample suppliers (first 20):');
suppliers.slice(0, 20).forEach((s, i) => {
  console.log(`${(i + 1).toString().padStart(3)}. ${s.name.padEnd(40)} | ${(s.phone || 'N/A').padEnd(15)} | ${(s.email || 'N/A').substring(0, 30).padEnd(30)} | ${s.openingBalance.toFixed(2).padStart(12)}`);
});

console.log(`\n✅ Parsed ${suppliers.length} suppliers`);
console.log(`✅ Data written to all-suppliers.json`);

// Now load them into the database
require('dotenv').config();
const db = require('../models');

async function loadSuppliers() {
  try {
    console.log('\n🔌 Connecting to database...');
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful');

    console.log('\n📝 Loading suppliers into database...');
    
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const supplierData of suppliers) {
      try {
        const [supplier, created] = await db.Supplier.findOrCreate({
          where: { name: supplierData.name },
          defaults: {
            phone: supplierData.phone,
            email: supplierData.email,
            openingBalance: supplierData.openingBalance,
            isActive: true
          }
        });

        if (created) {
          console.log(`✅ Created: ${supplier.name}`);
          createdCount++;
        } else {
          // Update existing supplier
          let needsUpdate = false;
          const updates = {};
          
          if (supplier.phone !== supplierData.phone) {
            updates.phone = supplierData.phone;
            needsUpdate = true;
          }
          if (supplier.email !== supplierData.email) {
            updates.email = supplierData.email;
            needsUpdate = true;
          }
          if (Math.abs(parseFloat(supplier.openingBalance) - supplierData.openingBalance) > 0.01) {
            updates.openingBalance = supplierData.openingBalance;
            needsUpdate = true;
          }
          
          if (needsUpdate) {
            await supplier.update(updates);
            console.log(`🔄 Updated: ${supplier.name}`);
            updatedCount++;
          } else {
            skippedCount++;
          }
        }
      } catch (err) {
        console.error(`❌ Error processing ${supplierData.name}:`, err.message);
      }
    }

    console.log('\n✅ Suppliers loading completed!');
    console.log(`   Created: ${createdCount}`);
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    
    // Display summary
    const allSuppliers = await db.Supplier.findAll({
      order: [['name', 'ASC']]
    });
    console.log(`\n📊 Total suppliers in database: ${allSuppliers.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error loading suppliers:', error);
    process.exit(1);
  }
}

loadSuppliers();

