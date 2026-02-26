/**
 * Update purchase prices for ALL inventory items to match the SQL file
 * Reads from "/Users/maria/Documents/dial a drink database.sql"
 * Matches products by name and updates purchasePrice to match the cost field from SQL
 */

const db = require('../models');
const fs = require('fs');
const path = require('path');

async function updateAllPurchasePrices() {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful');
    
    // Read SQL file
    const sqlFilePath = '/Users/maria/Documents/dial a drink database.sql';
    if (!fs.existsSync(sqlFilePath)) {
      console.error(`❌ SQL file not found: ${sqlFilePath}`);
      process.exit(1);
    }
    
    console.log(`\n📖 Reading SQL file: ${sqlFilePath}\n`);
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');
    
    // Parse SQL file to extract product data
    // Looking for INSERT INTO tec_products statements
    const productData = new Map(); // name -> cost
    
    // Find all INSERT INTO tec_products and tec_products_new statements (there may be multiple)
    // Also look for simpler product table formats
    const insertPattern = /INSERT INTO\s+`?tec_products[^`]*`?\s*\([^)]+\)\s*VALUES\s*/gi;
    const insertMatches = [];
    let match;
    while ((match = insertPattern.exec(sqlContent)) !== null) {
      insertMatches.push({
        start: match.index + match[0].length,
        end: sqlContent.indexOf(';', match.index + match[0].length)
      });
    }
    
    
    console.log('📊 Parsing SQL file for product data...\n');
    
    let parsedCount = 0;
    let insertStatementCount = 0;
    
    // First, parse simple format lines that might be anywhere in the file
    const simpleFormatLines = [];
    const allLines = sqlContent.split('\n');
    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i];
      // Match simple format: (id, 'code', 'name', 'capacity', price)
      if (/^\s*\(\d+,\s*'[^']*',\s*'[^']*',\s*'[^']*',\s*\d+(?:\.\d+)?\)/.test(line)) {
        // Check if previous lines contain INSERT INTO for a products table
        let isInProductsTable = false;
        for (let j = Math.max(0, i - 10); j < i; j++) {
          if (/INSERT INTO\s+`?[^`]*products?[^`]*`?/i.test(allLines[j])) {
            isInProductsTable = true;
            break;
          }
        }
        if (isInProductsTable) {
          simpleFormatLines.push({ line, index: i });
        }
      }
    }
    
    // Parse simple format lines FIRST (these have reliable purchase prices)
    // Process them in a way that prefers non-zero costs
    for (const { line } of simpleFormatLines) {
      const simpleMatch = line.match(/^\s*\((\d+),\s*'([^']*(?:''[^']*)*)',\s*'([^']*(?:''[^']*)*)',\s*'([^']*(?:''[^']*)*)',\s*(\d+(?:\.\d+)?)\)/);
      if (simpleMatch) {
        const id = parseInt(simpleMatch[1]);
        const code = simpleMatch[2].replace(/''/g, "'");
        const name = simpleMatch[3].replace(/''/g, "'").trim();
        const capacity = simpleMatch[4].replace(/''/g, "'");
        const cost = parseFloat(simpleMatch[5]);
        
        if (!isNaN(cost) && name) {
          const nameKey = name.toLowerCase().trim();
          // Simple format: prefer non-zero costs, or higher cost if both non-zero
          if (!productData.has(nameKey)) {
            productData.set(nameKey, cost);
            parsedCount++;
          } else {
            const existingCost = productData.get(nameKey);
            // Always prefer non-zero over zero
            if (cost > 0 && existingCost === 0) {
              productData.set(nameKey, cost);
            } else if (cost > 0 && existingCost > 0 && cost > existingCost) {
              // Both non-zero, prefer higher
              productData.set(nameKey, cost);
            }
            // If existing is > 0 and new is 0, keep existing
          }
        }
      }
    }
    
    console.log(`✅ Parsed ${simpleFormatLines.length} simple format entries`);
    
    for (const insertMatch of insertMatches) {
      insertStatementCount++;
      const valuesSection = sqlContent.substring(insertMatch.start, insertMatch.end);
      const lines = valuesSection.split('\n');
      
      for (const line of lines) {
        // Check if this is the simple format: (id, 'code', 'name', 'capacity', price)
        if (insertMatch.isSimpleFormat) {
          const simpleMatch = line.match(/^\s*\((\d+),\s*'([^']*(?:''[^']*)*)',\s*'([^']*(?:''[^']*)*)',\s*'([^']*(?:''[^']*)*)',\s*(\d+(?:\.\d+)?)\)/);
          if (simpleMatch) {
            const id = parseInt(simpleMatch[1]);
            const code = simpleMatch[2].replace(/''/g, "'");
            const name = simpleMatch[3].replace(/''/g, "'").trim();
            const capacity = simpleMatch[4].replace(/''/g, "'");
            const cost = parseFloat(simpleMatch[5]);
            
            if (!isNaN(cost) && name) {
              const nameKey = name.toLowerCase();
              if (!productData.has(nameKey) || productData.get(nameKey) < cost) {
                productData.set(nameKey, cost);
              }
              parsedCount++;
            }
            continue;
          }
        }
        
        // Match lines like: (id, 'code', 'name', ...) - standard tec_products format
        // Handle both single quotes and escaped quotes
        const match = line.match(/^\s*\((\d+),\s*'([^']*(?:''[^']*)*)',\s*'([^']*(?:''[^']*)*)'/);
        if (match) {
          const id = parseInt(match[1]);
          const code = match[2].replace(/''/g, "'");
          const name = match[3].replace(/''/g, "'").trim();
          
          // Extract cost field (usually around position 26-27)
          // Need to properly parse comma-separated values, handling quoted strings
          const values = [];
          let current = '';
          let inQuotes = false;
          let quoteChar = null;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (!inQuotes && (char === "'" || char === '"')) {
              inQuotes = true;
              quoteChar = char;
              current += char;
            } else if (inQuotes && char === quoteChar && nextChar === quoteChar) {
              // Escaped quote
              current += char + nextChar;
              i++; // Skip next char
            } else if (inQuotes && char === quoteChar) {
              // End of quoted string
              inQuotes = false;
              quoteChar = null;
              current += char;
            } else if (!inQuotes && char === ',') {
              // End of value
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          if (current.trim()) {
            values.push(current.trim());
          }
          
          // Cost is typically at index 26 (0-indexed)
          // Format: id, code, name, sub_category_id, sub_category, sku, focus, category_id, category, 
          //         brand_id, brand, country_id, country, ABV, price, online_price, ruaka_prices, 
          //         drinks_delivery_prices, image, offer_status, offer_price, top_product, new_arrival, 
          //         popular, popularity, tax, cost, ...
          if (values.length > 26) {
            let costStr = values[26].trim();
            // Remove quotes and handle NULL
            costStr = costStr.replace(/^['"]|['"]$/g, '').replace(/''/g, "'");
            
            // Include all products, even if cost is 0 or NULL (set to 0)
            let cost = 0;
            if (costStr.toUpperCase() !== 'NULL' && costStr !== '' && costStr !== '0') {
              const parsedCost = parseFloat(costStr);
              if (!isNaN(parsedCost)) {
                cost = parsedCost;
              }
            }
            
            // Use name as key (case-insensitive)
            const nameKey = name.toLowerCase().trim();
            
            // Create name variations for better matching
            // e.g., "1659 Sauv Blanc 750ml" -> ["1659 sauv blanc 750ml", "1659 sauvignon blanc", "1659 sauv blanc"]
            const nameVariations = [nameKey];
            
            // Handle abbreviations: "Sauv" -> "Sauvignon"
            if (nameKey.includes('sauv') && !nameKey.includes('sauvignon')) {
              nameVariations.push(nameKey.replace(/\bsauv\b/g, 'sauvignon'));
            }
            
            // Remove capacity suffixes like "750ml", "750 ml", etc.
            const nameWithoutCapacity = nameKey.replace(/\s*\d+\s*(ml|cl|l|liters?)\s*/gi, '').trim();
            if (nameWithoutCapacity !== nameKey && nameWithoutCapacity.length > 5) {
              nameVariations.push(nameWithoutCapacity);
            }
            
            // Add all variations to productData
            for (const variation of nameVariations) {
              if (!productData.has(variation)) {
                // New entry - only add if cost > 0 (don't add zero costs)
                if (cost > 0) {
                  productData.set(variation, cost);
                }
                parsedCount++;
              } else {
                const existingCost = productData.get(variation);
                // Only update if new cost is better:
                // - New cost is > 0 and existing is 0, OR
                // - Both are > 0 and new is higher
                // NEVER overwrite non-zero with zero
                if (cost > 0 && existingCost === 0) {
                  productData.set(variation, cost);
                  parsedCount++;
                } else if (cost > 0 && existingCost > 0 && cost > existingCost) {
                  productData.set(variation, cost);
                  parsedCount++;
                }
                // If existing cost is > 0 and new is 0, keep existing (don't overwrite)
              }
            }
          }
        }
      }
    }
    
    console.log(`✅ Found ${insertStatementCount} INSERT statements`);
    
    console.log(`✅ Parsed ${parsedCount} products from SQL file`);
    console.log(`📊 Found ${productData.size} unique product names with purchase prices\n`);
    
    // Get all products from local database
    const localProducts = await db.Drink.findAll({
      attributes: ['id', 'name', 'purchasePrice', 'price'],
      order: [['id', 'ASC']]
    });
    
    console.log(`📊 Found ${localProducts.length} products in local database\n`);
    
    let updated = 0;
    let notFound = 0;
    let errors = 0;
    const notFoundProducts = [];
    
    // Update each local product if it matches SQL file
    for (const product of localProducts) {
      const nameKey = product.name.toLowerCase().trim();
      
      // Try exact match first
      let sqlPurchasePrice = productData.get(nameKey);
      
      // If not found, try fuzzy matching (remove extra spaces, handle variations)
      if (sqlPurchasePrice === undefined) {
        // Try with normalized name (remove extra spaces, handle common variations)
        const normalizedName = nameKey.replace(/\s+/g, ' ').trim();
        for (const [sqlName, sqlCost] of productData.entries()) {
          const normalizedSqlName = sqlName.replace(/\s+/g, ' ').trim();
          // Exact match after normalization
          if (normalizedName === normalizedSqlName) {
            sqlPurchasePrice = sqlCost;
            break;
          }
          // Try partial match for variations like "1659 Sauvignon Blanc" vs "1659 Sauv Blanc 750ml"
          // Check if both contain key identifying words (like "1659" and "sauv")
          const localWords = normalizedName.split(/\s+/).filter(w => w.length > 2);
          const sqlWords = normalizedSqlName.split(/\s+/).filter(w => w.length > 2);
          const commonWords = localWords.filter(w => sqlWords.includes(w));
          
          // More flexible matching: if they share significant words and one contains the other
          if (commonWords.length >= 2) {
            // Check if one name is contained in the other (handles abbreviations)
            const name1 = normalizedName.replace(/\s+/g, '');
            const name2 = normalizedSqlName.replace(/\s+/g, '');
            
            // Check if key words match (like "1659" and "sauvignon"/"sauv")
            const hasKeyMatch = commonWords.some(word => {
              const localHas = normalizedName.includes(word);
              const sqlHas = normalizedSqlName.includes(word);
              return localHas && sqlHas;
            });
            
            if (hasKeyMatch && (name1.includes(name2) || name2.includes(name1) || 
                normalizedName.includes(normalizedSqlName) || normalizedSqlName.includes(normalizedName))) {
              // Prefer non-zero cost
              if (sqlCost > 0 && (!sqlPurchasePrice || sqlPurchasePrice === 0)) {
                sqlPurchasePrice = sqlCost;
              } else if (sqlCost > 0 && sqlPurchasePrice > 0 && sqlCost < sqlPurchasePrice) {
                // If both non-zero, prefer the lower one (more likely to be correct purchase price)
                sqlPurchasePrice = sqlCost;
              } else if (!sqlPurchasePrice) {
                sqlPurchasePrice = sqlCost;
              }
            }
          }
        }
      }
      
      if (sqlPurchasePrice !== undefined) {
        const currentPurchasePrice = product.purchasePrice ? parseFloat(product.purchasePrice) : null;
        
        // Always update if different
        // Critical: If SQL has non-zero and current is zero, we MUST update
        const needsUpdate = currentPurchasePrice === null || 
                           Math.abs(currentPurchasePrice - sqlPurchasePrice) > 0.01;
        
        if (needsUpdate) {
          try {
            await product.update({ purchasePrice: sqlPurchasePrice });
            console.log(`✅ Updated: ID ${product.id} - "${product.name}" → Purchase Price: KES ${sqlPurchasePrice.toFixed(2)} (was ${currentPurchasePrice ? currentPurchasePrice.toFixed(2) : 'null'})`);
            updated++;
          } catch (error) {
            console.error(`❌ Error updating product ID ${product.id} (${product.name}):`, error.message);
            errors++;
          }
        } else {
          // Already matches, skip
          notFound++;
        }
      } else {
        // Product not found in SQL file - set purchase price to 0
        const currentPurchasePrice = product.purchasePrice ? parseFloat(product.purchasePrice) : null;
        
        // Only update if current price is not already 0
        if (currentPurchasePrice === null || Math.abs(currentPurchasePrice) > 0.01) {
          try {
            await product.update({ purchasePrice: 0 });
            console.log(`✅ Updated: ID ${product.id} - "${product.name}" → Purchase Price: KES 0.00 (not found in SQL file, was ${currentPurchasePrice ? currentPurchasePrice.toFixed(2) : 'null'})`);
            updated++;
          } catch (error) {
            console.error(`❌ Error updating product ID ${product.id} (${product.name}):`, error.message);
            errors++;
          }
        } else {
          // Already 0, skip
          notFound++;
        }
        notFoundProducts.push(product.name);
      }
    }
    
    console.log(`\n✅ Successfully updated ${updated} products`);
    console.log(`⏭️  Skipped ${notFound} products (${notFound - notFoundProducts.length} already matched, ${notFoundProducts.length} not found in SQL file)`);
    if (errors > 0) {
      console.log(`⚠️  ${errors} errors occurred`);
    }
    
    if (notFoundProducts.length > 0 && notFoundProducts.length <= 20) {
      console.log(`\n📋 Products not found in SQL file (first 20):`);
      notFoundProducts.slice(0, 20).forEach(name => {
        console.log(`   - ${name}`);
      });
    } else if (notFoundProducts.length > 20) {
      console.log(`\n📋 ${notFoundProducts.length} products not found in SQL file (showing first 20):`);
      notFoundProducts.slice(0, 20).forEach(name => {
        console.log(`   - ${name}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

updateAllPurchasePrices();
