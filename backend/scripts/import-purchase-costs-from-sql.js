/**
 * Import Purchase Costs from SQL File
 * 
 * This script:
 * 1. Parses the MySQL SQL file to extract product names and costs
 * 2. Matches products by name (with fuzzy matching)
 * 3. Updates purchasePrice in the drinks table without overwriting existing data
 */

const fs = require('fs');
const path = require('path');
const db = require('../models');
const { Op } = require('sequelize');

// Normalize product names for matching
function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Multiple spaces to single space
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\b(ml|litre|l|lt|liter)\b/gi, '') // Remove volume units
    .replace(/\b\d+\s*(ml|litre|l|lt|liter)\b/gi, '') // Remove volume with numbers
    .trim();
}

// Calculate similarity between two strings (Levenshtein distance)
function calculateSimilarity(str1, str2) {
  const s1 = normalizeName(str1);
  const s2 = normalizeName(str2);
  
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;
  
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  // If one string is much longer, similarity is low
  if (longer.length / shorter.length > 2) return 0.0;
  
  // Check if shorter is contained in longer
  if (longer.includes(shorter)) return 0.8;
  
  // Simple Levenshtein-like calculation
  let matches = 0;
  const shorterWords = shorter.split(' ');
  const longerWords = longer.split(' ');
  
  shorterWords.forEach(word => {
    if (word.length < 2) return;
    longerWords.forEach(longWord => {
      if (longWord.includes(word) || word.includes(longWord)) {
        matches++;
      }
    });
  });
  
  return matches / Math.max(shorterWords.length, longerWords.length);
}

