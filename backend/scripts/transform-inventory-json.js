/**
 * Transform Inventory JSON from External Format to Database Format
 * 
 * This script transforms JSON data from an external format (with nested fields)
 * to the format expected by the database.
 * 
 * Usage: node backend/scripts/transform-inventory-json.js <input-json-file> [output-json-file]
 * 
 * If output file is not specified, it will create a file with "-transformed" suffix
 */

const fs = require('fs');
const path = require('path');
const db = require('../models');

/**
 * Extract price from priceOptions
 * Returns the lowest price found, or null if no prices
 */
function extractPrice(priceOptions) {
  if (!priceOptions || !Array.isArray(priceOptions) || priceOptions.length === 0) {
    return null;
  }
  
  const prices = priceOptions
    .map(option => {
      // Try to extract price from name like "750ML. (Ksh 1800)" or "750ml (ksh 2400)" or "750ML. (KES 2000)"
      const match = option.name ? option.name.match(/(?:Ksh|KES)\s*(\d+(?:[.,]\d+)?)/i) : null;
      if (match) {
        return parseFloat(match[1].replace(',', ''));
      }
      // Or use price field if it exists
      if (option.price) {
        return parseFloat(option.price);
      }
      return null;
    })
    .filter(p => p !== null);
  
  return prices.length > 0 ? Math.min(...prices) : null;
}

/**
 * Transform priceOptions to capacityPricing format
 */
