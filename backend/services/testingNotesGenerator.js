const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Generate testing/tasting notes for a product
 * This function attempts to fetch tasting notes from the internet
 */
async function generateTestingNotes(productName, category = null, subCategory = null) {
  try {
    console.log(`[Testing Notes Generator] Generating notes for: ${productName}`);
    
    // Get product type
    const productType = getProductType(productName, category || subCategory);
    const categoryName = (category || subCategory || '').toLowerCase();
    
    // Check if this is a vape or smoke product (skip tasting notes for these)
    const isVapeOrSmoke = categoryName.includes('vape') || categoryName.includes('smoke') || 
                         categoryName.includes('cigarette') || categoryName.includes('cigar') ||
                         categoryName.includes('nicotine') || categoryName.includes('pouch');
    
    if (isVapeOrSmoke) {
      return 'Tasting notes are not applicable for this product category.';
    }
    
    // Try to search for tasting notes online
    let tastingNotes = null;
    
    // First, try to get from hardcoded database (common products)
    tastingNotes = getHardcodedTastingNotes(productName, productType);
    
    if (!tastingNotes) {
      // Try to fetch from web
      tastingNotes = await searchTastingNotesOnline(productName, productType);
    }
    
    // Fallback to generic notes if nothing found
    if (!tastingNotes) {
      tastingNotes = getGenericTastingNotes(productType);
    }
    
    console.log(`[Testing Notes Generator] Generated notes (${tastingNotes.length} chars) for: ${productName}`);
    return tastingNotes;
    
  } catch (error) {
    console.error(`[Testing Notes Generator] Error generating notes for ${productName}:`, error.message);
    // Return generic notes on error
    const productType = getProductType(productName, category || subCategory);
    return getGenericTastingNotes(productType);
  }
}

/**
 * Get product type
 */
function getProductType(productName, category) {
  const lowerName = productName.toLowerCase();
  const lowerCategory = category ? category.toLowerCase() : '';
  
  if (lowerCategory.includes('whisky') || lowerCategory.includes('whiskey')) {
    return 'whisky';
  }
  if (lowerCategory.includes('cognac')) return 'cognac';
  if (lowerCategory.includes('brandy')) return 'brandy';
  if (lowerCategory.includes('tequila')) return 'tequila';
  if (lowerCategory.includes('gin')) return 'gin';
  if (lowerCategory.includes('vodka')) return 'vodka';
  if (lowerCategory.includes('rum')) return 'rum';
  if (lowerCategory.includes('wine')) return 'wine';
  if (lowerCategory.includes('champagne')) return 'champagne';
  if (lowerCategory.includes('beer')) return 'beer';
  if (lowerCategory.includes('liqueur')) return 'liqueur';
  
  return 'spirit';
}

/**
 * Hardcoded tasting notes for popular products
 */
function getHardcodedTastingNotes(productName, productType) {
  const lowerName = productName.toLowerCase();
  
  const tastingNotesDB = {
    // Whisky
    'glenfiddich': 'Nose: Rich oak, vanilla, honey. Palate: Smooth, fruity with notes of apple, pear, and spice. Finish: Long, warm, and satisfying.',
    'johnnie walker': 'Nose: Vanilla, honey, and fruit. Palate: Smooth and balanced with notes of caramel and spice. Finish: Warm and lingering.',
    'jameson': 'Nose: Light floral notes with hints of wood and spice. Palate: Smooth and sweet with notes of vanilla and fruit. Finish: Clean and crisp.',
    'jack daniels': 'Nose: Charcoal, caramel, and vanilla. Palate: Smooth and sweet with notes of caramel, vanilla, and oak. Finish: Long and mellow.',
    'chivas': 'Nose: Rich fruit and honey. Palate: Smooth and creamy with notes of vanilla, apple, and oak. Finish: Long and satisfying.',
    'monkey shoulder': 'Nose: Malty, vanilla, and honey. Palate: Smooth and fruity with notes of spice and oak. Finish: Medium, warm, and balanced.',
    
    // Cognac
    'hennessy': 'Nose: Rich fruit, vanilla, and oak. Palate: Smooth and complex with notes of dried fruit, spice, and oak. Finish: Long and warming.',
    'martell': 'Nose: Fruity with hints of oak and vanilla. Palate: Smooth and elegant with notes of apricot, honey, and spice. Finish: Long and refined.',
    'remy martin': 'Nose: Floral and fruity with hints of vanilla. Palate: Smooth and rich with notes of dried fruit, spice, and oak. Finish: Long and elegant.',
    
    // Vodka
    'absolut': 'Nose: Clean and neutral with subtle grain notes. Palate: Smooth and crisp with a clean, neutral taste. Finish: Clean and refreshing.',
    'smirnoff': 'Nose: Neutral and clean. Palate: Smooth and crisp with a clean, neutral character. Finish: Clean and refreshing.',
    'grey goose': 'Nose: Subtle grain and mineral notes. Palate: Exceptionally smooth and clean with a silky texture. Finish: Clean and crisp.',
    
    // Gin
    'tanqueray': 'Nose: Juniper, citrus, and botanical notes. Palate: Crisp and dry with notes of juniper, citrus, and spice. Finish: Clean and refreshing.',
    'gordons': 'Nose: Juniper and citrus. Palate: Classic London dry gin with notes of juniper, citrus, and botanicals. Finish: Clean and dry.',
    'bombay sapphire': 'Nose: Complex botanical blend. Palate: Smooth and balanced with notes of juniper, citrus, and exotic botanicals. Finish: Smooth and refreshing.',
    
    // Tequila
    'jose cuervo': 'Nose: Agave, citrus, and pepper. Palate: Smooth with notes of agave, citrus, and spice. Finish: Warm and peppery.',
    'don julio': 'Nose: Clean agave, citrus, and vanilla. Palate: Smooth and elegant with notes of agave, citrus, and oak. Finish: Smooth and clean.',
    'patron': 'Nose: Clean agave, citrus, and vanilla. Palate: Ultra-smooth with notes of agave, citrus, and oak. Finish: Smooth and long.',
    
    // Rum
    'bacardi': 'Nose: Light and sweet with hints of vanilla. Palate: Smooth and sweet with notes of vanilla, caramel, and oak. Finish: Smooth and clean.',
    'captain morgan': 'Nose: Spice, vanilla, and oak. Palate: Smooth and spiced with notes of vanilla, cinnamon, and oak. Finish: Warm and spiced.',
    
    // Wine
    'chardonnay': 'Nose: Fruity with hints of oak and vanilla. Palate: Smooth and buttery with notes of apple, pear, and oak. Finish: Smooth and elegant.',
    'cabernet': 'Nose: Dark fruit, oak, and spice. Palate: Full-bodied with notes of blackcurrant, cherry, and oak. Finish: Long and tannic.',
    'pinot noir': 'Nose: Red fruit and earthy notes. Palate: Light to medium-bodied with notes of cherry, strawberry, and earth. Finish: Smooth and elegant.',
  };
  
  for (const [key, notes] of Object.entries(tastingNotesDB)) {
    if (lowerName.includes(key)) {
      return notes;
    }
  }
  
  return null;
}

