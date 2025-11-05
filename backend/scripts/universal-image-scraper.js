const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const db = require('../models');

// Category URLs mapping
const categoryUrls = {
  'Whisky': 'https://www.dialadrinkkenya.com/whisky',
  'Vodka': 'https://www.dialadrinkkenya.com/vodka',
  'Wine': 'https://www.dialadrinkkenya.com/wine',
  'Champagne': 'https://www.dialadrinkkenya.com/champagne',
  'Gin': 'https://www.dialadrinkkenya.com/gin',
  'Rum': 'https://www.dialadrinkkenya.com/rum',
  'Tequila': 'https://www.dialadrinkkenya.com/tequila',
  'Cognac': 'https://www.dialadrinkkenya.com/cognac',
  'Beer': 'https://www.dialadrinkkenya.com/beer',
  'Brandy': 'https://www.dialadrinkkenya.com/brandy'
};

async function scrapeImagesForCategory(categoryName, categoryUrl) {
  try {
    console.log(`\n=== Scraping ${categoryName} images ===`);
    
    // Fetch the category page
    const response = await axios.get(categoryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 30000
    });
    
    const $ = cheerio.load(response.data);
    console.log(`${categoryName} page loaded successfully`);
    
    // Extract product information
    const products = [];
    
    // Try different selectors to find products
    const selectors = [
      '.product-item',
      '.drink-item', 
      '.item',
      '.product',
      '[class*="product"]',
      '[class*="item"]',
      'div:contains("Glenfiddich")',
      'div:contains("Jameson")',
      'div:contains("Jack Daniel")',
      'div:contains("Tanqueray")',
      'div:contains("Bombay")',
      'div:contains("Gordon")',
      'div:contains("Beefeater")'
    ];
    
    selectors.forEach(selector => {
      $(selector).each((index, element) => {
        const $el = $(element);
        
        // Look for product name
        const nameText = $el.find('h1, h2, h3, h4, h5, h6, [class*="name"], [class*="title"]').first().text().trim();
        const textContent = $el.text().trim();
        
        // Look for image
        const imgSrc = $el.find('img').first().attr('src');
        
        // Look for price
        const priceText = $el.find('[class*="price"], .price').first().text().trim();
        
        if (nameText && imgSrc) {
          products.push({
            name: nameText,
            imageUrl: imgSrc,
            price: priceText,
            fullText: textContent.substring(0, 200)
          });
        }
      });
    });
    
    // Also try to find products by looking for brand names in text
    const commonBrands = [
      'Glenfiddich', 'Jameson', 'Jack Daniel', 'Johnnie Walker', 'Chivas Regal',
      'Tanqueray', 'Bombay', 'Gordon', 'Beefeater', 'Hendrick', 'Monkey Shoulder',
      'Jim Beam', 'Ballantine', 'Grant', 'Famous Grouse', 'Buchanan', 'Glenmorangie',
      'Jura', 'Laphroaig', 'Oban', 'Dalmore', 'Macallan', 'Lagavulin', 'Ardbeg',
      'Captain Morgan', 'Bacardi', 'Malibu', 'Bumbu', 'Myer', 'Old Monk',
      'Patron', 'Don Julio', 'Jose Cuervo', 'Olmeca', 'Espolon', 'Camino',
      'Hennessy', 'Martell', 'Remy Martin', 'Courvoisier', 'Camus',
      'Tusker', 'Guinness', 'Heineken', 'Pilsner', 'Savanna', 'Snapp',
      'Viceroy', 'Richot', 'Grand Marnier', 'Three Barrels', 'Pipers Heidesieck'
    ];
    
    commonBrands.forEach(brand => {
      $(`*:contains("${brand}")`).each((index, element) => {
        const $el = $(element);
        const text = $el.text().trim();
        
        // Check if this looks like a product name
        if (text.length > 5 && text.length < 100 && text.includes(brand)) {
          // Look for nearby image
          let imgSrc = $el.find('img').first().attr('src');
          
          if (!imgSrc) {
            // Check parent elements for images
            let parent = $el.parent();
            for (let i = 0; i < 3; i++) {
              imgSrc = parent.find('img').first().attr('src');
              if (imgSrc) break;
              parent = parent.parent();
            }
          }
          
          if (imgSrc) {
            products.push({
              name: text,
              imageUrl: imgSrc,
              price: null,
              fullText: text
            });
          }
        }
      });
    });
    
    // Remove duplicates
    const uniqueProducts = products.filter((product, index, self) => 
      index === self.findIndex(p => p.name === product.name)
    );
    
    console.log(`Found ${uniqueProducts.length} products with images`);
    
    // Create images directory
    const imagesDir = path.join(__dirname, `../public/images/drinks/${categoryName.toLowerCase()}`);
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    
    // Get database products
    const dbCategory = await db.Category.findOne({ where: { name: categoryName } });
    if (!dbCategory) {
      console.log(`${categoryName} category not found in database`);
      return { scraped: 0, matched: 0, downloaded: 0 };
    }
    
    const dbProducts = await db.Drink.findAll({ 
      where: { categoryId: dbCategory.id },
      attributes: ['id', 'name', 'image']
    });
    
    console.log(`Found ${dbProducts.length} ${categoryName} products in database`);
    
    let matchedCount = 0;
    let downloadedCount = 0;
    
    // Match and download images
    for (const scrapedProduct of uniqueProducts) {
      try {
        // Find matching database product
        const dbProduct = dbProducts.find(dbProd => {
          const dbName = dbProd.name.toLowerCase();
          const scrapedName = scrapedProduct.name.toLowerCase();
          
          // Exact match
          if (dbName === scrapedName) return true;
          
          // Partial match - check if key words match
          const dbWords = dbName.split(/\s+/);
          const scrapedWords = scrapedName.split(/\s+/);
          
          const matchingWords = dbWords.filter(word => 
            word.length > 2 && scrapedWords.some(sWord => 
              sWord.includes(word) || word.includes(sWord)
            )
          );
          
          return matchingWords.length >= Math.min(2, Math.max(1, dbWords.length - 1));
        });
        
        if (dbProduct && scrapedProduct.imageUrl) {
          console.log(`Matching: "${scrapedProduct.name}" -> "${dbProduct.name}"`);
          
          try {
            // Download image
            const imageResponse = await axios.get(scrapedProduct.imageUrl, {
              responseType: 'stream',
              timeout: 15000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': categoryUrl
              }
            });
            
            // Generate filename
            const fileExtension = path.extname(scrapedProduct.imageUrl.split('?')[0]) || '.jpg';
            const cleanName = scrapedProduct.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
            const fileName = `${dbProduct.id}_${cleanName}${fileExtension}`;
            const filePath = path.join(imagesDir, fileName);
            
            // Save image
            const writer = fs.createWriteStream(filePath);
            imageResponse.data.pipe(writer);
            
            await new Promise((resolve, reject) => {
              writer.on('finish', resolve);
              writer.on('error', reject);
            });
            
            // Update database
            const imagePath = `/images/drinks/${categoryName.toLowerCase()}/${fileName}`;
            await dbProduct.update({ image: imagePath });
            
            console.log(`✓ Downloaded: ${fileName}`);
            downloadedCount++;
            matchedCount++;
            
          } catch (downloadError) {
            console.log(`✗ Download failed for ${scrapedProduct.name}: ${downloadError.message}`);
          }
        }
      } catch (error) {
        console.log(`Error processing ${scrapedProduct.name}: ${error.message}`);
      }
    }
    
    console.log(`${categoryName} - Scraped: ${uniqueProducts.length}, Matched: ${matchedCount}, Downloaded: ${downloadedCount}`);
    return { scraped: uniqueProducts.length, matched: matchedCount, downloaded: downloadedCount };
    
  } catch (error) {
    console.error(`Error scraping ${categoryName}:`, error.message);
    return { scraped: 0, matched: 0, downloaded: 0 };
  }
}

async function scrapeAllImages() {
  console.log('Starting universal image scraping...');
  
  const results = {};
  let totalScraped = 0;
  let totalMatched = 0;
  let totalDownloaded = 0;
  
  for (const [categoryName, categoryUrl] of Object.entries(categoryUrls)) {
    const result = await scrapeImagesForCategory(categoryName, categoryUrl);
    results[categoryName] = result;
    totalScraped += result.scraped;
    totalMatched += result.matched;
    totalDownloaded += result.downloaded;
    
    // Add delay between requests to be respectful
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n=== Final Results ===');
  console.log(`Total scraped: ${totalScraped}`);
  console.log(`Total matched: ${totalMatched}`);
  console.log(`Total downloaded: ${totalDownloaded}`);
  
  console.log('\nPer category:');
  Object.entries(results).forEach(([category, result]) => {
    console.log(`${category}: ${result.downloaded} images downloaded`);
  });
}

// Run the scraper
scrapeAllImages().then(() => {
  console.log('Universal scraping completed');
  process.exit(0);
}).catch(error => {
  console.error('Universal scraping failed:', error);
  process.exit(1);
});

