const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Get country of origin for a product based on name and category
 */
function getProductCountry(productName, category) {
  const countryMap = {
    // Irish Whiskey
    'jameson': 'Ireland',
    'tullamore': 'Ireland',
    'bushmills': 'Ireland',
    'redbreast': 'Ireland',
    
    // Scotch Whisky
    'johnnie walker': 'Scotland',
    'glenfiddich': 'Scotland',
    'macallan': 'Scotland',
    'glenlivet': 'Scotland',
    'chivas': 'Scotland',
    'ballantine': 'Scotland',
    'james buchanan': 'Scotland',
    'famous grouse': 'Scotland',
    'monkey shoulder': 'Scotland',
    
    // American Whiskey
    'jack daniels': 'United States',
    'jim beam': 'United States',
    'makers mark': 'United States',
    'wild turkey': 'United States',
    'woodford reserve': 'United States',
    
    // French Cognac/Brandy
    'hennessy': 'France',
    'martell': 'France',
    'remy martin': 'France',
    'courvoisier': 'France',
    
    // Mexican Tequila
    'jose cuervo': 'Mexico',
    'don julio': 'Mexico',
    'patron': 'Mexico',
    'herradura': 'Mexico',
    
    // English Gin
    'tanqueray': 'England',
    'bombay sapphire': 'England',
    'beefeater': 'England',
    'gordons': 'England',
    
    // Russian/Polish Vodka
    'smirnoff': 'Russia',
    'absolut': 'Sweden',
    'grey goose': 'France',
    'belvedere': 'Poland',
    
    // Wine regions
    'champagne': 'France',
    'prosecco': 'Italy',
    'chardonnay': 'France',
    'cabernet': 'France',
    'pinot noir': 'France',
    'sauvignon blanc': 'France',
  };
  
  const lowerName = productName.toLowerCase();
  for (const [key, country] of Object.entries(countryMap)) {
    if (lowerName.includes(key)) {
      return country;
    }
  }
  
  // Default based on category
  const categoryDefaults = {
    'whisky': 'Scotland',
    'whiskey': 'Ireland',
    'cognac': 'France',
    'brandy': 'France',
    'tequila': 'Mexico',
    'gin': 'England',
    'vodka': 'Russia',
    'wine': 'France',
    'champagne': 'France',
  };
  
  if (category) {
    const lowerCategory = category.toLowerCase();
    for (const [key, country] of Object.entries(categoryDefaults)) {
      if (lowerCategory.includes(key)) {
        return country;
      }
    }
  }
  
  return 'Unknown';
}

/**
 * Get product type description
 */
function getProductType(productName, category) {
  const lowerName = productName.toLowerCase();
  const lowerCategory = category ? category.toLowerCase() : '';
  
  // Handle vapes and smokes first
  if (lowerCategory.includes('vape') || lowerName.includes('vape')) {
    return 'vaping product';
  }
  if (lowerCategory.includes('smoke') || lowerCategory.includes('cigarette') || lowerCategory.includes('cigar')) {
    if (lowerName.includes('cigar') || lowerCategory.includes('cigar')) return 'cigar';
    if (lowerName.includes('cigarette') || lowerCategory.includes('cigarette')) return 'cigarette';
    return 'tobacco product';
  }
  if (lowerCategory.includes('nicotine') || lowerCategory.includes('pouch') || lowerName.includes('nicotine') || lowerName.includes('pouch')) {
    return 'nicotine product';
  }
  
  if (lowerCategory.includes('whisky') || lowerCategory.includes('whiskey')) {
    if (lowerName.includes('irish')) return 'Irish whiskey';
    if (lowerName.includes('scotch') || lowerName.includes('scotland')) return 'Scotch whisky';
    if (lowerName.includes('bourbon')) return 'bourbon whiskey';
    if (lowerName.includes('rye')) return 'rye whiskey';
    return 'whiskey';
  }
  
  if (lowerCategory.includes('cognac')) return 'cognac';
  if (lowerCategory.includes('brandy')) return 'brandy';
  if (lowerCategory.includes('tequila')) return 'tequila';
  if (lowerCategory.includes('gin')) return 'gin';
  if (lowerCategory.includes('vodka')) return 'vodka';
  if (lowerCategory.includes('rum')) return 'rum';
  if (lowerCategory.includes('wine')) return 'wine';
  if (lowerCategory.includes('champagne')) return 'champagne';
  if (lowerCategory.includes('prosecco')) return 'prosecco';
  if (lowerCategory.includes('beer')) return 'beer';
  if (lowerCategory.includes('liqueur')) return 'liqueur';
  if (lowerCategory.includes('soft drink')) return 'soft drink';
  
  return 'spirit';
}

