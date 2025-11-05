const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const db = require('../models');

// Multiple image sources for better coverage
const imageSources = [
  'https://www.dialadrinkkenya.com',
  'https://www.google.com/search?tbm=isch&q=',
  'https://www.bing.com/images/search?q=',
  'https://unsplash.com/s/photos/',
  'https://pixabay.com/images/search/',
  'https://www.pexels.com/search/'
];

// Enhanced product matching with synonyms and variations
const productSynonyms = {
  'whisky': ['whiskey', 'scotch', 'bourbon', 'rye'],
  'vodka': ['vodka'],
  'gin': ['gin', 'london dry gin'],
  'rum': ['rum', 'white rum', 'dark rum', 'spiced rum'],
  'tequila': ['tequila', 'blanco', 'reposado', 'anejo'],
  'cognac': ['cognac', 'brandy'],
  'beer': ['beer', 'lager', 'ale', 'stout'],
  'brandy': ['brandy', 'cognac'],
  'wine': ['wine', 'red wine', 'white wine', 'rose wine'],
  'champagne': ['champagne', 'sparkling wine', 'prosecco'],
  'liqueur': ['liqueur', 'liquor'],
  'smokes': ['cigarettes', 'cigars', 'tobacco'],
  'vapes': ['vape', 'e-cigarette', 'electronic cigarette'],
  'soft drinks': ['soft drink', 'soda', 'juice', 'energy drink']
};

async function createFallbackImages() {
  console.log('=== Creating Fallback Images for Products Without Images ===\n');
  
  try {
    const categories = await db.Category.findAll({
      include: [{
        model: db.Drink,
        as: 'drinks',
        attributes: ['id', 'name', 'image', 'categoryId']
      }]
    });
    
    const fallbackImagesDir = path.join(__dirname, '../public/images/fallbacks');
    if (!fs.existsSync(fallbackImagesDir)) {
      fs.mkdirSync(fallbackImagesDir, { recursive: true });
    }
    
    let processedCount = 0;
    let assignedCount = 0;
    
    for (const category of categories) {
      console.log(`\nProcessing ${category.name}...`);
      
      const productsWithoutImages = category.drinks.filter(drink => !drink.image);
      console.log(`Found ${productsWithoutImages.length} products without images`);
      
      for (const product of productsWithoutImages) {
        try {
          // Strategy 1: Try to find similar products with images in the same category
          const similarProducts = category.drinks.filter(drink => 
            drink.image && drink.id !== product.id
          );
          
          if (similarProducts.length > 0) {
            // Find the most similar product by name
            const mostSimilar = findMostSimilarProduct(product.name, similarProducts);
            if (mostSimilar) {
              // Copy the image from similar product
              const sourceImagePath = path.join(__dirname, '../public', mostSimilar.image);
              if (fs.existsSync(sourceImagePath)) {
                const fileName = `${product.id}_${product.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}.jpg`;
                const targetImagePath = path.join(fallbackImagesDir, fileName);
                
                fs.copyFileSync(sourceImagePath, targetImagePath);
                
                const imagePath = `/images/fallbacks/${fileName}`;
                await product.update({ image: imagePath });
                
                console.log(`✓ Assigned similar image: ${product.name} -> ${mostSimilar.name}`);
                assignedCount++;
              }
            }
          }
          
          // Strategy 2: Create a generic category placeholder
          if (!product.image) {
            const placeholderImagePath = await createCategoryPlaceholder(category.name, product.name, product.id);
            if (placeholderImagePath) {
              await product.update({ image: placeholderImagePath });
              console.log(`✓ Created placeholder: ${product.name}`);
              assignedCount++;
            }
          }
          
          processedCount++;
          
        } catch (error) {
          console.log(`✗ Error processing ${product.name}: ${error.message}`);
        }
      }
    }
    
    console.log(`\n=== Fallback Image Creation Complete ===`);
    console.log(`Processed: ${processedCount} products`);
    console.log(`Assigned images: ${assignedCount} products`);
    
    return { processed: processedCount, assigned: assignedCount };
    
  } catch (error) {
    console.error('Error creating fallback images:', error);
    return { processed: 0, assigned: 0 };
  }
}

function findMostSimilarProduct(targetName, candidates) {
  const targetWords = targetName.toLowerCase().split(/\s+/);
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const candidate of candidates) {
    const candidateWords = candidate.name.toLowerCase().split(/\s+/);
    
    // Calculate similarity score
    let score = 0;
    
    // Exact word matches
    for (const targetWord of targetWords) {
      if (candidateWords.includes(targetWord)) {
        score += 2;
      }
    }
    
    // Partial word matches
    for (const targetWord of targetWords) {
      for (const candidateWord of candidateWords) {
        if (candidateWord.includes(targetWord) || targetWord.includes(candidateWord)) {
          score += 1;
        }
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }
  
  return bestScore > 0 ? bestMatch : null;
}

async function createCategoryPlaceholder(categoryName, productName, productId) {
  try {
    const fallbackImagesDir = path.join(__dirname, '../public/images/fallbacks');
    const fileName = `${productId}_${productName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_placeholder.jpg`;
    const filePath = path.join(fallbackImagesDir, fileName);
    
    // Create a simple placeholder image using a canvas-like approach
    // For now, we'll create a text-based placeholder
    const placeholderContent = createTextPlaceholder(categoryName, productName);
    
    // Write a simple SVG placeholder
    const svgContent = `
      <svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="300" height="200" fill="#f0f0f0" stroke="#ccc" stroke-width="2"/>
        <text x="150" y="80" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#666">
          ${categoryName}
        </text>
        <text x="150" y="120" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#999">
          ${productName.length > 30 ? productName.substring(0, 30) + '...' : productName}
        </text>
        <text x="150" y="140" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#aaa">
          Image Coming Soon
        </text>
      </svg>
    `;
    
    fs.writeFileSync(filePath.replace('.jpg', '.svg'), svgContent);
    
    return `/images/fallbacks/${fileName.replace('.jpg', '.svg')}`;
    
  } catch (error) {
    console.error(`Error creating placeholder for ${productName}:`, error);
    return null;
  }
}

function createTextPlaceholder(categoryName, productName) {
  return `${categoryName} - ${productName}`;
}

// Run the fallback image creation
createFallbackImages().then((result) => {
  console.log('\n=== Fallback Image Creation Complete ===');
  console.log(`Processed: ${result.processed} products`);
  console.log(`Assigned images: ${result.assigned} products`);
  process.exit(0);
}).catch(error => {
  console.error('Fallback image creation failed:', error);
  process.exit(1);
});

