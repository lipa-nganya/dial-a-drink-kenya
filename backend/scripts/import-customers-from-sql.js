require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const readline = require('readline');

// Production DB config
const PROD_DB_CONFIG = {
  username: 'dialadrink_app',
  password: 'E7A3IIa60hFD3bkGH1XAiryvB',
  database: 'dialadrink_prod',
  host: '35.223.10.1',
  port: 5432,
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: false
};

const SQL_FILE = '/Users/maria/Documents/dial a drink database.sql';

// Helper function to normalize phone numbers
function normalizePhone(phone) {
  if (!phone) return null;
  
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Handle Kenyan phone numbers
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.substring(1);
  } else if (!cleaned.startsWith('254')) {
    if (cleaned.length === 9) {
      cleaned = '254' + cleaned;
    } else if (cleaned.length === 10 && cleaned.startsWith('7')) {
      cleaned = '254' + cleaned;
    }
  }
  
  // Validate length (should be 12 digits for 254XXXXXXXXX)
  if (cleaned.length < 9 || cleaned.length > 15) {
    return null;
  }
  
  return cleaned;
}

// Helper function to validate email
function isValidEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

// Helper function to clean email
function cleanEmail(email) {
  if (!email) return null;
  const cleaned = email.trim().toLowerCase();
  return isValidEmail(cleaned) ? cleaned : null;
}

