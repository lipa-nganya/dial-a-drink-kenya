const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const db = require('../models');

// Comprehensive category URLs mapping
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
  'Brandy': 'https://www.dialadrinkkenya.com/brandy',
  'Liqueur': 'https://www.dialadrinkkenya.com/liquer',
  'Smokes': 'https://www.dialadrinkkenya.com/smokes',
  'Vapes': 'https://www.dialadrinkkenya.com/vapes',
  'Soft Drinks': 'https://www.dialadrinkkenya.com/soft-drinks'
};

// Enhanced brand patterns for better matching
const enhancedBrandPatterns = {
  'Whisky': [
    'Glenfiddich', 'Jameson', 'Jack Daniel', 'Johnnie Walker', 'Chivas Regal', 'Ballantine', 'Grant', 'Famous Grouse', 'Buchanan', 'Glenmorangie', 'Jura', 'Laphroaig', 'Oban', 'Dalmore', 'Macallan', 'Lagavulin', 'Ardbeg', 'Monkey Shoulder', 'Jim Beam', 'Black and White', 'JnB', 'Reki', 'Kura', 'Nikka', 'Chita', 'Kurayoshi', 'Hakushu', 'Hombo', 'Proper No.Twelve', 'Royal Salute', 'Sexton', 'Old Forester', 'Mortlach', '8PM', 'Kawashima', 'Singleton', 'VAT 69', 'William Lawson', 'Dalwhinnie', 'Clynelish', 'Whytehall', 'Fireball', 'King George', 'Glendale', 'Benchmark', 'All Seasons', 'Amrut', 'Glenlivet', 'Glen Grant', 'Aberlour', 'Balvenie', 'Cardhu', 'Cragganmore', 'Dalwhinnie', 'Glen Deveron', 'Glen Elgin', 'Glen Keith', 'Glen Moray', 'Glen Spey', 'Glenburgie', 'Glendullan', 'Glentauchers', 'Inchgower', 'Kininvie', 'Linkwood', 'Mannochmore', 'Miltonduff', 'Mortlach', 'Royal Brackla', 'Speyburn', 'Strathmill', 'Tamnavulin', 'Tomintoul', 'Tormore', 'Auchroisk', 'Benrinnes', 'Blair Athol', 'Cragganmore', 'Dailuaine', 'Dalwhinnie', 'Dufftown', 'Glen Elgin', 'Glen Spey', 'Glendullan', 'Glentauchers', 'Inchgower', 'Kininvie', 'Linkwood', 'Mannochmore', 'Miltonduff', 'Mortlach', 'Royal Brackla', 'Speyburn', 'Strathmill', 'Tamnavulin', 'Tomintoul', 'Tormore'
  ],
  'Vodka': [
    'Absolut', 'Smirnoff', 'Grey Goose', 'Ciroc', 'KGB', 'Flirt', 'Elite', 'Haku', 'Bols', 'Beluga', 'Craft', 'Amsterdam', 'Billionaire', 'Ketel One', 'Tito', 'Stolichnaya', 'Russian Standard', 'Finlandia', 'Skyy', 'Svedka', 'Three Olives', 'Chopin', 'Belvedere', 'Reyka', 'Hangar 1', 'Tito', 'Deep Eddy', 'Prairie Organic', 'Monopolowa', 'Luksusowa', 'Wyborowa', 'Zubrowka', 'Sobieski', 'Chopin', 'Belvedere', 'Reyka', 'Hangar 1', 'Tito', 'Deep Eddy', 'Prairie Organic', 'Monopolowa', 'Luksusowa', 'Wyborowa', 'Zubrowka', 'Sobieski'
  ],
  'Gin': [
    'Tanqueray', 'Bombay', 'Gordon', 'Beefeater', 'Hendrick', 'Drumshanbo', 'Stretton', 'Gilbey', '58', 'Monkey 47', 'Sipsmith', 'Plymouth', 'Hayman', 'Bloom', 'Opihr', 'No. 3', 'Malfy', 'The Botanist', 'Gin Mare', 'Martin Miller', 'Portobello Road', 'Sipsmith', 'Whitley Neill', 'Brockmans', 'Caorunn', 'Edinburgh', 'Gin Mare', 'Hendrick', 'Junipero', 'Koval', 'Le Tribute', 'Malfy', 'Monkey 47', 'No. 3', 'Opihr', 'Plymouth', 'Portobello Road', 'Sipsmith', 'Tanqueray', 'The Botanist', 'Whitley Neill', 'Brockmans', 'Caorunn', 'Edinburgh', 'Gin Mare', 'Hendrick', 'Junipero', 'Koval', 'Le Tribute', 'Malfy', 'Monkey 47', 'No. 3', 'Opihr', 'Plymouth', 'Portobello Road', 'Sipsmith', 'Tanqueray', 'The Botanist', 'Whitley Neill'
  ],
  'Rum': [
    'Captain Morgan', 'Bacardi', 'Malibu', 'Bumbu', 'Myer', 'Old Monk', 'Angostura', 'Bahari', 'Bayou', 'Afri Bull', 'Appleton', 'Mount Gay', 'Havana Club', 'Diplomatico', 'Zacapa', 'Plantation', 'Gosling', 'Kraken', 'Sailor Jerry', 'Pyrat', 'El Dorado', 'Flor de Cana', 'Ron Zacapa', 'Havana Club', 'Mount Gay', 'Appleton', 'Diplomatico', 'Zacapa', 'Plantation', 'Gosling', 'Kraken', 'Sailor Jerry', 'Pyrat', 'El Dorado', 'Flor de Cana', 'Ron Zacapa', 'Havana Club', 'Mount Gay', 'Appleton', 'Diplomatico', 'Zacapa', 'Plantation', 'Gosling', 'Kraken', 'Sailor Jerry', 'Pyrat', 'El Dorado', 'Flor de Cana'
  ],
  'Tequila': [
    'Patron', 'Don Julio', 'Jose Cuervo', 'Olmeca', 'Espolon', 'Camino', 'Azul', 'Agavita', 'Herradura', 'Casa Noble', 'Milagro', 'Tres Agaves', '1800', 'Sauza', 'El Jimador', 'Corralejo', 'Kah', 'Gran Centenario', 'Cazadores', 'Hornitos', 'Lunazul', 'Pueblo Viejo', 'Tres Generaciones', 'Centenario', 'Casa Dragones', 'Clase Azul', 'Don Julio', 'Herradura', 'Patron', 'Jose Cuervo', 'Olmeca', 'Espolon', 'Camino', 'Azul', 'Agavita', 'Herradura', 'Casa Noble', 'Milagro', 'Tres Agaves', '1800', 'Sauza', 'El Jimador', 'Corralejo', 'Kah', 'Gran Centenario'
  ],
  'Cognac': [
    'Hennessy', 'Martell', 'Remy Martin', 'Courvoisier', 'Camus', 'Biscut', 'Hine', 'Hardy', 'Frapin', 'Pierre Ferrand', 'Delamain', 'Louis XIII', 'Camus', 'Biscut', 'Hine', 'Hardy', 'Frapin', 'Pierre Ferrand', 'Delamain', 'Louis XIII', 'Camus', 'Biscut', 'Hine', 'Hardy', 'Frapin', 'Pierre Ferrand', 'Delamain', 'Louis XIII'
  ],
  'Beer': [
    'Tusker', 'Guinness', 'Heineken', 'Pilsner', 'Savanna', 'Snapp', 'Balozi', 'Bavaria', 'Corona', 'Stella Artois', 'Budweiser', 'Carlsberg', 'Amstel', 'Peroni', 'Asahi', 'Sapporo', 'Kirin', 'Tiger', 'Singha', 'Chang', 'San Miguel', 'Dos Equis', 'Modelo', 'Miller', 'Coors', 'Samuel Adams', 'Blue Moon', 'Leinenkugel', 'Shock Top', 'Michelob', 'Bud Light', 'Miller Lite', 'Coors Light', 'Corona Light', 'Stella Artois', 'Heineken Light', 'Amstel Light', 'Peroni', 'Asahi', 'Sapporo', 'Kirin', 'Tiger', 'Singha', 'Chang', 'San Miguel', 'Dos Equis', 'Modelo'
  ],
  'Brandy': [
    'Viceroy', 'Richot', 'Grand Marnier', 'Three Barrels', 'Pipers Heidesieck', 'Emperador', 'Bardinet', 'Metaxa', 'St. Remy', 'Asbach', 'Torres', 'Fundador', 'Carlos I', 'Soberano', 'Magno', 'Osborne', 'Cardenal Mendoza', 'Lepanto', 'Carlos I', 'Soberano', 'Magno', 'Osborne', 'Cardenal Mendoza', 'Lepanto', 'Carlos I', 'Soberano', 'Magno', 'Osborne', 'Cardenal Mendoza', 'Lepanto'
  ],
  'Wine': [
    'Robertson', 'Rosso Nobile', 'Choco Secco', 'Brancott Estate', 'Alma Mora', '4th Street', 'Nederburg', 'Mateus', 'Four Cousins', 'Namaqua', 'Cellar Cask', '1659', 'Asconi', 'Arthur Metz', 'Moet', 'Dom Perignon', 'Veuve Clicquot', 'Laurent Perrier', 'Perrier Jouet', 'Belaire', 'Ace Of Spades', 'Cristal', 'Krug', 'Bollinger', 'Taittinger', 'Pol Roger', 'Mumm', 'Piper-Heidsieck', 'Lanson', 'Nicolas Feuillatte', 'Moet', 'Dom Perignon', 'Veuve Clicquot', 'Laurent Perrier', 'Perrier Jouet', 'Belaire', 'Ace Of Spades', 'Cristal', 'Krug', 'Bollinger', 'Taittinger', 'Pol Roger', 'Mumm', 'Piper-Heidsieck', 'Lanson', 'Nicolas Feuillatte'
  ],
  'Champagne': [
    'Moët & Chandon', 'Dom Pérignon', 'Belaire', 'Veuve Clicquot', 'Laurent Perrier', 'Perrier Jouet', 'Ace Of Spades', 'Cristal', 'Krug', 'Bollinger', 'Taittinger', 'Pol Roger', 'Mumm', 'Piper-Heidsieck', 'Lanson', 'Nicolas Feuillatte', 'Moet', 'Dom Perignon', 'Veuve Clicquot', 'Laurent Perrier', 'Perrier Jouet', 'Belaire', 'Ace Of Spades', 'Cristal', 'Krug', 'Bollinger', 'Taittinger', 'Pol Roger', 'Mumm', 'Piper-Heidsieck', 'Lanson', 'Nicolas Feuillatte'
  ],
  'Liqueur': [
    'Baileys', 'Amarula', 'Jagermeister', 'Martini', 'Sheridan', 'Zappa', 'Kahlua', 'Grand Marnier', 'Cointreau', 'Triple Sec', 'Chambord', 'Frangelico', 'Sambuca', 'Galliano', 'Drambuie', 'Benedictine', 'Chartreuse', 'Baileys', 'Amarula', 'Jagermeister', 'Martini', 'Sheridan', 'Zappa', 'Kahlua', 'Grand Marnier', 'Cointreau', 'Triple Sec', 'Chambord', 'Frangelico', 'Sambuca', 'Galliano', 'Drambuie', 'Benedictine', 'Chartreuse'
  ],
  'Smokes': [
    'Embassy', 'Sportsman', 'Sweet Menthol', 'Classic Raw Rolling', 'Dunhill', 'Marlboro', 'Al Capone', 'Camel', 'Winston', 'Lucky Strike', 'Kent', 'Parliament', 'Benson & Hedges', 'Rothmans', 'Davidoff', 'Embassy', 'Sportsman', 'Sweet Menthol', 'Classic Raw Rolling', 'Dunhill', 'Marlboro', 'Al Capone', 'Camel', 'Winston', 'Lucky Strike', 'Kent', 'Parliament', 'Benson & Hedges', 'Rothmans', 'Davidoff'
  ],
  'Vapes': [
    'Beast Vape', 'Woosh Vapes', 'Tugboat', 'AKSO VAPES', 'Elf Bar', 'Lost Mary', 'Geek Bar', 'Crystal Bar', 'Hyde', 'Puff Bar', 'Breeze', 'Air Bar', 'Fume', 'Esco Bars', 'Beast Vape', 'Woosh Vapes', 'Tugboat', 'AKSO VAPES', 'Elf Bar', 'Lost Mary', 'Geek Bar', 'Crystal Bar', 'Hyde', 'Puff Bar', 'Breeze', 'Air Bar', 'Fume', 'Esco Bars'
  ],
  'Soft Drinks': [
    'Coca Cola', 'Schweppes', 'Delmonte', 'Fitch & leedes', 'Monster Energy', 'Red Bull', 'Akso', 'Aquamist', 'Beast Mode', 'Coca Cola', 'Schweppes', 'Delmonte', 'Fitch & leedes', 'Monster Energy', 'Red Bull', 'Akso', 'Aquamist', 'Beast Mode', 'Coca Cola', 'Schweppes', 'Delmonte', 'Fitch & leedes', 'Monster Energy', 'Red Bull', 'Akso', 'Aquamist', 'Beast Mode'
  ]
};