/**
 * Get distillery/company that produces the product
 */
function getDistillery(productName, productType, country) {
  const distilleries = {
    'jameson': 'produced by Irish Distillers at the Midleton Distillery',
    'hennessy': 'produced by Jas Hennessy & Co',
    'martell': 'produced by Martell & Co',
    'remy martin': 'produced by Rémy Martin',
    'courvoisier': 'produced by Courvoisier',
    'jack daniels': 'produced by the Jack Daniel Distillery',
    'jim beam': 'produced by Beam Suntory',
    'makers mark': 'produced by Maker\'s Mark Distillery',
    'wild turkey': 'produced by the Wild Turkey Distillery',
    'woodford reserve': 'produced by Brown-Forman',
    'johnnie walker': 'produced by Diageo',
    'glenfiddich': 'produced by William Grant & Sons',
    'macallan': 'produced by The Macallan Distillery',
    'glenlivet': 'produced by The Glenlivet Distillery',
    'chivas': 'produced by Chivas Brothers',
    'ballantine': 'produced by Pernod Ricard',
    'famous grouse': 'produced by The Edrington Group',
    'monkey shoulder': 'produced by William Grant & Sons',
    'absolut': 'produced by The Absolut Company',
    'tanqueray': 'produced by Diageo',
    'bombay sapphire': 'produced by Bacardi',
    'beefeater': 'produced by James Burrough Ltd',
    'gordons': 'produced by Diageo',
    'smirnoff': 'produced by Diageo',
    'grey goose': 'produced by Bacardi',
    'belvedere': 'produced by Belvedere Vodka',
    'jose cuervo': 'produced by Tequila Cuervo La Rojeña',
    'don julio': 'produced by Don Julio González',
    'patron': 'produced by Patrón Spirits Company',
    'herradura': 'produced by Casa Herradura',
    'bacardi': 'produced by Bacardi Limited',
    'captain morgan': 'produced by Diageo',
    'tullamore': 'produced by Tullamore DEW',
    'bushmills': 'produced by Old Bushmills Distillery',
    'redbreast': 'produced by Irish Distillers',
  };
  
  const lowerName = productName.toLowerCase();
  for (const [key, distillery] of Object.entries(distilleries)) {
    if (lowerName.includes(key)) {
      return distillery;
    }
  }
  
  // Generic distillery based on product type and country
  const genericDistilleries = {
    'whiskey': {
      'Ireland': 'produced by traditional Irish distilleries',
      'Scotland': 'produced by renowned Scottish distilleries',
      'United States': 'produced by American whiskey distilleries',
    },
    'whisky': {
      'Scotland': 'produced by renowned Scottish distilleries',
      'Japan': 'produced by Japanese whisky distilleries',
    },
    'cognac': {
      'France': 'produced by cognac houses in France',
    },
    'brandy': {
      'France': 'produced by French brandy producers',
    },
    'tequila': {
      'Mexico': 'produced by Mexican tequila distilleries',
    },
    'gin': {
      'England': 'produced by English gin distilleries',
    },
    'vodka': {
      'Russia': 'produced by Russian vodka distilleries',
      'Sweden': 'produced by Swedish vodka distilleries',
      'Poland': 'produced by Polish vodka distilleries',
    },
    'rum': {
      'Caribbean': 'produced by Caribbean rum distilleries',
    },
    'wine': {
      'France': 'produced by French wineries',
      'Italy': 'produced by Italian wineries',
      'Spain': 'produced by Spanish wineries',
    },
    'champagne': {
      'France': 'produced by Champagne houses',
    },
  };
  
  const lowerType = productType.toLowerCase();
  if (genericDistilleries[lowerType] && genericDistilleries[lowerType][country]) {
    return genericDistilleries[lowerType][country];
  }
  
  // Final fallback
  return `produced by ${country} distilleries`;
}