function transformCapacityPricing(priceOptions) {
  if (!priceOptions || !Array.isArray(priceOptions)) {
    return [];
  }
  
  return priceOptions.map(option => {
    let price = null;
    let size = null;
    
    // Extract price from name like "750ML. (Ksh 1800)" or "750ml (ksh 2400)" or "750ML. (KES 2000)"
    const priceMatch = option.name ? option.name.match(/(?:Ksh|KES)\s*(\d+(?:[.,]\d+)?)/i) : null;
    if (priceMatch) {
      price = parseFloat(priceMatch[1].replace(',', ''));
    } else if (option.price) {
      price = parseFloat(option.price);
    }
    
    // Extract size from name like "750ML. (Ksh 1800)"
    const sizeMatch = option.name ? option.name.match(/^([^(]+)/) : null;
    if (sizeMatch) {
      size = sizeMatch[1].trim();
    } else if (option.size) {
      size = option.size;
    }
    
    return {
      size: size || 'Standard',
      price: price || 0,
      originalPrice: price || 0
    };
  });
}

/**
 * Extract capacity array from priceOptions
 */
function extractCapacity(priceOptions) {
  if (!priceOptions || !Array.isArray(priceOptions)) {
    return [];
  }
  
  return priceOptions
    .map(option => {
      // Extract size from name like "750ML. (Ksh 1800)"
      const sizeMatch = option.name ? option.name.match(/^([^(]+)/) : null;
      if (sizeMatch) {
        return sizeMatch[1].trim();
      }
      return option.size || null;
    })
    .filter(c => c !== null);
}

/**
 * Extract image URL from image object
 */
function extractImageUrl(imageObj) {
  if (!imageObj) {
    return null;
  }
  
  // Prefer secure_url, fallback to url
  if (imageObj.secure_url) {
    return imageObj.secure_url;
  }
  if (imageObj.url) {
    return imageObj.url;
  }
  if (typeof imageObj === 'string') {
    return imageObj;
  }
  
  return null;
}

/**
 * Transform a single drink item from external format to database format
 */
function transformDrinkItem(item, categoryMap, brandMap, subCategoryMap) {
  // Handle both formats: with nested 'fields' or flat structure
  const fields = item.fields || item;
  
  // Extract basic info
  const name = (item.name || fields.name || '').trim();
  if (!name) {
    return null; // Skip items without name
  }
  
  // Extract price from priceOptions
  const price = extractPrice(fields.priceOptions) || 0;
  
  // Transform capacity and pricing
  const capacity = extractCapacity(fields.priceOptions);
  const capacityPricing = transformCapacityPricing(fields.priceOptions);
  
  // Extract image
  const image = extractImageUrl(fields.image);
  
  // Map alcohol content
  const abv = fields.alcoholContent ? parseFloat(fields.alcoholContent) : null;
  
  // Map stock and availability
  // Note: The external format has `inStock` boolean, but we need actual stock numbers
  // We'll set stock based on inStock flag (default to 10 if in stock, 0 if not)
  // You may need to adjust this based on your actual data
  const inStock = fields.inStock !== false; // Default to true if not specified
  const stock = inStock ? (fields.stock || fields.reorderLevel || 10) : 0;
  const isAvailable = inStock;
  
  // Map category, subcategory, and brand
  // The API export with expandRelationshipFields=true provides these as objects
  let categoryId = null;
  let subCategoryId = null;
  let brandId = null;
  
  // Category name mappings (old name -> new name)
  const categoryNameMappings = {
    'Liqueurs': 'Liqueur',
    'Beers': 'Beer',
    'Mixer spirit': 'Soft Drinks'
  };

  // Handle expanded category field (object with id and name)
  if (fields.category) {
    if (typeof fields.category === 'object' && fields.category.id) {
      // Expanded relationship - map the name, not the ID (since IDs are different)
      const categoryName = fields.category.name;
      const mappedName = categoryNameMappings[categoryName] || categoryName;
      if (categoryMap[mappedName]) {
        categoryId = categoryMap[mappedName].id;
      }
    } else if (typeof fields.category === 'string') {
      // Just a name - look it up
      const mappedName = categoryNameMappings[fields.category] || fields.category;
      if (categoryMap[mappedName]) {
        categoryId = categoryMap[mappedName].id;
      }
    }
  } else {
    // Fallback: Try to find category by name from tags
    const categoryName = extractCategoryFromTags(fields.tags);
    if (categoryName) {
      const mappedName = categoryNameMappings[categoryName] || categoryName;
      if (categoryMap[mappedName]) {
        categoryId = categoryMap[mappedName].id;
      }
    }
  }
  
  // Handle expanded subCategory field
  // Always map by name, not by ID
  if (fields.subCategory && categoryId) {
    let subCategoryName = null;
    if (typeof fields.subCategory === 'object' && fields.subCategory.name) {
      subCategoryName = fields.subCategory.name.trim();
    } else if (typeof fields.subCategory === 'string') {
      subCategoryName = fields.subCategory.trim();
    }
    
    if (subCategoryName) {
      const subKey = `${subCategoryName.toLowerCase()}_${categoryId}`;
      if (subCategoryMap[subKey]) {
        subCategoryId = subCategoryMap[subKey].id;
      } else {
        // Try case-insensitive match
        const subKeyLower = Object.keys(subCategoryMap).find(
          key => key.toLowerCase() === subKey.toLowerCase()
        );
        if (subKeyLower) {
          subCategoryId = subCategoryMap[subKeyLower].id;
        }
      }
    }
  } else if (categoryId) {
    // Fallback: Try to find subcategory from tags
    const categoryName = fields.category?.name || 
                        (categoryId ? Object.values(categoryMap).find(c => c.id === categoryId)?.name : null) ||
                        extractCategoryFromTags(fields.tags);
    if (categoryName) {
      const subCategoryName = extractSubCategoryFromTags(fields.tags, categoryName);
      if (subCategoryName) {
        const subKey = `${subCategoryName.toLowerCase()}_${categoryId}`;
        if (subCategoryMap[subKey]) {
          subCategoryId = subCategoryMap[subKey].id;
        }
      }
    }
  }
  
  // Handle expanded brand field
  // Always map by name, not by ID (since IDs from old system don't match new system)
  if (fields.brand) {
    let brandName = null;
    if (typeof fields.brand === 'object' && fields.brand.name) {
      brandName = fields.brand.name.trim();
    } else if (typeof fields.brand === 'string') {
      brandName = fields.brand.trim();
    }
    
    if (brandName) {
      // Try exact match first
      if (brandMap[brandName]) {
        brandId = brandMap[brandName].id;
      } else {
        // Try case-insensitive match
        const brandKey = Object.keys(brandMap).find(
          key => key.toLowerCase() === brandName.toLowerCase()
        );
        if (brandKey) {
          brandId = brandMap[brandKey].id;
        }
      }
    }
  } else {
    // Fallback: Try to find brand by name
    const brandName = extractBrandFromName(name) || extractBrandFromTags(fields.tags);
    if (brandName) {
      // Try exact match first
      if (brandMap[brandName]) {
        brandId = brandMap[brandName].id;
      } else {
        // Try case-insensitive match
        const brandKey = Object.keys(brandMap).find(
          key => key.toLowerCase() === brandName.toLowerCase()
        );
        if (brandKey) {
          brandId = brandMap[brandKey].id;
        }
      }
    }
  }
  
  // Build the transformed drink object
  const transformed = {
    name: name,
    description: fields.description || null,
    price: price,
    originalPrice: fields.onOffer ? price : null,
    image: image,
    categoryId: categoryId,
    subCategoryId: subCategoryId,
    brandId: brandId,
    isAvailable: isAvailable,
    isPopular: fields.isPopular || false,
    isBrandFocus: fields.isBrandFocus || false,
    isOnOffer: fields.onOffer || false,
    limitedTimeOffer: false, // Not in external format
    capacity: capacity,
    capacityPricing: capacityPricing,
    abv: abv,
    barcode: fields.barcode ? String(fields.barcode).substring(0, 255) : null, // Ensure barcode is string and within length limit
    stock: stock,
    purchasePrice: null // Not in external format
  };
  
  return transformed;
}

/**
 * Extract category name from tags or other fields
 * This is a helper function - adjust based on your data
 */
function extractCategoryFromTags(tags) {
  if (!tags || !Array.isArray(tags)) {
    return null;
  }
  
  // Common category keywords (order matters - more specific first)
  const categoryKeywords = [
    ['champagne', 'Champagne'],
    ['whisky', 'Whisky'],
    ['whiskey', 'Whisky'],
    ['vodka', 'Vodka'],
    ['beer', 'Beer'],
    ['brandy', 'Brandy'],
    ['cognac', 'Cognac'],
    ['tequila', 'Tequila'],
    ['rum', 'Rum'],
    ['gin', 'Gin'],
    ['liqueur', 'Liqueur'],
    ['wine', 'Wine'] // Wine should be last as it's more general
  ];
  
  const tagString = tags.join(' ').toLowerCase();
  for (const [keyword, category] of categoryKeywords) {
    if (tagString.includes(keyword)) {
      return category;
    }
  }
  
  return null;
}

/**
 * Extract subcategory name from tags
 */
function extractSubCategoryFromTags(tags, categoryName) {
  if (!tags || !Array.isArray(tags)) {
    return null;
  }
  
  const tagString = tags.join(' ').toLowerCase();
  
  // Wine subcategories
  if (categoryName === 'Wine') {
    if (tagString.includes('rose') || tagString.includes('rosé')) {
      return 'Rose Wine';
    }
    if (tagString.includes('red wine') || tagString.includes('red-wine')) {
      return 'Red Wine';
    }
    if (tagString.includes('white wine') || tagString.includes('white-wine')) {
      return 'White Wine';
    }
    // Default to "All Wine" if no specific type found
    return 'All Wine';
  }
  
  // Add other category subcategory mappings as needed
  return null;
}

/**
 * Extract brand name from product name or tags
 */
function extractBrandFromName(name) {
  // Simple extraction - first word or two words before common keywords
  // This is a placeholder - adjust based on your naming convention
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    // Return first 1-2 words as potential brand
    return words.slice(0, 2).join(' ').trim();
  }
  return words[0] || null;
}

function extractBrandFromTags(tags) {
  // Look for brand-related tags
  if (!tags || !Array.isArray(tags)) {
    return null;
  }
  
  // Look for tags containing "Brand"
  const brandTag = tags.find(tag => 
    typeof tag === 'string' && tag.toLowerCase().includes('brand')
  );
  
  if (brandTag) {
    // Extract brand name from tag like "Amani Bay Brand"
    const match = brandTag.match(/(.+?)\s+Brand/i);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
}

async function transformInventory(inputFilePath, outputFilePath) {
  try {
    // Validate input file
    if (!inputFilePath) {
      console.error('❌ Error: Please provide the path to the input JSON file');
      console.log('\nUsage: node backend/scripts/transform-inventory-json.js <input-json-file> [output-json-file]');
      process.exit(1);
    }
    
    const inputFullPath = path.isAbsolute(inputFilePath)
      ? inputFilePath
      : path.join(process.cwd(), inputFilePath);
    
    if (!fs.existsSync(inputFullPath)) {
      console.error(`❌ Error: Input file not found: ${inputFullPath}`);
      process.exit(1);
    }
    
    // Determine output file path
    if (!outputFilePath) {
      const inputDir = path.dirname(inputFullPath);
      const inputBase = path.basename(inputFullPath, path.extname(inputFullPath));
      outputFilePath = path.join(inputDir, `${inputBase}-transformed.json`);
    }
    
    const outputFullPath = path.isAbsolute(outputFilePath)
      ? outputFilePath
      : path.join(process.cwd(), outputFilePath);
    
    console.log('🔌 Connecting to database...');
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful\n');
    
    // Load categories, brands, and subcategories for mapping
    console.log('📋 Loading categories, brands, and subcategories...');
    const categories = await db.Category.findAll();
    const brands = await db.Brand.findAll();
    const subCategories = await db.SubCategory.findAll();
    
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.name] = cat;
    });
    
    const brandMap = {};
    brands.forEach(brand => {
      brandMap[brand.name] = brand;
    });
    
    const subCategoryMap = {};
    subCategories.forEach(sub => {
      const key = `${sub.name}_${sub.categoryId}`;
      subCategoryMap[key] = sub;
      // Also add case-insensitive lookup
      const keyLower = `${sub.name.toLowerCase()}_${sub.categoryId}`;
      if (!subCategoryMap[keyLower]) {
        subCategoryMap[keyLower] = sub;
      }
    });
    
    console.log(`   Found ${categories.length} categories`);
    console.log(`   Found ${brands.length} brands`);
    console.log(`   Found ${subCategories.length} subcategories\n`);
    
    // Read and parse input JSON
    console.log(`📖 Reading input file: ${inputFullPath}`);
    const fileContent = fs.readFileSync(inputFullPath, 'utf8');
    let inputData;
    
    try {
      inputData = JSON.parse(fileContent);
    } catch (parseError) {
      console.error('❌ Error: Invalid JSON file');
      console.error(`   ${parseError.message}`);
      process.exit(1);
    }
    
    // Extract items array (handle both array and object formats)
    let items = [];
    if (Array.isArray(inputData)) {
      items = inputData;
    } else if (inputData.items && Array.isArray(inputData.items)) {
      items = inputData.items;
    } else if (inputData.drinks && Array.isArray(inputData.drinks)) {
      items = inputData.drinks;
    } else {
      console.error('❌ Error: JSON must contain an array of items, or an object with "items" or "drinks" array');
      process.exit(1);
    }
    
    console.log(`✅ Found ${items.length} items in input file\n`);
    
    // Transform items
    console.log('🔄 Transforming items...');
    const transformedDrinks = [];
    let skipped = 0;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const transformed = transformDrinkItem(item, categoryMap, brandMap, subCategoryMap);
      
      if (transformed) {
        transformedDrinks.push(transformed);
      } else {
        skipped++;
        if (skipped <= 10) {
          console.warn(`⚠️  Skipped item ${i + 1}: Missing required fields`);
        }
      }
      
      if ((i + 1) % 100 === 0) {
        console.log(`   Processed ${i + 1}/${items.length} items...`);
      }
    }
    
    console.log(`✅ Transformed ${transformedDrinks.length} items`);
    if (skipped > 0) {
      console.log(`⚠️  Skipped ${skipped} items\n`);
    }
    
    // Write transformed data to output file
    console.log(`\n💾 Writing transformed data to: ${outputFullPath}`);
    const outputData = {
      drinks: transformedDrinks
    };
    
    fs.writeFileSync(outputFullPath, JSON.stringify(outputData, null, 2), 'utf8');
    
    console.log('✅ Transformation complete!\n');
    console.log(`📄 Output file: ${outputFullPath}`);
    console.log(`📊 Total drinks: ${transformedDrinks.length}\n`);
    
    // Show summary
    const withCategories = transformedDrinks.filter(d => d.categoryId).length;
    const withBrands = transformedDrinks.filter(d => d.brandId).length;
    const withImages = transformedDrinks.filter(d => d.image).length;
    const withStock = transformedDrinks.filter(d => d.stock > 0).length;
    
    console.log('📊 Summary:');
    console.log(`   Items with category: ${withCategories}`);
    console.log(`   Items with brand: ${withBrands}`);
    console.log(`   Items with image: ${withImages}`);
    console.log(`   Items in stock: ${withStock}\n`);
    
    console.log('✅ Done! You can now import using:');
    console.log(`   node backend/scripts/import-inventory-from-json.js ${outputFullPath}\n`);
    
  } catch (error) {
    console.error('❌ Error transforming inventory:', error);
    process.exit(1);
  } finally {
    await db.sequelize.close();
  }
}

// Get file paths from command line arguments
const inputFilePath = process.argv[2];
const outputFilePath = process.argv[3];

// Run the transformation
transformInventory(inputFilePath, outputFilePath);
