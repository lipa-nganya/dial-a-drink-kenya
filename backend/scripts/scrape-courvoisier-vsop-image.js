const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const db = require('../models');

async function scrapeCourvoisierVSOPImage() {
  try {
    console.log('Searching for Courvoisier VSOP products...');
    
    // Find all Courvoisier VSOP products
    const drinks = await db.Drink.findAll({
      where: {
        name: { [db.Sequelize.Op.iLike]: '%Courvoisier VSOP%' }
      }
    });

    console.log(`Found ${drinks.length} Courvoisier VSOP products`);

    if (drinks.length === 0) {
      console.log('No Courvoisier VSOP products found');
      return;
    }

    // Fetch Courvoisier VSOP product page
    console.log('Fetching Courvoisier VSOP product page...');
    
    try {
      // Try multiple URLs
      const urlsToTry = [
        'https://www.dialadrinkkenya.com/search/courvoisier-vsop',
        'https://www.dialadrinkkenya.com/courvoisier-vsop-1litre'
      ];

      let response = null;
      let productUrl = null;

      for (const url of urlsToTry) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            console.log(`Trying: ${url} (attempt ${attempt}/3)`);
            response = await axios.get(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
              },
              timeout: 45000
            });
            productUrl = url;
            break;
          } catch (err) {
            console.log(`Failed to fetch ${url} (attempt ${attempt}): ${err.message}`);
            if (attempt < 3) {
              console.log('Waiting 2 seconds before retry...');
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }
        if (response) break;
      }

      if (!response) {
        console.log('Could not fetch any URL');
        return;
      }

      const $ = cheerio.load(response.data);
      
      // Try to find the product image
      let imageUrl = null;
      
      // Try multiple selectors for product images
      const selectors = [
        '.product-image img',
        '.woocommerce-product-gallery img',
        '.product-images img',
        'img[src*="courvoisier"]',
        'img[alt*="Courvoisier"]',
        'img[alt*="courvoisier"]',
        'img[alt*="VSOP"]',
        'img[alt*="vsop"]',
        '.single-product-image img',
        '.product-gallery img'
      ];

      for (const selector of selectors) {
        const img = $(selector).first();
        if (img.length > 0) {
          imageUrl = img.attr('src') || img.attr('data-src') || img.attr('data-lazy-src') || img.attr('data-original');
          if (imageUrl && !imageUrl.includes('placeholder') && !imageUrl.includes('fallback')) {
            console.log(`Found image with selector: ${selector}`);
            console.log(`Image URL: ${imageUrl}`);
            break;
          }
        }
      }

      // If not found, try looking at all images
      if (!imageUrl) {
        console.log('Trying all images on page...');
        $('img').each((i, elem) => {
          const alt = ($(elem).attr('alt') || '').toLowerCase();
          const src = $(elem).attr('src') || $(elem).attr('data-src') || $(elem).attr('data-lazy-src') || $(elem).attr('data-original') || '';
          
          if ((alt.includes('courvoisier') || alt.includes('vsop')) && src && !imageUrl && !src.includes('placeholder') && !src.includes('fallback') && !src.includes('logo') && !src.includes('icon')) {
            imageUrl = src;
            console.log(`Found image with alt: ${alt}`);
            console.log(`Image URL: ${src}`);
            return false; // break
          }
        });
      }

      if (!imageUrl) {
        console.log('Could not find image URL');
        return;
      }

      // Make sure URL is absolute
      if (imageUrl.startsWith('//')) {
        imageUrl = 'https:' + imageUrl;
      } else if (imageUrl.startsWith('/')) {
        imageUrl = 'https://www.dialadrinkkenya.com' + imageUrl;
      }

      // If it's a Cloudinary URL, try to get a larger version
      if (imageUrl.includes('cloudinary.com')) {
        console.log('Found Cloudinary image, trying to get larger version...');
        // Extract the base image path (everything after /v1/)
        const match = imageUrl.match(/(\/v\d+\/.*)/);
        if (match) {
          // Try original without transformations
          const baseUrl = imageUrl.split('/upload/')[0] + '/upload' + match[1];
          // Or try with quality improvement and larger size
          const largeUrl = imageUrl.split('/upload/')[0] + '/upload/q_auto,f_auto,w_800,h_800' + match[1];
          
          // Try the large version first
          try {
            const testResponse = await axios.head(largeUrl, { timeout: 5000 });
            if (testResponse.status === 200) {
              imageUrl = largeUrl;
              console.log('Using large Cloudinary URL (800x800)');
            }
          } catch (e) {
            // Try the original URL
            try {
              const testResponse = await axios.head(baseUrl, { timeout: 5000 });
              if (testResponse.status === 200) {
                imageUrl = baseUrl;
                console.log('Using original Cloudinary URL');
              }
            } catch (e2) {
              console.log('Could not get larger version, using original URL');
            }
          }
        }
      }

      console.log(`Downloading image from: ${imageUrl}`);

      // Download the image
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 15000
      });

      // Determine file extension
      const contentType = imageResponse.headers['content-type'];
      let extension = '.jpg';
      if (contentType.includes('png')) extension = '.png';
      else if (contentType.includes('webp')) extension = '.webp';

      // Determine category folder
      const category = await db.Category.findByPk(drinks[0].categoryId);
      let categoryFolder = 'cognac'; // Default
      if (category) {
        const name = category.name.toLowerCase();
        categoryFolder = name.replace(/\s+/g, '-');
      }
      
      // Create directory if it doesn't exist
      const imageDir = path.join(__dirname, '../public/images/drinks', categoryFolder);
      if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
      }

      // Save image for each product
      for (const drink of drinks) {
        const filename = `${drink.id}_${drink.name.replace(/[^a-zA-Z0-9]/g, '_')}${extension}`;
        const filepath = path.join(imageDir, filename);
        const imagePath = `/images/drinks/${categoryFolder}/${filename}`;

        fs.writeFileSync(filepath, imageResponse.data);
        console.log(`Saved image: ${filepath}`);

        // Update database
        await drink.update({ image: imagePath });
        console.log(`Updated database for ${drink.name} (ID: ${drink.id})`);
      }

      console.log('✅ Successfully scraped and updated Courvoisier VSOP images');

    } catch (error) {
      console.error('Error fetching/scraping image:', error.message);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.sequelize.close();
  }
}

scrapeCourvoisierVSOPImage();