/**
 * Get unique or popular fact about the distillery/company
 */
function getDistilleryFact(productName, productType, country) {
  const distilleryFacts = {
    'jameson': 'Irish Distillers is one of the world\'s leading producers of Irish whiskey, known for their commitment to traditional triple-distillation methods.',
    'hennessy': 'Jas Hennessy & Co is the world\'s largest cognac producer, with a legacy spanning over 250 years and a reputation for exceptional quality.',
    'martell': 'Martell is one of the oldest cognac houses, renowned for its innovative approach to cognac making and its prestigious collection of aged spirits.',
    'remy martin': 'Rémy Martin is celebrated for exclusively using grapes from the Cognac region\'s two best crus, Grande and Petite Champagne.',
    'courvoisier': 'Courvoisier earned the nickname "The Brandy of Napoleon" after being favored by the French emperor, cementing its royal heritage.',
    'jack daniels': 'The Jack Daniel Distillery is the oldest registered distillery in the United States and is famous for its charcoal mellowing process.',
    'jim beam': 'Beam Suntory is one of the world\'s largest spirits companies, with Jim Beam being the best-selling bourbon globally.',
    'makers mark': 'Maker\'s Mark is known for its distinctive red wax seal and handcrafted approach, with each bottle still hand-dipped in wax.',
    'wild turkey': 'The Wild Turkey Distillery is famous for producing high-proof bourbons and its legendary Master Distiller Jimmy Russell.',
    'woodford reserve': 'Brown-Forman\'s Woodford Reserve is the official bourbon of the Kentucky Derby and is known for its triple-distilled process.',
    'johnnie walker': 'Diageo\'s Johnnie Walker is the world\'s best-selling Scotch whisky, with its iconic striding man logo recognized globally.',
    'glenfiddich': 'William Grant & Sons\' Glenfiddich was the first single malt Scotch whisky to be marketed globally and remains family-owned after five generations.',
    'macallan': 'The Macallan Distillery is renowned for its exceptional sherry cask maturation process and is considered one of the world\'s most prestigious single malts.',
    'glenlivet': 'The Glenlivet Distillery is credited with being the first licensed distillery in Scotland and is known for its smooth, fruity single malt.',
    'chivas': 'Chivas Brothers is famous for creating the world\'s first luxury blended Scotch whisky and for its commitment to blending excellence.',
    'ballantine': 'Pernod Ricard\'s Ballantine\'s is one of the world\'s best-selling Scotch whiskies, known for its smooth and balanced character.',
    'famous grouse': 'The Edrington Group\'s Famous Grouse is Scotland\'s best-selling whisky, known for its approachable and versatile flavor profile.',
    'monkey shoulder': 'William Grant & Sons\' Monkey Shoulder is a modern blended malt that has become popular for its smooth, mixable character.',
    'absolut': 'The Absolut Company revolutionized vodka marketing with its iconic bottle design and is known for its commitment to using Swedish winter wheat.',
    'tanqueray': 'Diageo\'s Tanqueray is one of the world\'s most awarded gins, known for its distinctive four-botanical recipe and crisp, clean taste.',
    'bombay sapphire': 'Bacardi\'s Bombay Sapphire is famous for its vapor-infusion process and its ten exotic botanicals sourced from around the world.',
    'beefeater': 'James Burrough Ltd\'s Beefeater is the world\'s most awarded gin and is still produced in the heart of London using a 200-year-old recipe.',
    'gordons': 'Diageo\'s Gordon\'s is the world\'s best-selling gin, known for its consistent quality and classic London dry gin character.',
    'smirnoff': 'Diageo\'s Smirnoff is the world\'s best-selling vodka brand, known for its smooth taste and innovative flavored varieties.',
    'grey goose': 'Bacardi\'s Grey Goose is renowned for being made from French winter wheat and natural spring water, creating an exceptionally smooth vodka.',
    'belvedere': 'Belvedere Vodka is Poland\'s premium vodka, made from Dankowskie Gold Rye and distilled four times for exceptional purity.',
    'jose cuervo': 'Tequila Cuervo La Rojeña is the world\'s oldest tequila producer, with over 250 years of history and expertise in tequila making.',
    'don julio': 'Don Julio González founded his distillery with a vision to create a premium tequila, and it has become one of Mexico\'s most respected brands.',
    'patron': 'Patrón Spirits Company revolutionized the tequila industry by introducing ultra-premium tequila to the global market, handcrafting each bottle.',
    'herradura': 'Casa Herradura is one of Mexico\'s oldest tequila producers, known for its traditional production methods and award-winning tequilas.',
    'bacardi': 'Bacardi Limited is the world\'s largest privately held spirits company, famous for its rum and innovative marketing campaigns.',
    'captain morgan': 'Diageo\'s Captain Morgan is the world\'s second-best-selling rum brand, known for its spiced rum and adventurous brand personality.',
    'tullamore': 'Tullamore DEW is Ireland\'s second-best-selling Irish whiskey, known for its unique blend of pot still, malt, and grain whiskies.',
    'bushmills': 'Old Bushmills Distillery is the world\'s oldest licensed whiskey distillery, with a license dating back to 1608.',
    'redbreast': 'Irish Distillers\' Redbreast is considered one of the finest Irish whiskeys, known for its rich, full-bodied pot still character.',
  };
  
  const lowerName = productName.toLowerCase();
  for (const [key, fact] of Object.entries(distilleryFacts)) {
    if (lowerName.includes(key)) {
      return fact;
    }
  }
  
  // Generic facts based on product type and country
  const genericFacts = {
    'whiskey': {
      'Ireland': 'Irish whiskey distilleries are renowned for their traditional triple-distillation process, which creates a smoother, lighter spirit.',
      'Scotland': 'Scottish distilleries are world-famous for their expertise in whisky making, with each region contributing unique characteristics.',
      'United States': 'American whiskey distilleries are celebrated for their innovation and adherence to traditional methods like the Lincoln County Process.',
    },
    'whisky': {
      'Scotland': 'Scottish distilleries are world-famous for their expertise in whisky making, with each region contributing unique characteristics.',
      'Japan': 'Japanese whisky distilleries have gained international acclaim for their meticulous attention to detail and innovative blending techniques.',
    },
    'cognac': {
      'France': 'Cognac houses in France are renowned for their strict adherence to traditional methods and their expertise in aging and blending.',
    },
    'brandy': {
      'France': 'French brandy producers are celebrated for their centuries-old traditions and their ability to create complex, aged spirits.',
    },
    'tequila': {
      'Mexico': 'Mexican tequila distilleries are famous for their use of blue agave and traditional production methods that have been passed down for generations.',
    },
    'gin': {
      'England': 'English gin distilleries are known for their botanical expertise and their role in creating the classic London dry gin style.',
    },
    'vodka': {
      'Russia': 'Russian vodka distilleries are renowned for their traditional production methods and their focus on purity and smoothness.',
      'Sweden': 'Swedish vodka distilleries are celebrated for their use of high-quality local ingredients and their commitment to sustainable production.',
      'Poland': 'Polish vodka distilleries are famous for their traditional rye-based vodkas and their centuries-old distillation techniques.',
    },
    'rum': {
      'Caribbean': 'Caribbean rum distilleries are world-renowned for their expertise in producing rich, flavorful rums using traditional methods.',
    },
    'wine': {
      'France': 'French wineries are celebrated worldwide for their terroir-driven approach and their expertise in producing some of the world\'s finest wines.',
      'Italy': 'Italian wineries are famous for their diverse grape varieties and their long-standing winemaking traditions.',
      'Spain': 'Spanish wineries are renowned for their innovative techniques and their production of both traditional and modern wine styles.',
    },
    'champagne': {
      'France': 'Champagne houses are world-famous for their expertise in the méthode champenoise and their ability to create consistently excellent sparkling wines.',
    },
  };
  
  const lowerType = productType.toLowerCase();
  if (genericFacts[lowerType] && genericFacts[lowerType][country]) {
    return genericFacts[lowerType][country];
  }
  
  // Final fallback
  return `The distillery is known for its commitment to quality and traditional production methods.`;
}