// Parse SQL file and extract product data (streaming for large files)
function parseSQLFile(filePath) {
  console.log(`📖 Reading SQL file: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`SQL file not found: ${filePath}`);
  }
  
  const products = [];
  const seenNames = new Set();
  
  // Use streaming for large files
  const readline = require('readline');
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  let inInsertStatement = false;
  let currentStatement = '';
  let statementCount = 0;
  let processedRows = 0;
  
  return new Promise((resolve, reject) => {
    rl.on('line', (line) => {
      // Check if this line starts an INSERT statement
      if (line.match(/INSERT INTO `tec_products`/i)) {
        inInsertStatement = true;
        currentStatement = line;
        statementCount++;
        return;
      }
      
      // If we're in an INSERT statement, accumulate lines
      if (inInsertStatement) {
        currentStatement += ' ' + line;
        
        // Check if statement is complete (ends with semicolon)
        if (line.trim().endsWith(';')) {
          inInsertStatement = false;
          
          // Parse the complete statement
          try {
            const valuesMatch = currentStatement.match(/VALUES\s+(.+);/is);
            if (valuesMatch) {
              const valuesString = valuesMatch[1];
              
              // Parse rows - handle multi-line values
              // Match rows: (value1, value2, ...)
              const rowRegex = /\(([^)]+(?:\([^)]*\)[^)]*)*)\)/g;
              let rowMatch;
              
              while ((rowMatch = rowRegex.exec(valuesString)) !== null) {
                const row = rowMatch[1];
                
                // Parse CSV-like values, handling quoted strings
                const values = [];
                let currentValue = '';
                let inQuotes = false;
                let quoteChar = null;
                
                for (let i = 0; i < row.length; i++) {
                  const char = row[i];
                  
                  if (!inQuotes && (char === '"' || char === "'")) {
                    inQuotes = true;
                    quoteChar = char;
                    continue;
                  }
                  
                  if (inQuotes && char === quoteChar && (i === 0 || row[i - 1] !== '\\')) {
                    inQuotes = false;
                    quoteChar = null;
                    continue;
                  }
                  
                  if (!inQuotes && char === ',' && (i === 0 || row[i - 1] !== '\\')) {
                    values.push(currentValue.trim());
                    currentValue = '';
                    continue;
                  }
                  
                  currentValue += char;
                }
                
                if (currentValue.trim()) {
                  values.push(currentValue.trim());
                }
                
                // Extract name (index 2) and cost (index 26)
                if (values.length >= 27) {
                  const name = values[2]?.replace(/^['"]|['"]$/g, '').trim() || '';
                  const cost = parseFloat(values[26]) || null;
                  
                  if (name && cost && cost > 0) {
                    const normalized = normalizeName(name);
                    
                    // Only add if we haven't seen this normalized name
                    if (!seenNames.has(normalized)) {
                      seenNames.add(normalized);
                      products.push({
                        name: name,
                        cost: cost,
                        normalizedName: normalized
                      });
                      processedRows++;
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.warn(`⚠️  Error parsing statement ${statementCount}: ${error.message}`);
          }
          
          currentStatement = '';
          
          if (statementCount % 10 === 0) {
            console.log(`  Processed ${statementCount} INSERT statement(s), ${processedRows} products...`);
          }
        }
      }
    });
    
    rl.on('close', () => {
      console.log(`✅ Extracted ${products.length} unique products with costs`);
      console.log(`📊 Processed ${statementCount} INSERT statement(s)`);
      resolve(products);
    });
    
    rl.on('error', (error) => {
      reject(error);
    });
  });
}

// Match products and update purchase prices
async function importPurchaseCosts(sqlFilePath, overwriteExisting = false) {
  try {
    console.log('🚀 Starting purchase cost import...\n');
    
    // Connect to database
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful\n');
    
    // Parse SQL file
    const sqlProducts = await parseSQLFile(sqlFilePath);
    
    // Get all existing drinks
    console.log('📦 Fetching existing drinks from database...');
    const existingDrinks = await db.Drink.findAll({
      attributes: ['id', 'name', 'purchasePrice', 'barcode'],
      order: [['name', 'ASC']]
    });
    
    console.log(`✅ Found ${existingDrinks.length} drinks in database\n`);
    
    // Match products
    console.log('🔍 Matching products...\n');
    const matches = [];
    const unmatched = [];
    const skipped = [];
    
    for (const sqlProduct of sqlProducts) {
      let bestMatch = null;
      let bestSimilarity = 0;
      
      // Find best matching drink
      for (const drink of existingDrinks) {
        const similarity = calculateSimilarity(sqlProduct.name, drink.name);
        
        if (similarity > bestSimilarity && similarity >= 0.6) {
          bestSimilarity = similarity;
          bestMatch = drink;
        }
      }
      
      if (bestMatch) {
        // Check if purchasePrice already exists
        if (bestMatch.purchasePrice && parseFloat(bestMatch.purchasePrice) > 0) {
          if (overwriteExisting) {
            // Add to matches to overwrite
            matches.push({
              drinkId: bestMatch.id,
              drinkName: bestMatch.name,
              sqlName: sqlProduct.name,
              cost: sqlProduct.cost,
              similarity: bestSimilarity,
              overwritten: true,
              oldPrice: bestMatch.purchasePrice
            });
          } else {
            skipped.push({
              drink: bestMatch.name,
              existingPrice: bestMatch.purchasePrice,
              newPrice: sqlProduct.cost,
              similarity: bestSimilarity
            });
          }
        } else {
          matches.push({
            drinkId: bestMatch.id,
            drinkName: bestMatch.name,
            sqlName: sqlProduct.name,
            cost: sqlProduct.cost,
            similarity: bestSimilarity,
            overwritten: false
          });
        }
      } else {
        unmatched.push({
          sqlName: sqlProduct.name,
          cost: sqlProduct.cost
        });
      }
    }
    
    const overwrittenCount = matches.filter(m => m.overwritten).length;
    const newMatchesCount = matches.filter(m => !m.overwritten).length;
    
    console.log(`📊 Matching Results:`);
    console.log(`  ✅ Matched (new): ${newMatchesCount}`);
    if (overwriteExisting) {
      console.log(`  🔄 Matched (overwritten): ${overwrittenCount}`);
    } else {
      console.log(`  ⏭️  Skipped (already has price): ${skipped.length}`);
    }
    console.log(`  ❌ Unmatched: ${unmatched.length}\n`);
    
    // Update purchase prices
    if (matches.length > 0) {
      console.log('💾 Updating purchase prices...\n');
      
      let updated = 0;
      let failed = 0;
      
      for (const match of matches) {
        try {
          await db.Drink.update(
            { purchasePrice: match.cost },
            { where: { id: match.drinkId } }
          );
          updated++;
          
          if (updated % 50 === 0) {
            console.log(`  Updated ${updated}/${matches.length}...`);
          }
        } catch (error) {
          console.error(`  ❌ Failed to update ${match.drinkName}: ${error.message}`);
          failed++;
        }
      }
      
      console.log(`\n✅ Successfully updated ${updated} purchase prices`);
      if (failed > 0) {
        console.log(`❌ Failed to update ${failed} purchase prices`);
      }
    }
    
    // Generate report
    console.log('\n📄 Generating report...\n');
    
    const reportPath = path.join(__dirname, 'purchase-cost-import-report.txt');
    const report = [
      'Purchase Cost Import Report',
      '='.repeat(50),
      `Generated: ${new Date().toISOString()}`,
      '',
      `Total products in SQL file: ${sqlProducts.length}`,
      `Total drinks in database: ${existingDrinks.length}`,
      '',
      `✅ Matched and updated: ${matches.length}`,
      overwriteExisting ? `  - New: ${newMatchesCount}` : '',
      overwriteExisting ? `  - Overwritten: ${overwrittenCount}` : '',
      overwriteExisting ? '' : `⏭️  Skipped (already has price): ${skipped.length}`,
      `❌ Unmatched: ${unmatched.length}`,
      '',
      '--- Matched Products ---',
      ...matches.slice(0, 100).map(m => {
        const overwriteNote = m.overwritten ? ` [OVERWRITTEN: was KES ${m.oldPrice}]` : '';
        return `  ${m.drinkName} (similarity: ${(m.similarity * 100).toFixed(1)}%) -> KES ${m.cost.toFixed(2)}${overwriteNote}`;
      }),
      ...(matches.length > 100 ? [`  ... and ${matches.length - 100} more`] : []),
      '',
      '--- Skipped Products (Already Have Price) ---',
      ...skipped.slice(0, 50).map(s => 
        `  ${s.drink} (existing: KES ${s.existingPrice}, new: KES ${s.newPrice.toFixed(2)})`
      ),
      ...(skipped.length > 50 ? [`  ... and ${skipped.length - 50} more`] : []),
      '',
      '--- Unmatched Products (from SQL file) ---',
      ...unmatched.slice(0, 100).map(u => 
        `  ${u.sqlName} -> KES ${u.cost.toFixed(2)}`
      ),
      ...(unmatched.length > 100 ? [`  ... and ${unmatched.length - 100} more`] : [])
    ].join('\n');
    
    fs.writeFileSync(reportPath, report);
    console.log(`✅ Report saved to: ${reportPath}`);
    
    console.log('\n✅ Import completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error during import:', error);
    throw error;
  } finally {
    await db.sequelize.close();
  }
}

// Run the import
if (require.main === module) {
  // Parse arguments
  const args = process.argv.slice(2);
  const overwriteFlag = args.includes('--overwrite') || args.includes('-o');
  const sqlFilePath = args.find(arg => !arg.startsWith('--') && !arg.startsWith('-')) || '/Users/maria/Documents/dial a drink database.sql';
  
  if (!fs.existsSync(sqlFilePath)) {
    console.error(`❌ SQL file not found: ${sqlFilePath}`);
    console.error('Usage: node import-purchase-costs-from-sql.js [path-to-sql-file] [--overwrite]');
    process.exit(1);
  }
  
  if (overwriteFlag) {
    console.log('⚠️  OVERWRITE MODE: Will overwrite existing purchase prices\n');
  }
  
  importPurchaseCosts(sqlFilePath, overwriteFlag)
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { importPurchaseCosts, parseSQLFile };
