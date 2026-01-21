const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../models');

/**
 * Scrape brands from dialadrinkkenya.com
 * This function scrapes the brands page to get brand information
 */
async function scrapeBrands() {
  try {
    console.log('🔍 Starting brand scraping from dialadrinkkenya.com...');
    
    const url = 'https://www.dialadrinkkenya.com/brands';
    
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
    
    const brands = [];
    
    // Try multiple selectors to find brand cards/items
    const brandSelectors = [
      '.brand-item',
      '.brand-card',
      '.brand',
      '[class*="brand"]',
      '.product-brand',
      'article',
      '.entry'
    ];
    
    let brandElements = $();
    
    for (const selector of brandSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        brandElements = elements;
        console.log(`Found ${elements.length} brand elements using selector: ${selector}`);
        break;
      }
    }
    
    // If no specific brand elements found, look for links that might be brands
    if (brandElements.length === 0) {
      // Look for links that contain brand names
      const links = $('a[href*="/brand/"], a[href*="/brands/"]');
      console.log(`Found ${links.length} brand links`);
      
      links.each((i, elem) => {
        const $link = $(elem);
        const href = $link.attr('href');
        const text = $link.text().trim();
        const img = $link.find('img').first();
        
        if (text && text.length > 0) {
          const brandName = text.split('\n')[0].trim();
          let imageUrl = null;
          
          if (img.length) {
            imageUrl = img.attr('src') || img.attr('data-src') || img.data('src');
          }
          
          // Try to find image in parent container
          if (!imageUrl) {
            const parentImg = $link.parent().find('img').first();
            if (parentImg.length) {
              imageUrl = parentImg.attr('src') || parentImg.attr('data-src') || parentImg.data('src');
            }
          }
          
          if (imageUrl) {
            // Normalize image URL
            if (imageUrl.startsWith('//')) {
              imageUrl = 'https:' + imageUrl;
            } else if (imageUrl.startsWith('/')) {
              imageUrl = 'https://www.dialadrinkkenya.com' + imageUrl;
            } else if (!imageUrl.startsWith('http')) {
              imageUrl = 'https://www.dialadrinkkenya.com/' + imageUrl;
            }
          }
          
          brands.push({
            name: brandName,
            image: imageUrl,
            url: href ? (href.startsWith('http') ? href : `https://www.dialadrinkkenya.com${href}`) : null
          });
        }
      });
    } else {
      // Process brand elements
      brandElements.each((i, elem) => {
        const $elem = $(elem);
        const name = $elem.find('h1, h2, h3, h4, .title, .brand-name').first().text().trim() ||
                     $elem.text().trim().split('\n')[0].trim();
        
        const img = $elem.find('img').first();
        let imageUrl = null;
        
        if (img.length) {
          imageUrl = img.attr('src') || img.attr('data-src') || img.data('src');
        }
        
        if (imageUrl) {
          // Normalize image URL
          if (imageUrl.startsWith('//')) {
            imageUrl = 'https:' + imageUrl;
          } else if (imageUrl.startsWith('/')) {
            imageUrl = 'https://www.dialadrinkkenya.com' + imageUrl;
          } else if (!imageUrl.startsWith('http')) {
            imageUrl = 'https://www.dialadrinkkenya.com/' + imageUrl;
          }
        }
        
        const description = $elem.find('p, .description, .desc').first().text().trim();
        
        if (name && name.length > 0) {
          brands.push({
            name: name,
            image: imageUrl,
            description: description || null,
            url: $elem.find('a').first().attr('href') || null
          });
        }
      });
    }
    
    // If still no brands found, try scraping from product pages
    if (brands.length === 0) {
      console.log('No brands found on brands page, trying to extract from products...');
      // This would require scraping product pages, which is more complex
      // For now, return empty array
    }
    
    console.log(`✅ Scraped ${brands.length} brands`);
    return brands;
    
  } catch (error) {
    console.error('❌ Error scraping brands:', error.message);
    throw error;
  }
}

/**
 * Scrape individual brand details from brand page
 */