/**
 * Get production history information
 */
function getProductionHistory(productName, productType, country) {
  const histories = {
    'jameson': {
      text: 'Established in 1780, Jameson has been crafting Irish whiskey for over two centuries using traditional triple-distillation methods.',
      year: 1780
    },
    'hennessy': {
      text: 'Founded in 1765, Hennessy has been producing cognac for over 250 years, making it one of the oldest cognac houses in the world.',
      year: 1765
    },
    'martell': {
      text: 'Established in 1715, Martell is one of the oldest cognac houses, with a rich heritage spanning over 300 years.',
      year: 1715
    },
    'jack daniels': {
      text: 'Founded in 1866, Jack Daniel\'s has been producing Tennessee whiskey using the Lincoln County Process for over 150 years.',
      year: 1866
    },
    'johnnie walker': {
      text: 'Created in 1820, Johnnie Walker has been blending Scotch whisky for over 200 years, becoming one of the world\'s most recognized whisky brands.',
      year: 1820
    },
    'glenfiddich': {
      text: 'Established in 1887, Glenfiddich was one of the first distilleries to market single malt whisky globally, pioneering the category.',
      year: 1887
    },
    'absolut': {
      text: 'Launched in 1879, Absolut Vodka has been produced using the same recipe for over 140 years, using winter wheat and water from a deep well in Åhus.',
      year: 1879
    },
    'tanqueray': {
      text: 'Founded in 1830, Tanqueray has been distilling gin in London for nearly 200 years, using a unique four-botanical recipe.',
      year: 1830
    },
  };
  
  const lowerName = productName.toLowerCase();
  for (const [key, history] of Object.entries(histories)) {
    if (lowerName.includes(key)) {
      return history.text;
    }
  }
  
  // Generic history based on product type and country
  const genericHistories = {
    'whiskey': {
      'Ireland': 'Irish whiskey has a long tradition dating back centuries, with many distilleries preserving time-honored distillation methods.',
      'Scotland': 'Scotch whisky has been produced in Scotland for hundreds of years, with each region developing its own distinctive style.',
      'United States': 'American whiskey has a rich history dating back to the colonial era, with each state developing unique production methods.',
    },
    'cognac': {
      'France': 'Cognac production in France dates back to the 16th century, with the region developing strict regulations to ensure quality and authenticity.',
    },
    'tequila': {
      'Mexico': 'Tequila has been produced in Mexico for over 400 years, with the blue agave plant being central to its traditional production methods.',
    },
    'gin': {
      'England': 'Gin has been produced in England since the 17th century, with London becoming a center for gin distillation and innovation.',
    },
    'vodka': {
      'Russia': 'Vodka has been produced in Russia and Eastern Europe for centuries, with traditional methods emphasizing purity and smoothness.',
      'Sweden': 'Swedish vodka production emphasizes purity and quality, with many brands using local ingredients and traditional distillation methods.',
    },
  };
  
  const lowerType = productType.toLowerCase();
  if (genericHistories[lowerType] && genericHistories[lowerType][country]) {
    return genericHistories[lowerType][country];
  }
  
  // Fallback generic history
  const productTerm = lowerType.includes('wine') ? 'wine' : lowerType.includes('champagne') ? 'champagne' : 'spirit';
  return `This ${productType} has been crafted using traditional methods, reflecting the rich heritage of ${country} ${productTerm} production.`;
}