// Extract customers from SQL file
async function extractCustomersFromSQL() {
  console.log('📖 Extracting customers from SQL file...');
  console.log(`   File: ${SQL_FILE}\n`);

  const customers = new Map(); // Use Map to deduplicate by phone/email
  const seenPhones = new Set();
  const seenEmails = new Set();
  let lineCount = 0;
  let insertCount = 0;

  const fileStream = fs.createReadStream(SQL_FILE);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let inCustomersInsert = false;
  let inTecCustomersInsert = false;
  let currentTable = null;

  for await (const line of rl) {
    lineCount++;
    if (lineCount % 100000 === 0) {
      process.stdout.write(`   Processed ${lineCount.toLocaleString()} lines...\r`);
    }

    // Detect INSERT INTO statements
    if (line.match(/INSERT\s+INTO\s+`?customers`?\s*\(/i)) {
      inCustomersInsert = true;
      currentTable = 'customers';
      insertCount++;
    } else if (line.match(/INSERT\s+INTO\s+`?tec_customers`?\s*\(/i)) {
      inTecCustomersInsert = true;
      currentTable = 'tec_customers';
      insertCount++;
    }

    // Parse VALUES from customers table (handle multi-line VALUES)
    if (inCustomersInsert) {
      // Match value tuples: (value1, value2, ...)
      const valueMatches = line.matchAll(/\(([^)]+)\)/g);
      for (const match of valueMatches) {
        try {
          const valueStr = match[1];
          // Split by comma, but handle quoted strings with commas
          const values = [];
          let current = '';
          let inQuotes = false;
          let quoteChar = null;
          
          for (let i = 0; i < valueStr.length; i++) {
            const char = valueStr[i];
            if ((char === "'" || char === '"') && (i === 0 || valueStr[i-1] !== '\\')) {
              if (!inQuotes) {
                inQuotes = true;
                quoteChar = char;
              } else if (char === quoteChar) {
                inQuotes = false;
                quoteChar = null;
              }
              current += char;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          if (current) values.push(current.trim());

          // Clean values
          const cleanedValues = values.map(v => {
            v = v.trim();
            // Remove quotes
            if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
              v = v.slice(1, -1);
            }
            // Unescape
            v = v.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            return v;
          });

          if (cleanedValues.length >= 3) {
            const id = parseInt(cleanedValues[0]) || null;
            let cusNumber = cleanedValues[1] || null;
            let customerName = cleanedValues[2] || null;
            
            // Extract phone from cus_number (might have format like "0708220769  1600")
            if (cusNumber) {
              // Take first part before space or non-digit
              const phoneMatch = cusNumber.match(/^(\d{9,15})/);
              if (phoneMatch) {
                cusNumber = phoneMatch[1];
              }
            }
            
            const phone = normalizePhone(cusNumber);
            const email = null; // customers table doesn't have email

            // Use comment field as name if customer_name is empty
            if (!customerName || customerName.length < 2) {
              customerName = cleanedValues.length >= 7 ? cleanedValues[6] : null; // comment field
            }

            if (customerName && customerName.length > 1 && (phone || cusNumber)) {
              const key = phone || cusNumber || `name_${id}`;
              if (!customers.has(key)) {
                customers.set(key, {
                  id,
                  customerName: customerName.trim(),
                  phone,
                  email: null,
                  username: phone || cusNumber || `customer_${id}`,
                  source: 'customers'
                });
                if (phone) seenPhones.add(phone);
              }
            }
          }
        } catch (parseError) {
          // Skip malformed rows
          continue;
        }
      }
    }

    // Parse VALUES from tec_customers table (handle multi-line VALUES)
    if (inTecCustomersInsert) {
      const valueMatches = line.matchAll(/\(([^)]+)\)/g);
      for (const match of valueMatches) {
        try {
          const valueStr = match[1];
          // Split by comma, but handle quoted strings with commas
          const values = [];
          let current = '';
          let inQuotes = false;
          let quoteChar = null;
          
          for (let i = 0; i < valueStr.length; i++) {
            const char = valueStr[i];
            if ((char === "'" || char === '"') && (i === 0 || valueStr[i-1] !== '\\')) {
              if (!inQuotes) {
                inQuotes = true;
                quoteChar = char;
              } else if (char === quoteChar) {
                inQuotes = false;
                quoteChar = null;
              }
              current += char;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          if (current) values.push(current.trim());

          // Clean values
          const cleanedValues = values.map(v => {
            v = v.trim();
            if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
              v = v.slice(1, -1);
            }
            v = v.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            return v;
          });

          if (cleanedValues.length >= 7) {
            const id = parseInt(cleanedValues[0]) || null;
            const name = cleanedValues[1] || null;
            const cf1 = cleanedValues[2] || null;
            const cf2 = cleanedValues[3] || null;
            const phone = normalizePhone(cleanedValues[5] || cf1 || null);
            const email = cleanEmail(cleanedValues[6] || cf2 || null);

            if (name && name.length > 1 && (phone || email)) {
              const key = phone || email || `tec_${id}`;
              
              // Skip if phone/email already exists
              if (phone && seenPhones.has(phone)) continue;
              if (email && seenEmails.has(email)) continue;

              if (!customers.has(key)) {
                customers.set(key, {
                  id: `tec_${id}`,
                  customerName: name.trim(),
                  phone,
                  email,
                  username: phone || email || `tec_customer_${id}`,
                  source: 'tec_customers'
                });
                if (phone) seenPhones.add(phone);
                if (email) seenEmails.add(email);
              }
            }
          }
        } catch (parseError) {
          // Skip malformed rows
          continue;
        }
      }
    }

    // End of INSERT statement
    if (line.trim().endsWith(';')) {
      inCustomersInsert = false;
      inTecCustomersInsert = false;
      currentTable = null;
    }
  }

  console.log(`\n✅ Extracted ${customers.size} unique customers from ${insertCount} INSERT statements`);
  console.log(`   Processed ${lineCount.toLocaleString()} total lines\n`);

  return Array.from(customers.values());
}

// Clean and validate customers
function cleanCustomers(customers) {
  console.log('🧹 Cleaning customers...\n');

  const cleaned = [];
  const seenUsernames = new Set();
  const seenPhones = new Set();
  const seenEmails = new Set();
  let duplicates = 0;
  let invalid = 0;

  for (const customer of customers) {
    // Must have at least phone or email
    if (!customer.phone && !customer.email) {
      invalid++;
      continue;
    }

    // Must have customer name
    if (!customer.customerName || customer.customerName.trim().length < 2) {
      invalid++;
      continue;
    }

    // Generate username if not set
    if (!customer.username) {
      customer.username = customer.phone || customer.email || `customer_${Date.now()}`;
    }

    // Check for duplicates
    const usernameKey = customer.username.toLowerCase();
    const phoneKey = customer.phone ? customer.phone : null;
    const emailKey = customer.email ? customer.email.toLowerCase() : null;

    if (seenUsernames.has(usernameKey) || 
        (phoneKey && seenPhones.has(phoneKey)) ||
        (emailKey && seenEmails.has(emailKey))) {
      duplicates++;
      continue;
    }

    // Clean customer name
    customer.customerName = customer.customerName.trim().substring(0, 200);

    // Add to sets
    seenUsernames.add(usernameKey);
    if (phoneKey) seenPhones.add(phoneKey);
    if (emailKey) seenEmails.add(emailKey);

    cleaned.push({
      customerName: customer.customerName,
      phone: customer.phone,
      email: customer.email,
      username: customer.username,
      password: null, // No password from old system
      hasSetPassword: false
    });
  }

  console.log(`✅ Cleaned customers:`);
  console.log(`   Valid: ${cleaned.length}`);
  console.log(`   Duplicates removed: ${duplicates}`);
  console.log(`   Invalid removed: ${invalid}\n`);

  return cleaned;
}

// Import customers to production
async function importCustomersToProduction(customers) {
  console.log('📥 Importing customers to production database...\n');

  const prodSequelize = new Sequelize(PROD_DB_CONFIG);
  const prodModels = require('../models');
  prodModels.sequelize = prodSequelize;

  // Retry connection with exponential backoff
  let connected = false;
  let retries = 3;
  while (!connected && retries > 0) {
    try {
      await prodSequelize.authenticate();
      console.log('✅ Connected to production database\n');
      connected = true;
    } catch (connError) {
      retries--;
      if (retries > 0) {
        console.log(`⚠️  Connection failed, retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        throw connError;
      }
    }
  }

  if (!connected) {
    throw new Error('Failed to connect to production database after retries');
  }

  try {

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    // Process in batches
    const batchSize = 100;
    console.log(`   Processing in batches of ${batchSize}...\n`);

    for (let i = 0; i < customers.length; i += batchSize) {
      const batch = customers.slice(i, i + batchSize);
      const transaction = await prodSequelize.transaction();

      try {
        for (const customerData of batch) {
          try {
            // Use upsert to handle conflicts
            const [customer, created] = await prodModels.Customer.upsert(customerData, {
              transaction,
              conflictFields: ['username'], // Conflict on username
              returning: true
            });

            if (created) {
              imported++;
            } else {
              skipped++;
            }
          } catch (itemError) {
            // Try to handle unique constraint on phone/email
            if (itemError.name === 'SequelizeUniqueConstraintError') {
              skipped++;
            } else {
              console.error(`   ⚠️  Error importing customer ${customerData.username}:`, itemError.message);
              errors++;
            }
          }
        }

        await transaction.commit();
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(customers.length / batchSize);
        console.log(`   ✅ Batch ${batchNum}/${totalBatches}: ${imported} imported, ${skipped} skipped, ${errors} errors`);
      } catch (batchError) {
        await transaction.rollback();
        console.error(`   ❌ Error in batch ${Math.floor(i / batchSize) + 1}:`, batchError.message);
        skipped += batch.length;
      }
    }

    console.log(`\n✅ Import complete!`);
    console.log(`   Imported: ${imported}`);
    console.log(`   Skipped (duplicates): ${skipped}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Total processed: ${customers.length}`);

  } catch (error) {
    console.error('❌ Import error:', error);
    throw error;
  } finally {
    await prodSequelize.close();
  }
}

// Main execution
async function main() {
  console.log('🚀 Importing Customers from SQL to Production Database');
  console.log('======================================================\n');

  try {
    // Step 1: Extract customers
    const rawCustomers = await extractCustomersFromSQL();

    // Step 2: Clean customers
    const cleanedCustomers = cleanCustomers(rawCustomers);

    if (cleanedCustomers.length === 0) {
      console.error('❌ No valid customers to import');
      process.exit(1);
    }

    // Step 3: Save to JSON file first (backup)
    const jsonFile = path.join(__dirname, 'customers-extracted.json');
    fs.writeFileSync(jsonFile, JSON.stringify(cleanedCustomers, null, 2));
    console.log(`💾 Saved ${cleanedCustomers.length} customers to: ${jsonFile}\n`);

    // Step 4: Import to production (with error handling)
    try {
      await importCustomersToProduction(cleanedCustomers);
    } catch (importError) {
      console.error('\n⚠️  Import to production failed, but customers are saved to JSON file.');
      console.error(`   You can retry the import later or import from: ${jsonFile}`);
      throw importError;
    }

    console.log('\n✅ All done!');
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { extractCustomersFromSQL, cleanCustomers, importCustomersToProduction };