/**
 * Search for tasting notes online
 */
async function searchTastingNotesOnline(productName, productType) {
  try {
    // Try searching on Wikipedia or other sources
    const searchQuery = `${productName} tasting notes`;
    const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(productName.replace(/\s+/g, '_'))}`;
    
    try {
      const response = await axios.get(wikiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      
      // Look for tasting notes section
      let tastingNotes = null;
      
      // Try to find a section about taste, flavor, or characteristics
      $('h2, h3').each((i, elem) => {
        const heading = $(elem).text().toLowerCase();
        if (heading.includes('taste') || heading.includes('flavor') || heading.includes('palate') || 
            heading.includes('nose') || heading.includes('characteristics')) {
          const sectionText = $(elem).nextUntil('h2, h3').text();
          if (sectionText.length > 50) {
            tastingNotes = sectionText.substring(0, 300).trim();
          }
        }
      });
      
      if (tastingNotes) {
        // Clean up the text
        tastingNotes = tastingNotes.replace(/\s+/g, ' ').trim();
        if (tastingNotes.length > 200) {
          tastingNotes = tastingNotes.substring(0, 200) + '...';
        }
        return tastingNotes;
      }
    } catch (wikiError) {
      console.log(`Wikipedia search failed for ${productName}, using fallback`);
    }
    
    return null;
  } catch (error) {
    console.error(`Error searching for tasting notes: ${error.message}`);
    return null;
  }
}

/**
 * Get generic tasting notes based on product type
 */
function getGenericTastingNotes(productType) {
  const genericNotes = {
    'whisky': 'Nose: Rich and complex with notes of oak, vanilla, and spice. Palate: Smooth and balanced with layers of flavor. Finish: Long and warming.',
    'cognac': 'Nose: Fruity with hints of oak and vanilla. Palate: Smooth and elegant with notes of dried fruit and spice. Finish: Long and refined.',
    'brandy': 'Nose: Rich fruit and oak. Palate: Smooth and warming with notes of fruit and spice. Finish: Long and satisfying.',
    'tequila': 'Nose: Clean agave notes. Palate: Smooth with authentic agave character. Finish: Clean and refreshing.',
    'gin': 'Nose: Juniper and botanical notes. Palate: Crisp and balanced with botanical complexity. Finish: Clean and refreshing.',
    'vodka': 'Nose: Clean and neutral. Palate: Smooth and crisp with a clean character. Finish: Clean and refreshing.',
    'rum': 'Nose: Sweet and aromatic. Palate: Smooth with notes of vanilla and spice. Finish: Warm and satisfying.',
    'wine': 'Nose: Fruity and aromatic. Palate: Well-balanced with good structure. Finish: Smooth and elegant.',
    'champagne': 'Nose: Elegant bubbles with fruity notes. Palate: Crisp and refreshing with balanced acidity. Finish: Clean and effervescent.',
    'beer': 'Nose: Malty and hoppy notes. Palate: Well-balanced with good body. Finish: Clean and refreshing.',
    'liqueur': 'Nose: Sweet and aromatic. Palate: Smooth and flavorful. Finish: Sweet and lingering.',
    'spirit': 'Nose: Aromatic and inviting. Palate: Smooth with good character. Finish: Satisfying and clean.',
  };
  
  const lowerType = productType.toLowerCase();
  for (const [key, notes] of Object.entries(genericNotes)) {
    if (lowerType.includes(key)) {
      return notes;
    }
  }
  
  return genericNotes['spirit'];
}

module.exports = {
  generateTestingNotes
};


