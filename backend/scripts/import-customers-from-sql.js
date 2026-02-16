/**
 * Import customers from SQL dump file
 * 
 * This script:
 * 1. Parses the SQL file to extract customer data
 * 2. Normalizes phone numbers (0727893741 -> 254727893741)
 * 3. Prevents duplicates based on normalized phone numbers
 * 4. Allows blank customer names
 * 5. Creates customers that can use OTP + PIN login
 * 
 * Usage:
 *   NODE_ENV=production DATABASE_URL="..." node backend/scripts/import-customers-from-sql.js /path/to/dial\ a\ drink\ database.sql
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../models');

// Phone normalization function (matches backend/routes/auth.js)
function normalizeCustomerPhone(phone) {
  if (!phone) {
    return null;
  }

  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  if (!digits) {
    return null;
  }

  // Already in format 254XXXXXXXXX (12 digits)
  if (digits.startsWith('254') && digits.length === 12) {
    return digits;
  }

  // Format 0XXXXXXXXX (10 digits starting with 0)
  if (digits.startsWith('0') && digits.length === 10) {
    return `254${digits.slice(1)}`;
  }

  // Format 7XXXXXXXX (9 digits starting with 7)
  if (digits.length === 9 && digits.startsWith('7')) {
    return `254${digits}`;
  }

  // Other 9-digit numbers
  if (digits.length === 9 && !digits.startsWith('7')) {
    return digits;
  }

  // Return as-is if no pattern matches
  return digits;
}

// Extract phone number from cus_number field (may contain extra data)
function extractPhoneNumber(cusNumber) {
  if (!cusNumber) {
    return null;
  }
  
  // Remove all non-digits and take the first valid phone number sequence
  const digits = cusNumber.replace(/\D/g, '');
  
  // Try to find a valid Kenyan phone number pattern
  // Look for 10-digit numbers starting with 0, or 9-digit numbers starting with 7
  const patterns = [
    /0\d{9}/,  // 0XXXXXXXXX (10 digits)
    /7\d{8}/,  // 7XXXXXXXX (9 digits)
    /254\d{9}/ // 254XXXXXXXXX (12 digits)
  ];
  
  for (const pattern of patterns) {
    const match = digits.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  // If no pattern matches, return first 9-12 digits
  if (digits.length >= 9 && digits.length <= 12) {
    return digits;
  }
  
  return null;
}

// Parse SQL INSERT statements for `customers` table
function parseCustomersFromSQL(sqlContent) {
  const customers = [];
  const seenPhones = new Set();
  
  // Match INSERT INTO `customers` statements
  const insertRegex = /INSERT INTO `customers`[^;]+;/gi;
  const matches = sqlContent.match(insertRegex);
  
  if (!matches) {
    console.log('⚠️  No INSERT INTO customers statements found');
    return customers;
  }
  
  console.log(`📊 Found ${matches.length} INSERT statements`);
  
  for (const insertStatement of matches) {
    // Extract VALUES part - handle multi-line VALUES
    const valuesMatch = insertStatement.match(/VALUES\s+([\s\S]+?);/i);
    if (!valuesMatch) continue;
    
    const valuesString = valuesMatch[1];
    
    // Parse individual rows - handle multi-line VALUES
    // Pattern: (id, 'cus_number', 'customer_name', territory_id, 'territory', delivery_fee, 'comment', 'created_date')
    // Handle escaped quotes and multi-line values
    const rowRegex = /\((\d+),\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)',\s*(\d+),\s*'((?:[^'\\]|\\.)*)',\s*([\d.]+),\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)'\)/g;
    let rowMatch;
    
    while ((rowMatch = rowRegex.exec(valuesString)) !== null) {
      const [, id, cusNumber, customerName, territoryId, territory, deliveryFee, comment, createdDate] = rowMatch;
      
      // Extract and normalize phone number
      const rawPhone = extractPhoneNumber(cusNumber);
      if (!rawPhone) {
        // Skip silently for invalid phones (too many to log)
        continue;
      }
      
      const normalizedPhone = normalizeCustomerPhone(rawPhone);
      if (!normalizedPhone || normalizedPhone.length < 9) {
        // Skip invalid normalized phones
        continue;
      }
      
      // Check for duplicates (normalized phone already seen)
      if (seenPhones.has(normalizedPhone)) {
        // Skip duplicate silently
        continue;
      }
      
      seenPhones.add(normalizedPhone);
      
      // Clean customer name (allow blank but trim whitespace)
      const cleanName = customerName ? customerName.trim() : '';
      
      customers.push({
        id: parseInt(id),
        phone: normalizedPhone,
        customerName: cleanName || null, // Allow null for blank names
        username: normalizedPhone, // Username is same as phone
        email: null,
        password: null, // Will be set when customer sets PIN via OTP
        hasSetPassword: false
      });
    }
  }
  
  return customers;
}

async function importCustomers() {
  try {
    let sqlFilePath = process.argv[2];
    let sqlContent;
    
    // Check if SQL file path is a Cloud Storage URL (gs://)
    if (sqlFilePath && sqlFilePath.startsWith('gs://')) {
      console.log(`📥 Downloading SQL file from Cloud Storage: ${sqlFilePath}`);
      const { Storage } = require('@google-cloud/storage');
      const storage = new Storage();
      const bucketName = sqlFilePath.replace('gs://', '').split('/')[0];
      const fileName = sqlFilePath.replace(`gs://${bucketName}/`, '');
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(fileName);
      
      // Download file to temporary location
      const tempPath = `/tmp/customers-import-${Date.now()}.sql`;
      await file.download({ destination: tempPath });
      sqlFilePath = tempPath;
      console.log(`✅ Downloaded to: ${tempPath}`);
    }
    
    // Default to local file if no argument provided
    if (!sqlFilePath) {
      sqlFilePath = path.join(process.env.HOME || '', 'Documents', 'dial a drink database.sql');
    }
    
    if (!fs.existsSync(sqlFilePath)) {
      console.error(`❌ SQL file not found: ${sqlFilePath}`);
      console.error('Usage: node import-customers-from-sql.js /path/to/dial\\ a\\ drink\\ database.sql');
      console.error('   Or: node import-customers-from-sql.js gs://bucket-name/file.sql');
      process.exit(1);
    }
    
    console.log(`📂 Reading SQL file: ${sqlFilePath}`);
    console.log('⏳ This may take a while for large files...');
    
    sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    console.log(`✅ File read successfully (${(sqlContent.length / 1024 / 1024).toFixed(2)} MB)`);
    
    console.log('\n📊 Parsing customer data...');
    const customers = parseCustomersFromSQL(sqlContent);
    console.log(`✅ Parsed ${customers.length} unique customers`);
    
    if (customers.length === 0) {
      console.log('⚠️  No customers to import');
      process.exit(0);
    }
    
    console.log('\n🔌 Connecting to database...');
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful');
    
    console.log('\n📥 Importing customers...');
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    // Process in batches to avoid memory issues
    const batchSize = 100;
    for (let i = 0; i < customers.length; i += batchSize) {
      const batch = customers.slice(i, i + batchSize);
      
      for (const customerData of batch) {
        try {
          // Check if customer already exists (by phone or username)
          const existing = await db.Customer.findOne({
            where: {
              [db.Sequelize.Op.or]: [
                { phone: customerData.phone },
                { username: customerData.username }
              ]
            }
          });
          
          if (existing) {
            // Update existing customer if name is blank but we have a name
            if (!existing.customerName && customerData.customerName) {
              await existing.update({
                customerName: customerData.customerName
              });
              console.log(`  ✓ Updated customer: ${customerData.phone} (${customerData.customerName || 'no name'})`);
              imported++;
            } else {
              skipped++;
            }
            continue;
          }
          
          // Create new customer
          await db.Customer.create(customerData);
          imported++;
          
          if (imported % 100 === 0) {
            console.log(`  📊 Progress: ${imported} imported, ${skipped} skipped, ${errors} errors`);
          }
        } catch (error) {
          errors++;
          console.error(`  ❌ Error importing customer ${customerData.phone}:`, error.message);
        }
      }
    }
    
    console.log('\n✅ Import completed!');
    console.log(`   Imported: ${imported}`);
    console.log(`   Skipped: ${skipped} (already exist)`);
    console.log(`   Errors: ${errors}`);
    
    // Show sample of imported customers
    const sample = await db.Customer.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'phone', 'customerName', 'username', 'hasSetPassword']
    });
    
    console.log('\n📋 Sample of imported customers:');
    sample.forEach(c => {
      console.log(`   - ${c.phone} | ${c.customerName || '(no name)'} | PIN set: ${c.hasSetPassword}`);
    });
    
    await db.sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    await db.sequelize.close();
    process.exit(1);
  }
}

// Run the import
importCustomers();