async function scrapeBrandDetails(brandUrl) {
  try {
    console.log(`🔍 Scraping brand details from: ${brandUrl}`);
    
    const response = await axios.get(brandUrl, {
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
    
    const brandData = {
      name: null,
      description: null,
      image: null,
      country: null
    };
    
    // Extract brand name
    brandData.name = $('h1').first().text().trim() ||
                     $('.brand-name').first().text().trim() ||
                     $('title').text().split('|')[0].trim();
    
    // Extract brand image
    const imgSelectors = [
      '.brand-image img',
      '.brand-logo img',
      'img[alt*="brand"]',
      '.product-image img',
      'main img',
      'article img'
    ];
    
    for (const selector of imgSelectors) {
      const img = $(selector).first();
      if (img.length) {
        let imageUrl = img.attr('src') || img.attr('data-src') || img.data('src');
        if (imageUrl) {
          // Normalize image URL
          if (imageUrl.startsWith('//')) {
            imageUrl = 'https:' + imageUrl;
          } else if (imageUrl.startsWith('/')) {
            imageUrl = 'https://www.dialadrinkkenya.com' + imageUrl;
          } else if (!imageUrl.startsWith('http')) {
            imageUrl = 'https://www.dialadrinkkenya.com/' + imageUrl;
          }
          brandData.image = imageUrl;
          break;
        }
      }
    }
    
    // Extract description
    const descSelectors = [
      '.brand-description',
      '.description',
      '.entry-content',
      'main p',
      'article p'
    ];
    
    for (const selector of descSelectors) {
      const desc = $(selector).first();
      if (desc.length && desc.text().trim().length > 50) {
        brandData.description = desc.text().trim();
        break;
      }
    }
    
    // Try to extract country from description or page content
    const pageText = $('body').text();
    const countryPatterns = [
      /from\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      /origin[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      /country[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      /produced\s+in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i
    ];
    
    for (const pattern of countryPatterns) {
      const match = pageText.match(pattern);
      if (match && match[1]) {
        brandData.country = match[1].trim();
        break;
      }
    }
    
    console.log(`✅ Scraped brand details for: ${brandData.name}`);
    return brandData;
    
  } catch (error) {
    console.error(`❌ Error scraping brand details from ${brandUrl}:`, error.message);
    throw error;
  }
}

/**
 * Sync brands from website to database
 */
async function syncBrandsFromWebsite() {
  try {
    console.log('🔄 Starting brand sync from dialadrinkkenya.com...');
    
    const scrapedBrands = await scrapeBrands();
    
    let created = 0;
    let updated = 0;
    
    for (const brandData of scrapedBrands) {
      if (!brandData.name) continue;
      
      try {
        const [brand, created] = await db.Brand.findOrCreate({
          where: { name: brandData.name },
          defaults: {
            name: brandData.name,
            description: brandData.description || null,
            image: brandData.image || null,
            country: brandData.country || null,
            isActive: true
          }
        });
        
        if (!created) {
          // Update existing brand
          await brand.update({
            description: brandData.description || brand.description,
            image: brandData.image || brand.image,
            country: brandData.country || brand.country
          });
          updated++;
        } else {
          created++;
        }
        
        // If we have a URL, try to scrape more details
        if (brandData.url && !brand.description) {
          try {
            const details = await scrapeBrandDetails(brandData.url);
            await brand.update({
              description: details.description || brand.description,
              image: details.image || brand.image,
              country: details.country || brand.country
            });
          } catch (err) {
            console.error(`Failed to scrape details for ${brandData.name}:`, err.message);
          }
        }
      } catch (error) {
        console.error(`Error processing brand ${brandData.name}:`, error.message);
      }
    }
    
    console.log(`✅ Brand sync complete: ${created} created, ${updated} updated`);
    return { created, updated, total: scrapedBrands.length };
    
  } catch (error) {
    console.error('❌ Error syncing brands:', error);
    throw error;
  }
}

module.exports = {
  scrapeBrands,
  scrapeBrandDetails,
  syncBrandsFromWebsite
};
