const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Generate product URL from product name
 * Converts product name to URL-friendly format
 */
function generateProductUrl(productName) {
  if (!productName) return null;
  
  // Convert to lowercase and replace spaces/special chars with hyphens
  let url = productName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  
  // Handle special cases
  const specialCases = {
    'jameson': 'jamesons',
    'jack-daniels': 'jack-daniels-whiskey',
    'johnnie-walker': 'johnnie-walker-black-label',
    'absolut': 'absolut-vodka',
    'hennessy': 'hennessy-vs',
    'martell': 'martell-vs',
    'don-julio': 'don-julio-reposado',
    'patron': 'patron-silver-tequila',
    'jose-cuervo': 'jose-cuervo-gold',
    'tanqueray': 'tanqueray-gin',
    'gordon': 'gordons-gin',
    'glenfiddich': 'glenfiddich-15-years',
    'smirnoff': 'smirnoff-vodka',
  };
  
  // Check for special cases
  for (const [key, value] of Object.entries(specialCases)) {
    if (url.includes(key)) {
      return `https://www.dialadrinkkenya.com/${value}`;
    }
  }
  
  return `https://www.dialadrinkkenya.com/${url}`;
}

/**
 * Scrape product description from dialadrinkkenya.com
 */
async function scrapeProductDescription(productName, productUrl = null) {
  try {
    const url = productUrl || generateProductUrl(productName);
    
    if (!url) {
      console.log(`Could not generate URL for product: ${productName}`);
      return null;
    }
    
    console.log(`Scraping product description from: ${url}`);
    
    const response = await axios.get(url, {
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
    
    // Remove script and style tags
    $('script, style, nav, header, footer, .menu, .navigation').remove();
    
    // Try to find main content area
    const mainContentSelectors = [
      'main',
      'article',
      '.entry-content',
      '.content',
      '.product-description',
      '.product-details',
      '.woocommerce-product-details__short-description',
      '[class*="content"]',
      '[class*="description"]',
      'body'
    ];
    
    let allText = '';
    let mainContent = null;
    
    // Find the main content container
    for (const selector of mainContentSelectors) {
      const element = $(selector).first();
      if (element.length) {
        mainContent = element;
        break;
      }
    }
    
    if (!mainContent) {
      mainContent = $('body');
    }
    
    // Extract all text from paragraphs, headings, and list items
    const textElements = mainContent.find('p, h1, h2, h3, h4, h5, h6, li, div[class*="text"], div[class*="desc"], span');
    
    const collectedTexts = [];
    const seenTexts = new Set(); // Avoid duplicates
    
    textElements.each((i, elem) => {
      let text = $(elem).text().trim();
      
      // Skip if too short
      if (text.length < 25) return;
      
      // Skip promotional/CTA text
      if (/call\s+us|order\s+now|buy\s+now|click\s+here|shop\s+now|get\s+it\s+now|add\s+to\s+cart/i.test(text)) return;
      if (/dial\s*a\s*drink|dialadrinkkenya\.com|www\.dialadrinkkenya/i.test(text)) return;
      if (/fast\s*delivery|free\s*delivery|express\s*delivery|same\s*day|delivery\s+available/i.test(text)) return;
      if (/within\s*nairobi|across\s*nairobi|nairobi\s*and\s*environs|visit\s+our/i.test(text)) return;
      if (/quantity|share|youtube|reviews|product\s+details|category|sub\s+category/i.test(text) && text.length < 100) return;
      
      // Remove prices and phone numbers from text
      text = text.replace(/KES\s*\d+[.,]?\d*/gi, '');
      text = text.replace(/ksh\s*\d+[.,]?\d*/gi, '');
      text = text.replace(/\d{9,}/g, '');
      text = text.replace(/costs?\s*(ksh|KES)?\s*\d+[.,]?\d*/gi, '');
      text = text.trim();
      
      // Skip if too short after cleaning
      if (text.length < 25) return;
      
      // Skip if it's mostly navigation
      if (/home|contact|about|menu|cart|login|sign\s+up/i.test(text) && text.length < 50) return;
      
      // Skip duplicates
      const textKey = text.substring(0, 50).toLowerCase();
      if (seenTexts.has(textKey)) return;
      seenTexts.add(textKey);
      
      collectedTexts.push(text);
    });
    
    // Combine all collected text
    allText = collectedTexts.join(' ');
    
    // If we still don't have much, try extracting from the entire main content
    if (allText.length < 300) {
      let fullText = mainContent.text()
        .replace(/\s+/g, ' ')
        .trim();
      
      // Remove obvious non-content sections
      fullText = fullText
        .replace(/Product Details[^.]*/gi, '')
        .replace(/Brand[^.]*/gi, '')
        .replace(/Category[^.]*/gi, '')
        .replace(/Sub Category[^.]*/gi, '')
        .replace(/Alcohol Content[^.]*/gi, '')
        .replace(/Country of Origin[^.]*/gi, '')
        .replace(/How to Open[^.]*/gi, '')
        .replace(/Description[^.]*/gi, '')
        .replace(/Youtube[^.]*/gi, '')
        .replace(/Reviews[^.]*/gi, '');
      
      // Split into sentences and filter
      const sentences = fullText.split(/[.!?]+/)
        .map(s => {
          // Remove prices and phone numbers
          s = s.replace(/KES\s*\d+[.,]?\d*/gi, '');
          s = s.replace(/ksh\s*\d+[.,]?\d*/gi, '');
          s = s.replace(/\d{9,}/g, '');
          s = s.replace(/costs?\s*(ksh|KES)?\s*\d+[.,]?\d*/gi, '');
          return s.trim();
        })
        .filter(s => {
          if (s.length < 30) return false;
          // Skip sentences with prices
          if (/KES\s*\d+|ksh\s*\d+/.test(s)) return false;
          // Skip sentences with phone numbers
          if (/\d{9,}/.test(s)) return false;
          // Skip promotional sentences
          if (/call\s+us|order\s+now|buy\s+now|click\s+here|shop\s+now|add\s+to\s+cart/i.test(s)) return false;
          if (/dial\s*a\s*drink|dialadrinkkenya|www\.dialadrinkkenya/i.test(s)) return false;
          if (/fast\s*delivery|free\s*delivery|express\s*delivery|delivery\s+available/i.test(s)) return false;
          if (/within\s*nairobi|across\s*nairobi|visit\s+our|affordable\s+price/i.test(s)) return false;
          // Skip very short sentences that are likely navigation
          if (s.length < 30 && /home|menu|cart|login|quantity|share/i.test(s)) return false;
          return true;
        })
        .slice(0, 15); // Take up to 15 good sentences
      
      if (sentences.length > 0) {
        allText = sentences.join('. ') + '.';
      }
    }
    
    let description = allText;
    
    // Clean up the description
    description = description
      .replace(/\s+/g, ' ')
      .replace(/\.{3,}/g, '.')
      .replace(/\.{2}/g, '.')
      .replace(/\s+\./g, '.')
      .replace(/\.\s*\./g, '.')
      .trim();
    
    // Remove emojis first
    description = description.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
    description = description.replace(/[\u{2600}-\u{26FF}]/gu, '');
    description = description.replace(/[\u{2700}-\u{27BF}]/gu, '');
    description = description.replace(/[🛒📱]/gu, '');
    
    // Remove UI elements and non-sentence fragments
    const uiElements = [
      /in\s+stock/gi,
      /quantity[^.]*/gi,
      /add\s+to\s+cart/gi,
      /order\s+via\s+whatsapp/gi,
      /share[^.]*/gi,
      /product\s+details/gi,
      /category/gi,
      /sub\s+category/gi,
      /alcohol\s+content/gi,
      /abv/gi,
      /rate\s+[^.]*/gi,
      /−\s*\+\s*/gi,
      /view\s+cart/gi,
      /instant\s+checkout/gi
    ];
    
    uiElements.forEach(pattern => {
      description = description.replace(pattern, '');
    });
    
    // Split into sentences and clean each one
    let sentences = description.split(/[.!?]+/)
      .map(s => {
        // Remove emojis from sentence
        s = s.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
        s = s.replace(/[\u{2600}-\u{26FF}]/gu, '');
        s = s.replace(/[\u{2700}-\u{27BF}]/gu, '');
        s = s.replace(/[🛒📱]/gu, '');
        
        // Remove prices, capacities, phone numbers
        s = s.replace(/KES\s*\d+[.,]?\d*/gi, '');
        s = s.replace(/ksh\s*\d+[.,]?\d*/gi, '');
        s = s.replace(/costs?\s*(ksh|KES)?\s*\d+[.,]?\d*/gi, '');
        s = s.replace(/\d+\s*(ml|ML|L|litre|Litre|pack|Pack|bottle|Bottle)/gi, '');
        s = s.replace(/\d+\s+min[^.]*/gi, '');
        s = s.replace(/\d{9,}/g, '');
        
        // Remove the specific fragment pattern early
        s = s.replace(/place\s+your\s+a\s+a\s+on\s+s\s+and\s+in\s+\d+\s*min/gi, '');
        s = s.replace(/place\s+your\s+[a-z]\s+[a-z]\s+on\s+[a-z]\s+and\s+in\s+\d+\s*min/gi, '');
        
        // Remove promotional phrases
        s = s.replace(/buy\s+[^.]*\s+(online|now|whisky|whiskey)/gi, '');
        s = s.replace(/order\s+(online|via|through|through\s+a\s+call)/gi, '');
        s = s.replace(/our\s+delivery\s+service\s+(are|is)\s+(free|fast)/gi, '');
        s = s.replace(/we\s+offer\s+you\s+prices/gi, '');
        s = s.replace(/free\s+and\s+fast\s+alcohol\s+delivery/gi, '');
        s = s.replace(/in\s+nairobi\s+and\s+its\s+environs/gi, '');
        s = s.replace(/website\s+to\s+sample\s+more\s+drinks/gi, '');
        s = s.replace(/ranging\s+from\s+wine[^.]*/gi, '');
        s = s.replace(/just\s+to\s+mention\s+a\s+few/gi, '');
        s = s.replace(/our\s+drinks\s+are\s+at\s+prices/gi, '');
        s = s.replace(/delivery\s+is\s+free/gi, '');
        s = s.replace(/delivery\s+(service|available|is|free|fast|will\s+be)/gi, '');
        s = s.replace(/fast\s+and\s+free/gi, '');
        s = s.replace(/free\s+delivery/gi, '');
        s = s.replace(/visit\s+our\s+(website|shop)/gi, '');
        s = s.replace(/www\.dialadrinkkenya\.com/gi, '');
        s = s.replace(/https?:\/\/[^\s]+/gi, '');
        s = s.replace(/place\s+your\s+(order|orders|a\s+a|on\s+s)/gi, '');
        s = s.replace(/place\s+your\s+[a-z]\s+[a-z]\s+on/gi, '');
        s = s.replace(/and\s+in\s+\d+\s*min/gi, '');
        s = s.replace(/call\s+(or|to|us)/gi, '');
        s = s.replace(/text\s+message/gi, '');
        s = s.replace(/the\s+drink\s+will\s+be\s+delivered/gi, '');
        s = s.replace(/affordable\s+(price|prices)/gi, '');
        s = s.replace(/at\s+affordable\s+prices/gi, '');
        s = s.replace(/just\s+in\s+case/gi, '');
        s = s.replace(/\.\s*com/gi, '');
        s = s.replace(/com\s+or\s+call/gi, '');
        s = s.replace(/rate\s+[^.]*/gi, '');
        
        // Remove ABV mentions
        s = s.replace(/abv\s*\d+%/gi, '');
        s = s.replace(/\d+%\s*abv/gi, '');
        s = s.replace(/alcohol\s+content[^.]*/gi, '');
        s = s.replace(/\(abv[^)]*\)/gi, '');
        
        // Remove standalone words that are not part of sentences
        s = s.replace(/^\s*(in\s+stock|quantity|share|category|sub\s+category|alcohol\s+content|abv|rate|add\s+to\s+cart|order\s+via|product\s+details)\s*$/gi, '');
        
        return s.trim();
      })
      .filter(s => {
        // Only keep logical sentences
        if (s.length < 30) return false;
        
        // Must be a complete sentence (starts with capital)
        if (!/^[A-Z]/.test(s)) return false;
        
        // Reject if it's just a fragment or single words
        const words = s.split(/\s+/).filter(w => w.length > 0);
        if (words.length < 5) return false;
        
        // Reject incomplete sentences (fragments with single letters or incomplete words)
        if (/\s+[a-z]\s+[a-z]\s+/.test(s.toLowerCase())) return false;
        if (/place\s+your\s+[a-z]\s+[a-z]/i.test(s)) return false;
        if (/and\s+in\s+\d+min/i.test(s)) return false;
        if (/place\s+your\s+a\s+a/i.test(s.toLowerCase())) return false;
        if (/place\s+your\s+[^.]*\s+and\s+in\s+\d+min/i.test(s)) return false;
        
        // Reject sentences with promotional keywords
        const promotionalPatterns = [
          /our\s+delivery\s+service/i,
          /we\s+offer\s+you/i,
          /free\s+and\s+fast/i,
          /delivery\s+(service|available|is|free|fast)/i,
          /buy\s+[^.]*\s+(online|now)/i,
          /order\s+(online|via|through)/i,
          /visit\s+our/i,
          /dialadrinkkenya/i,
          /place\s+your\s+(order|a|on|a\s+a|on\s+s)/i,
          /place\s+your\s+[a-z]\s+[a-z]\s+on/i,
          /place\s+your\s+a\s+a/i,
          /place\s+your\s+[^.]*\s+and\s+in\s+\d+min/i,
          /and\s+in\s+\d+\s*min/i,
          /call\s+(or|to|us)/i,
          /text\s+message/i,
          /affordable\s+price/i,
          /website\s+to\s+sample/i,
          /ranging\s+from/i,
          /just\s+to\s+mention/i,
          /our\s+drinks\s+are/i,
          /delivery\s+is\s+free/i,
          /rate\s+[^.]*/i,
          /in\s+stock/i,
          /quantity/i,
          /add\s+to\s+cart/i,
          /order\s+via/i,
          /share/i,
          /product\s+details/i,
          /category/i,
          /sub\s+category/i,
          /alcohol\s+content/i,
          /abv/i,
          /\d+\s*min/i
        ];
        
        for (const pattern of promotionalPatterns) {
          if (pattern.test(s)) return false;
        }
        
        // Reject sentences mentioning ABV
        if (/abv|alcohol\s+content|%\s*abv|abv\s*%/i.test(s)) return false;
        
        // Reject sentences with prices or phone numbers
        if (/KES\s*\d+|ksh\s*\d+/.test(s)) return false;
        if (/\d{9,}/.test(s)) return false;
        
        // Reject sentences that are just product names or fragments
        if (/^\s*[A-Z][a-z]+\s+[A-Z]/.test(s) && s.length < 50) return false;
        
        // Reject robotic/promotional phrases
        if (/we\s+are|we\s+offer|our\s+service|our\s+drinks|our\s+delivery/i.test(s) && s.length < 80) return false;
        
        // Reject any sentence starting with "Place your" that looks like a fragment
        if (/^place\s+your/i.test(s.toLowerCase())) {
          // If it has single letter words or ends with "and in Xmin", it's a fragment
          if (/\s+[a-z]\s+[a-z]\s+/.test(s.toLowerCase()) || /and\s+in\s+\d+min/i.test(s)) {
            return false;
          }
        }
        
        // Reject incomplete or nonsensical sentences
        if (/place\s+your\s+[a-z]\s+[a-z]\s+on/i.test(s)) return false;
        if (/and\s+in\s+\d+min/i.test(s)) return false;
        if (/place\s+your\s+a\s+a\s+on/i.test(s)) return false;
        if (/place\s+your\s+[^.]*\s+and\s+in\s+\d+min/i.test(s)) return false;
        
        // Reject sentences with too many single-letter words (fragments)
        const singleLetterWords = s.match(/\b[a-z]\b/gi);
        if (singleLetterWords && singleLetterWords.length > 2) return false;
        
        // Reject sentences that don't make grammatical sense (too many articles/prepositions in a row)
        if (/\b(a|an|the|on|in|at|to|for|of|with|by)\s+(a|an|the|on|in|at|to|for|of|with|by)\s+(a|an|the|on|in|at|to|for|of|with|by)/i.test(s)) return false;
        
        return true;
      })
      .map(s => {
        // Ensure sentence ends with proper punctuation
        if (!/[.!?]$/.test(s)) {
          s += '.';
        }
        return s;
      });
    
    // Filter out any sentences that are clearly fragments before joining
    sentences = sentences.filter(s => {
      const lowerS = s.toLowerCase().trim();
      
      // Debug: log sentences that start with "Place your"
      if (/^place\s+your/i.test(lowerS)) {
        console.log(`[DEBUG] Found "Place your" sentence: "${s}"`);
      }
      
      // Remove any sentence that starts with "Place your" and contains fragments
      if (/^place\s+your/i.test(lowerS)) {
        // Check for common fragment patterns - be very explicit
        if (/\s+a\s+a\s+/.test(lowerS)) {
          console.log(`[DEBUG] Rejecting sentence with "a a" pattern: "${s}"`);
          return false;
        }
        if (/\s+[a-z]\s+[a-z]\s+/.test(lowerS)) {
          console.log(`[DEBUG] Rejecting sentence with single letter pattern: "${s}"`);
          return false;
        }
        if (/and\s+in\s+\d+min/i.test(s)) {
          console.log(`[DEBUG] Rejecting sentence with "and in Xmin": "${s}"`);
          return false;
        }
        if (/a\s+a\s+on/i.test(lowerS)) {
          console.log(`[DEBUG] Rejecting sentence with "a a on": "${s}"`);
          return false;
        }
        if (/on\s+s\s+and/i.test(lowerS)) {
          console.log(`[DEBUG] Rejecting sentence with "on s and": "${s}"`);
          return false;
        }
      }
      
      // Also reject any sentence with "a a" pattern anywhere
      if (/\s+a\s+a\s+/.test(lowerS)) {
        console.log(`[DEBUG] Rejecting sentence with "a a" anywhere: "${s}"`);
        return false;
      }
      
      return true;
    });
    
    // Before joining, remove any sentence that starts with "Place your" and is clearly a fragment
    sentences = sentences.filter(s => {
      const lowerS = s.toLowerCase().trim();
      // Remove any sentence starting with "Place your" that has single letters or ends with "and in Xmin"
      if (/^place\s+your/.test(lowerS)) {
        // If it has "a a" or single letter patterns, or ends with "and in Xmin", it's a fragment
        if (/\s+a\s+a\s+/.test(lowerS) || /\s+[a-z]\s+[a-z]\s+/.test(lowerS) || /and\s+in\s+\d+\s*min/.test(lowerS)) {
          return false;
        }
      }
      return true;
    });
    
    description = sentences.join(' ').trim();
    
    // Remove any remaining fragments (final safety check) - be very aggressive
    // Use a more general pattern that catches "Place your" followed by fragments
    description = description.replace(/\.\s*place\s+your\s+[^.]*\s+(a\s+a|and\s+in\s+\d+\s*min)[^.]*/gi, '');
    description = description.replace(/\s+place\s+your\s+[^.]*\s+(a\s+a|and\s+in\s+\d+\s*min)[^.]*/gi, '');
    description = description.replace(/place\s+your\s+a\s+a[^.]*/gi, '');
    description = description.replace(/place\s+your\s+[a-z]\s+[a-z]\s+on[^.]*/gi, '');
    
    // Final cleanup
    description = description
      .replace(/\s+/g, ' ')
      .replace(/\.{2,}/g, '.')
      .replace(/\.\s*\./g, '.')
      .replace(/^\s*\.|\.\s*$/g, '')
      .trim();
    
    if (description.length < 100) {
      console.log(`Description too short for ${productName}, length: ${description.length}`);
      return null;
    }
    
    console.log(`Successfully scraped description for ${productName}, length: ${description.length}`);
    return description;
    
  } catch (error) {
    console.error(`Error scraping description for ${productName}:`, error.message);
    return null;
  }
}

module.exports = {
  scrapeProductDescription,
  generateProductUrl
};

