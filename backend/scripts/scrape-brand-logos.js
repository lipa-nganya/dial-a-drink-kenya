const axios = require('axios');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const db = require('../models');

/**
 * Scrape brand logos from the internet
 * Uses multiple sources to find brand logos
 */
async function scrapeBrandLogo(brandName) {
  try {
    // Helper function to normalize brand name for URL
    const slugify = (text) => {
      return text.toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
    };

    const brandSlug = slugify(brandName);

    // Try nairobidrinks.co.ke first (better logo quality)
    try {
      // Try brand-specific page first
      const brandUrls = [
        `https://nairobidrinks.co.ke/brands/${brandSlug}-brands`,
        `https://nairobidrinks.co.ke/brand/${brandSlug}`,
        `https://nairobidrinks.co.ke/products/${brandSlug}`,
        `https://nairobidrinks.co.ke/brands/${brandSlug}`
      ];

      for (const brandUrl of brandUrls) {
        try {
          const response = await axios.get(brandUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Referer': 'https://nairobidrinks.co.ke/'
            },
            timeout: 10000,
            validateStatus: (status) => status < 500
          });

          if (response.status === 200) {
            const cheerio = require('cheerio');
            const $ = cheerio.load(response.data);
            
            // Look for brand/product images on nairobidrinks
            const imgSelectors = [
              `img[src*="${brandSlug}"]`,
              `img[alt*="${brandName}"]`,
              `img[alt*="${brandSlug}"]`,
              '.product-image img',
              '.brand-image img',
              'img.product-img',
              'img[src*="nairobidrinks"]'
            ];

            for (const selector of imgSelectors) {
              const imgs = $(selector);
              if (imgs.length > 0) {
                // Try to find the best quality image (usually first one or largest)
                for (let i = 0; i < Math.min(3, imgs.length); i++) {
                  const img = $(imgs[i]);
                  let imageUrl = img.attr('src') || img.attr('data-src') || img.attr('data-lazy-src') || img.data('src');
                  
                  if (imageUrl) {
                    // Normalize URL
                    if (imageUrl.startsWith('//')) {
                      imageUrl = 'https:' + imageUrl;
                    } else if (imageUrl.startsWith('/')) {
                      imageUrl = 'https://nairobidrinks.co.ke' + imageUrl;
                    } else if (!imageUrl.startsWith('http')) {
                      imageUrl = 'https://nairobidrinks.co.ke/' + imageUrl;
                    }

                    // Clean up image URL
                    imageUrl = imageUrl.split('?')[0]; // Remove query params

                    // Skip very small images (likely icons)
                    if (imageUrl && !imageUrl.includes('icon') && !imageUrl.includes('logo-small')) {
                      return imageUrl;
                    }
                  }
                }
              }
            }
          }
        } catch (err) {
          // Continue to next URL
          continue;
        }
      }
    } catch (err) {
      // Continue to next source
    }

    // Try to find logo on the old dialadrinkkenya.com site
    const searchTerms = [
      brandName,
      `${brandName} logo`,
      `${brandName} brand`
    ];

    for (const searchTerm of searchTerms) {
      try {
        // Search on dialadrinkkenya.com
        const searchUrl = `https://www.dialadrinkkenya.com/brand/${encodeURIComponent(searchTerm.toLowerCase().replace(/\s+/g, '-'))}`;
        
        const response = await axios.get(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 10000,
          validateStatus: (status) => status < 500 // Accept 404s
        });

        if (response.status === 200) {
          const cheerio = require('cheerio');
          const $ = cheerio.load(response.data);
          
          // Look for brand images
          const imgSelectors = [
            'img[src*="brand"]',
            'img[alt*="' + brandName + '"]',
            '.brand-image img',
            '.product-image img',
            'img[src*="' + brandName.toLowerCase().replace(/\s+/g, '-') + '"]'
          ];

          for (const selector of imgSelectors) {
            const img = $(selector).first();
            if (img.length) {
              let imageUrl = img.attr('src') || img.attr('data-src') || img.data('src');
              
              if (imageUrl) {
                // Normalize URL
                if (imageUrl.startsWith('//')) {
                  imageUrl = 'https:' + imageUrl;
                } else if (imageUrl.startsWith('/')) {
                  imageUrl = 'https://www.dialadrinkkenya.com' + imageUrl;
                } else if (!imageUrl.startsWith('http')) {
                  imageUrl = 'https://www.dialadrinkkenya.com/' + imageUrl;
                }

                // Remove Cloudinary transformations for better quality
                if (imageUrl.includes('cloudinary.com')) {
                  imageUrl = imageUrl.replace(/\/c_fit,f_auto,h_\d+,w_\d+\//, '/');
                  imageUrl = imageUrl.replace(/\/c_fill,f_auto,h_\d+,w_\d+\//, '/');
                }

                return imageUrl;
              }
            }
          }
        }
      } catch (err) {
        // Continue to next search term
        continue;
      }
    }

    // If not found on dialadrinkkenya.com, try DuckDuckGo image search API
    try {
      const duckDuckGoUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(brandName + ' logo')}&format=json&no_html=1&skip_disambig=1`;
      const response = await axios.get(duckDuckGoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      if (response.data && response.data.Image) {
        return response.data.Image;
      }
    } catch (err) {
      // Continue
    }

    return null;
  } catch (error) {
    console.error(`Error scraping logo for ${brandName}:`, error.message);
    return null;
  }
}

/**
 * Download and save brand logo
 */
async function downloadBrandLogo(brand, imageUrl) {
  try {
    const imagesDir = path.join(__dirname, '../../frontend/public/images/brands');
    
    // Ensure directory exists
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    // Generate filename
    const slug = brand.name.toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
    
    const fileExtension = path.extname(imageUrl.split('?')[0]) || '.jpg';
    const filename = `${slug}${fileExtension}`;
    const filepath = path.join(imagesDir, filename);

    // Skip if file already exists
    if (fs.existsSync(filepath)) {
      console.log(`⏭️  Logo already exists: ${filename}`);
      return `/images/brands/${filename}`;
    }

    // Download image
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'stream',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': imageUrl.includes('nairobidrinks.co.ke') ? 'https://nairobidrinks.co.ke/' : 'https://www.dialadrinkkenya.com/'
      }
    });

    // Save image
    const writer = fs.createWriteStream(filepath);
    imageResponse.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    console.log(`✅ Downloaded logo: ${filename}`);
    return `/images/brands/${filename}`;

  } catch (error) {
    console.error(`❌ Error downloading logo for ${brand.name}:`, error.message);
    return null;
  }
}

/**
 * Read brands from CSV file
 */
async function readBrandsFromCSV(csvFilePath) {
  return new Promise((resolve, reject) => {
    const brands = [];
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row) => {
        if (row.id && row.name) {
          brands.push({
            id: parseInt(row.id),
            name: row.name.trim(),
            country: row.country ? row.country.trim() : null
          });
        }
      })
      .on('end', () => resolve(brands))
      .on('error', reject);
  });
}

/**
 * Main function to scrape logos for brands from CSV
 */
async function scrapeAllBrandLogos(csvFilePath) {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connection established');

    // Read brands from CSV
    if (!fs.existsSync(csvFilePath)) {
      console.error(`❌ CSV file not found: ${csvFilePath}`);
      process.exit(1);
    }

    const csvBrands = await readBrandsFromCSV(csvFilePath);
    console.log(`📄 Read ${csvBrands.length} brands from CSV\n`);

    // Get or create brands from database
    const brandsToProcess = [];
    for (const csvBrand of csvBrands) {
      let brand = await db.Brand.findOne({
        where: { name: csvBrand.name.trim() }
      });

      if (!brand) {
        // Create brand if it doesn't exist
        const imageSlug = csvBrand.name.toLowerCase()
          .trim()
          .replace(/\s+/g, '-')
          .replace(/[^\w\-]+/g, '')
          .replace(/\-\-+/g, '-')
          .replace(/^-+/, '')
          .replace(/-+$/, '');
        const imagePath = `/images/brands/${imageSlug}.jpg`;

        brand = await db.Brand.create({
          name: csvBrand.name.trim(),
          country: csvBrand.country || null,
          image: imagePath,
          isActive: true
        });
        console.log(`✅ Created brand: ${brand.name}`);
      }

      brandsToProcess.push(brand);
    }

    console.log(`📦 Processing ${brandsToProcess.length} brands from CSV\n`);

    let downloaded = 0;
    let skipped = 0;
    let failed = 0;

    for (const brand of brandsToProcess) {
      try {
        // Skip if brand already has an image that exists
        if (brand.image && brand.image.startsWith('/images/brands/')) {
          const imagePath = path.join(__dirname, '../../frontend/public', brand.image);
          if (fs.existsSync(imagePath)) {
            console.log(`⏭️  Skipping ${brand.name} - image already exists`);
            skipped++;
            continue;
          }
        }

        console.log(`🔍 Searching for logo: ${brand.name}`);
        
        // Scrape logo
        const imageUrl = await scrapeBrandLogo(brand.name);
        
        if (imageUrl) {
          // Download and save logo
          const imagePath = await downloadBrandLogo(brand, imageUrl);
          
          if (imagePath) {
            // Update database
            await brand.update({ image: imagePath });
            downloaded++;
          } else {
            failed++;
          }
        } else {
          console.log(`⚠️  Logo not found for: ${brand.name}`);
          failed++;
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ Error processing ${brand.name}:`, error.message);
        failed++;
      }
    }

    console.log('\n📊 Scraping Summary:');
    console.log(`✅ Downloaded: ${downloaded} logos`);
    console.log(`⏭️  Skipped: ${skipped} logos`);
    console.log(`❌ Failed: ${failed} logos`);

    await db.sequelize.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Scraping failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  const csvFilePath = process.argv[2] || path.join(__dirname, '../../Downloads/brands.csv');
  scrapeAllBrandLogos(csvFilePath)
    .then(() => {
      console.log('\n✅ Brand logo scraping completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Brand logo scraping failed:', error);
      process.exit(1);
    });
}

module.exports = { scrapeBrandLogo, downloadBrandLogo, scrapeAllBrandLogos };