async function scrapeImagesForCategory(categoryName, categoryUrl) {
  try {
    console.log(`\n=== Comprehensive Scraping ${categoryName} ===`);
    
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
    
    // Enhanced product extraction with multiple methods
    const products = [];
    
    // Method 1: Extract all images and find associated text
    $('img').each((index, element) => {
      const $img = $(element);
      const src = $img.attr('src');
      
      if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('banner') && !src.includes('header') && !src.includes('footer')) {
        // Look for nearby text that could be a product name
        let productName = null;
        
        // Check parent elements for text
        let currentElement = $img.parent();
        for (let i = 0; i < 6; i++) {
          if (currentElement.length === 0) break;
          
          const text = currentElement.text().trim();
          if (text && text.length > 3 && text.length < 150) {
            // Split by lines and find the most likely product name
            const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            for (const line of lines) {
              if (line.length > 3 && line.length < 80 && 
                  !line.includes('KES') && !line.includes('Add to Cart') && 
                  !line.includes('Loading') && !line.includes('Home') && 
                  !line.includes('Contact') && !line.includes('Delivery') &&
                  !line.includes('Copyright') && !line.includes('All Rights Reserved')) {
                productName = line;
                break;
              }
            }
            if (productName) break;
          }
          currentElement = currentElement.parent();
        }
        
        if (productName) {
          products.push({
            name: productName,
            imageUrl: src,
            price: null,
            fullText: productName
          });
        }
      }
    });
    
    // Method 2: Look for text patterns that look like product names
    const textElements = $('*');
    textElements.each((index, element) => {
      const $el = $(element);
      const text = $el.text().trim();
      
      // Skip if text is too short or too long
      if (text.length < 5 || text.length > 100) return;
      
      // Skip if it contains common non-product text
      if (text.includes('Add to Cart') || text.includes('KES') || text.includes('Loading') || 
          text.includes('Home') || text.includes('Contact') || text.includes('Delivery') ||
          text.includes('Copyright') || text.includes('All Rights Reserved') || 
          text.includes('Terms') || text.includes('Privacy') || text.includes('Sitemap')) {
        return;
      }
      
      // Look for nearby image
      let imgSrc = null;
      let currentElement = $el;
      
      // Check current element and parents for images
      for (let i = 0; i < 5; i++) {
        if (currentElement.length === 0) break;
        
        const img = currentElement.find('img').first();
        if (img.length > 0) {
          const src = img.attr('src');
          if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('banner')) {
            imgSrc = src;
            break;
          }
        }
        currentElement = currentElement.parent();
      }
      
      if (imgSrc) {
        products.push({
          name: text,
          imageUrl: imgSrc,
          price: null,
          fullText: text
        });
      }
    });
    
    // Method 3: Enhanced brand-specific pattern matching
    const brands = enhancedBrandPatterns[categoryName] || [];
    brands.forEach(brand => {
      $(`*:contains("${brand}")`).each((index, element) => {
        const $el = $(element);
        const text = $el.text().trim();
        
        if (text.length > 5 && text.length < 100 && text.includes(brand)) {
          let imgSrc = $el.find('img').first().attr('src');
          
          if (!imgSrc) {
            let parent = $el.parent();
            for (let i = 0; i < 4; i++) {
              imgSrc = parent.find('img').first().attr('src');
              if (imgSrc && !imgSrc.includes('logo') && !imgSrc.includes('icon')) break;
              parent = parent.parent();
            }
          }
          
          if (imgSrc && !imgSrc.includes('logo') && !imgSrc.includes('icon')) {
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
    
    // Method 4: Look for specific HTML patterns that might contain products
    $('.product, .item, .drink, [class*="product"], [class*="item"], [class*="drink"]').each((index, element) => {
      const $el = $(element);
      const text = $el.text().trim();
      const imgSrc = $el.find('img').first().attr('src');
      
      if (text && imgSrc && text.length > 3 && text.length < 100) {
        products.push({
          name: text,
          imageUrl: imgSrc,
          price: null,
          fullText: text
        });
      }
    });
    
    // Remove duplicates
    const uniqueProducts = products.filter((product, index, self) => 
      index === self.findIndex(p => p.name === product.name && p.imageUrl === product.imageUrl)
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
    
    // Enhanced matching algorithm
    for (const scrapedProduct of uniqueProducts) {
      try {
        // Find matching database product with improved matching
        const dbProduct = dbProducts.find(dbProd => {
          const dbName = dbProd.name.toLowerCase();
          const scrapedName = scrapedProduct.name.toLowerCase();
          
          // Exact match
          if (dbName === scrapedName) return true;
          
          // Remove common words and compare
          const removeCommonWords = (str) => {
            return str.replace(/\b(whisky|whiskey|vodka|gin|rum|tequila|cognac|beer|brandy|wine|champagne|liqueur|smokes|vapes|soft drinks|drinks|abv|years|old|reserve|premium|special|gold|silver|platinum|black|white|red|blue|green|yellow|orange|pink|purple|brown|clear|dark|light|strong|mild|smooth|sweet|dry|semi|sweet|semi-sweet|extra|super|ultra|mega|max|plus|pro|deluxe|luxury|classic|traditional|original|authentic|genuine|pure|natural|organic|premium|select|choice|fine|superior|excellent|outstanding|exceptional|remarkable|distinctive|unique|rare|limited|edition|collection|series|line|range|family|brand|label|bottle|can|pack|case|box|gift|set|twin|double|triple|single|blend|blended|malt|grain|barley|corn|rye|wheat|oak|cask|barrel|aged|matured|distilled|fermented|brewed|crafted|made|produced|manufactured|imported|exported|domestic|international|local|regional|national|global|worldwide|famous|popular|best|top|leading|premier|first|number|no|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion|ml|litre|liter|liters|litres|oz|ounce|ounces|pound|pounds|kg|kilogram|kilograms|gram|grams|mg|milligram|milligrams|percent|percentage|proof|alcohol|alcoholic|non|alcoholic|low|high|medium|small|large|big|tiny|huge|massive|mini|micro|macro|mega|giga|tera|peta|exa|zetta|yotta)\b/g, '').trim();
          };
          
          const cleanDbName = removeCommonWords(dbName);
          const cleanScrapedName = removeCommonWords(scrapedName);
          
          if (cleanDbName === cleanScrapedName) return true;
          
          // Word-based matching
          const dbWords = cleanDbName.split(/\s+/).filter(word => word.length > 2);
          const scrapedWords = cleanScrapedName.split(/\s+/).filter(word => word.length > 2);
          
          const matchingWords = dbWords.filter(word => 
            scrapedWords.some(sWord => 
              sWord.includes(word) || word.includes(sWord) || 
              sWord.startsWith(word) || word.startsWith(sWord)
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

async function scrapeAllCategoriesComprehensive() {
  console.log('Starting comprehensive image scraping for all categories...');
  
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
  
  console.log('\n=== Comprehensive Scraping Results ===');
  console.log(`Total scraped: ${totalScraped}`);
  console.log(`Total matched: ${totalMatched}`);
  console.log(`Total downloaded: ${totalDownloaded}`);
  
  console.log('\nPer category:');
  Object.entries(results).forEach(([category, result]) => {
    console.log(`${category}: ${result.downloaded} images downloaded`);
  });
}

// Run the comprehensive scraper
scrapeAllCategoriesComprehensive().then(() => {
  console.log('Comprehensive scraping completed');
  process.exit(0);
}).catch(error => {
  console.error('Comprehensive scraping failed:', error);
  process.exit(1);
});