/**
 * Search web for product information
 */
async function searchProductInfo(productName) {
  try {
    let productInfo = {
      country: null,
      characteristics: [],
      productionLocation: null,
      history: null,
    };
    
    // Try Wikipedia first
    try {
      const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(productName.replace(/\s+/g, '_'))}`;
      const response = await axios.get(wikiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      
      // Extract country from infobox
      const countryText = $('.infobox th:contains("Country")').next('td').text() ||
                         $('.infobox th:contains("Origin")').next('td').text() ||
                         $('.infobox th:contains("Region")').next('td').text();
      
      if (countryText) {
        productInfo.country = countryText.trim().split(',')[0].trim();
      }
      
      // Extract production location
      const locationText = $('.infobox th:contains("Location")').next('td').text() ||
                          $('.infobox th:contains("City")').next('td').text() ||
                          $('.infobox th:contains("Region")').next('td').text();
      
      if (locationText) {
        productInfo.productionLocation = locationText.trim();
      }
      
      // Extract history from article text
      const articleText = $('body').text();
      
      // Look for founding/establishment dates
      const foundingMatch = articleText.match(/(?:founded|established|created|founded in|established in|created in)\s+(\d{4})/i);
      if (foundingMatch) {
        const year = parseInt(foundingMatch[1]);
        const yearsAgo = new Date().getFullYear() - year;
        productInfo.history = `Established in ${year}, this brand has been producing quality spirits for over ${yearsAgo} years.`;
      }
      
      // Extract characteristics from first paragraph
      const firstPara = $('p').first().text();
      if (firstPara) {
        // Look for descriptive phrases
        const characteristics = firstPara.match(/(?:known for|noted for|famous for|characterized by|features?)\s+([^.]{10,100})/gi);
        if (characteristics) {
          productInfo.characteristics = characteristics.slice(0, 2);
        }
      }
    } catch (wikiError) {
      console.log(`Wikipedia search failed for ${productName}, using fallback information`);
    }
    
    return productInfo;
  } catch (error) {
    console.error(`Error searching for product info: ${error.message}`);
    return null;
  }
}

/**
 * Generate a rewritten product description
 */
async function generateProductDescription(productName, category = null, subCategory = null) {
  try {
    console.log(`[Description Generator] Generating description for: ${productName}`);
    
    // Check if this is a vape or smoke product
    const categoryName = (category || subCategory || '').toLowerCase();
    const isVapeOrSmoke = categoryName.includes('vape') || categoryName.includes('smoke') || 
                         categoryName.includes('cigarette') || categoryName.includes('cigar') ||
                         categoryName.includes('nicotine') || categoryName.includes('pouch');
    
    // Get basic info
    const country = getProductCountry(productName, category || subCategory);
    const productType = getProductType(productName, category || subCategory);
    
    // Search for additional info
    const productInfo = await searchProductInfo(productName);
    
    // Build description in the specified format
    // Use "an" for vowels, "a" for consonants
    const article = /^[aeiou]/i.test(productType) ? 'an' : 'a';
    let description = `${productName} is ${article} ${productType}`;
    
    // Only add country for alcoholic beverages, not for vapes and smokes
    if (!isVapeOrSmoke && country && country !== 'Unknown') {
      description += ` from ${country}`;
    }
    
    // Add characteristics - use varied descriptions
    const characteristics = [];
    
    // Common characteristics based on product type (varied options)
    const typeCharacteristics = {
      'whiskey': [
        ['smooth flavor', 'rich complexity'],
        ['distinctive character', 'balanced taste'],
        ['warm notes', 'sophisticated profile'],
        ['complex flavor', 'smooth finish']
      ],
      'whisky': [
        ['smooth flavor', 'rich complexity'],
        ['distinctive character', 'balanced taste'],
        ['warm notes', 'sophisticated profile'],
        ['complex flavor', 'smooth finish']
      ],
      'cognac': [
        ['elegant taste', 'refined character'],
        ['sophisticated profile', 'smooth finish'],
        ['rich complexity', 'distinctive notes'],
        ['premium quality', 'elegant character']
      ],
      'brandy': [
        ['warm notes', 'rich flavor'],
        ['smooth finish', 'distinctive character'],
        ['complex taste', 'elegant profile'],
        ['refined character', 'sophisticated notes']
      ],
      'tequila': [
        ['bold flavor', 'distinctive taste'],
        ['vibrant character', 'smooth finish'],
        ['authentic taste', 'bold notes'],
        ['distinctive profile', 'smooth character']
      ],
      'gin': [
        ['crisp taste', 'botanical notes'],
        ['refreshing character', 'distinctive flavor'],
        ['complex botanicals', 'smooth finish'],
        ['elegant taste', 'refreshing profile']
      ],
      'vodka': [
        ['clean taste', 'smooth finish'],
        ['versatile character', 'crisp flavor'],
        ['neutral profile', 'smooth taste'],
        ['clean finish', 'versatile nature']
      ],
      'rum': [
        ['sweet notes', 'rich flavor'],
        ['tropical character', 'smooth finish'],
        ['complex taste', 'distinctive notes'],
        ['rich profile', 'sweet character']
      ],
      'wine': [
        ['balanced flavor', 'elegant taste'],
        ['refined character', 'sophisticated profile'],
        ['complex notes', 'smooth finish'],
        ['elegant character', 'balanced profile']
      ],
      'champagne': [
        ['elegant bubbles', 'refined taste'],
        ['sophisticated character', 'crisp finish'],
        ['delicate bubbles', 'elegant profile'],
        ['refined character', 'sophisticated notes']
      ],
    };
    
    const lowerType = productType.toLowerCase();
    let selectedTraits = null;
    
    for (const [key, traitOptions] of Object.entries(typeCharacteristics)) {
      if (lowerType.includes(key)) {
        // Randomly select one set of traits for variety
        const randomIndex = Math.floor(Math.random() * traitOptions.length);
        selectedTraits = traitOptions[randomIndex];
        break;
      }
    }
    
    if (selectedTraits) {
      characteristics.push(...selectedTraits);
    } else {
      characteristics.push('distinctive character', 'quality craftsmanship');
    }
    
    // Add known characteristics from search if available
    if (productInfo && productInfo.characteristics.length > 0) {
      // Use first characteristic from search, combine with one from type
      characteristics[0] = productInfo.characteristics[0].replace(/known for|noted for|famous for|characterized by|features?/gi, '').trim();
    }
    
    // Build the "known for" section (skip generic characteristics for vapes and smokes)
    if (isVapeOrSmoke) {
      // For vapes and smokes, use product-specific characteristics
      if (productType.includes('vaping')) {
        description += `, offering a modern and convenient alternative to traditional smoking`;
      } else if (productType.includes('cigar')) {
        description += `, known for its rich flavor and premium quality`;
      } else if (productType.includes('cigarette')) {
        description += `, made with quality tobacco`;
      } else if (productType.includes('nicotine')) {
        description += `, providing a smoke-free nicotine experience for adult consumers`;
      } else {
        description += `, made with quality ingredients`;
      }
    } else {
      // For alcoholic beverages, use the standard characteristics
      if (characteristics.length >= 2) {
        description += `, known for its ${characteristics[0]} and ${characteristics[1]}`;
      } else if (characteristics.length === 1) {
        description += `, known for its ${characteristics[0]}`;
      } else {
        description += `, known for its distinctive character`;
      }
    }
    
    // Add distillery/company information only if:
    // 1. It's not a vape or smoke product
    // 2. We have a specific known producer (not a generic fallback)
    if (!isVapeOrSmoke) {
      const distillery = getDistillery(productName, productType, country);
      
      // Check if this is a specific known producer (not a generic fallback)
      const lowerName = productName.toLowerCase();
      const knownProducers = [
        'jameson', 'hennessy', 'martell', 'remy martin', 'courvoisier',
        'jack daniels', 'jim beam', 'makers mark', 'wild turkey', 'woodford reserve',
        'johnnie walker', 'glenfiddich', 'macallan', 'glenlivet', 'chivas',
        'ballantine', 'famous grouse', 'monkey shoulder', 'absolut', 'tanqueray',
        'bombay sapphire', 'beefeater', 'gordons', 'smirnoff', 'grey goose',
        'belvedere', 'jose cuervo', 'don julio', 'patron', 'herradura',
        'bacardi', 'captain morgan', 'tullamore', 'bushmills', 'redbreast'
      ];
      
      const isKnownProducer = knownProducers.some(producer => lowerName.includes(producer));
      
      // Only include producer info if we have a specific known producer
      if (isKnownProducer) {
        description += `. It is ${distillery}`;
        
        // Add unique/popular fact about the producer
        const distilleryFact = getDistilleryFact(productName, productType, country);
        description += `. ${distilleryFact}`;
      }
      
      // Add production history (only for alcoholic beverages with known producers)
      if (isKnownProducer) {
        const history = getProductionHistory(productName, productType, country);
        description += `. ${history}`;
      }
    } else {
      // For vapes and smokes, skip producer/distillery information entirely
      // The characteristics already cover the product description
    }
    
    // Add best enjoyed section (skip for vapes and smokes)
    if (!isVapeOrSmoke) {
      const servingSuggestions = {
        'whiskey': 'best enjoyed neat, on the rocks, or in classic cocktails',
        'whisky': 'best enjoyed neat, on the rocks, or in classic cocktails',
        'cognac': 'best enjoyed neat or with a splash of water',
        'brandy': 'best enjoyed neat or warmed',
        'tequila': 'best enjoyed as a shot with lime and salt, or in margaritas',
        'gin': 'best enjoyed in cocktails like gin and tonic or martinis',
        'vodka': 'best enjoyed in cocktails or as a shot',
        'rum': 'best enjoyed in cocktails or on the rocks',
        'wine': 'best enjoyed at room temperature or slightly chilled',
        'champagne': 'best enjoyed chilled as an aperitif or with celebrations',
        'beer': 'best enjoyed chilled',
        'liqueur': 'best enjoyed neat, on the rocks, or in cocktails',
      };
      
      const serving = servingSuggestions[lowerType] || 'best enjoyed according to personal preference';
      description += ` ${serving.charAt(0).toUpperCase() + serving.slice(1)}`;
    }
    
    // Clean up any double periods or spacing issues
    description = description.replace(/\.{2,}/g, '.');
    description = description.replace(/\s+\./g, '.');
    description = description.replace(/\.\s+\./g, '. ');
    description = description.replace(/\s+/g, ' '); // Normalize spaces
    
    // Ensure it ends with a period
    if (!description.endsWith('.')) {
      description += '.';
    }
    
    // Fix missing periods before "Best enjoyed"
    description = description.replace(/([^.])\s+Best enjoyed/gi, '$1. Best enjoyed');
    
    console.log(`[Description Generator] Generated description (${description.length} chars) for: ${productName}`);
    return description;
    
  } catch (error) {
    console.error(`[Description Generator] Error generating description for ${productName}:`, error.message);
    // Return a basic description if generation fails
    const country = getProductCountry(productName, category || subCategory);
    const productType = getProductType(productName, category || subCategory);
    
    const article = /^[aeiou]/i.test(productType) ? 'an' : 'a';
    let fallback = `${productName} is ${article} ${productType}`;
    if (country && country !== 'Unknown') {
      fallback += ` from ${country}`;
    }
    fallback += `, known for its distinctive character and quality. Best enjoyed according to personal preference.`;
    
    return fallback;
  }
}

module.exports = {
  generateProductDescription,
  getProductCountry,
  getProductType
};

