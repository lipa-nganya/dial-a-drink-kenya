/**
 * Import territories data from https://dialadrinkltdco.ke/dial/admin/my_territory.php
 * 
 * Usage: node backend/scripts/import-territories-from-website.js
 */

const puppeteer = require('puppeteer');
const db = require('../models');

// Login URL and credentials
const LOGIN_URL = 'https://dialadrinkltdco.ke/dial/admin/index.php';
const TERRITORIES_URL = 'https://dialadrinkltdco.ke/dial/admin/my_territory.php';
const EMAIL = 'simon@dial.com';
const USERNAME = 'simon';
const PASSWORD = 'focus2025.'; // Note: password includes period at the end

async function scrapeTerritories() {
  console.log('🚀 Starting territories import...\n');
  
  let browser;
  try {
    // Launch browser
    console.log('📱 Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to login page
    console.log('🔐 Navigating to login page...');
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Find login form
    const usernameInput = await page.$('input[name="username"], input[id="username"], input[type="text"]');
    const passwordInput = await page.$('input[name="password"], input[id="password"], input[type="password"]');
    
    if (!usernameInput || !passwordInput) {
      throw new Error('Could not find login form fields');
    }
    
    console.log('✅ Found login form!');
    
    // Fill in credentials
    console.log('✍️  Entering credentials...');
    await usernameInput.click({ clickCount: 3 });
    await usernameInput.type(EMAIL, { delay: 50 });
    
    await passwordInput.click({ clickCount: 3 });
    await passwordInput.type(PASSWORD, { delay: 50 });
    
    // Submit form
    console.log('🔑 Submitting login form...');
    const submitButton = await page.$('button[type="submit"][name="btn_login"], button#btn_login, button[type="submit"]');
    
    if (submitButton) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        submitButton.click()
      ]);
    } else {
      await page.keyboard.press('Enter');
    }
    
    // Wait for navigation
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check if login was successful
    const currentUrl = page.url();
    const loginCheckContent = await page.content();
    const isStillLoginPage = currentUrl.toLowerCase().includes('login') || 
                             loginCheckContent.toLowerCase().includes('log in');
    
    if (isStillLoginPage) {
      const errorMsg = await page.evaluate(() => {
        const alerts = document.querySelectorAll('.alert, .error, [class*="error"], [class*="alert"]');
        return Array.from(alerts).map(a => a.textContent).join(' | ') || 'Unknown error';
      });
      throw new Error(`Login failed: ${errorMsg || 'Still on login page'}`);
    }
    
    console.log('✅ Successfully logged in!');
    
    // Navigate to territories page
    console.log('📍 Navigating to territories page...');
    await page.goto(TERRITORIES_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait longer for page to load
    
    // Check if we're still on login page
    const territoriesPageUrl = page.url();
    const territoriesPageContent = await page.content();
    
    if (territoriesPageContent.toLowerCase().includes('log in') || 
        territoriesPageUrl.toLowerCase().includes('login')) {
      throw new Error('Still on login page. Login may have failed or session expired.');
    }
    
    console.log('✅ Successfully on territories page');
    
    // Scroll to load all content (in case of lazy loading or pagination)
    console.log('📜 Scrolling page to load all content...');
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Function to extract territories from current page
    const extractTerritoriesFromPage = async () => {
      return await page.evaluate(() => {
      const territories = [];
      
      // Try to find table with territories data
      const tables = document.querySelectorAll('table');
      
      console.log('Found', tables.length, 'tables on page');
      
      // Find the main data table (usually the largest one or one with most rows)
      let mainTable = null;
      let maxRows = 0;
      
      for (const table of tables) {
        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length > maxRows) {
          maxRows = rows.length;
          mainTable = table;
        }
      }
      
      if (!mainTable && tables.length > 0) {
        mainTable = tables[0]; // Fallback to first table
      }
      
      if (mainTable) {
        const rows = Array.from(mainTable.querySelectorAll('tr'));
        console.log('Main table has', rows.length, 'rows');
        
        // Try to identify header row (look for "Territory", "CBD", "Ruaka" etc.)
        let headerRowIndex = -1;
        let cbdColumnIndex = -1;
        let ruakaColumnIndex = -1;
        
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
          const headerCells = Array.from(rows[i].querySelectorAll('td, th'));
          const headerText = rows[i].textContent.toLowerCase();
          
          if (headerText.includes('territory') || 
              (headerText.includes('cbd') && headerText.includes('ruaka')) ||
              (headerText.includes('delivery'))) {
            headerRowIndex = i;
            
            // Find which columns are CBD and Ruaka
            headerCells.forEach((cell, idx) => {
              const cellText = cell.textContent.toLowerCase();
              if (cellText.includes('cbd') || cellText.includes('from cbd')) {
                cbdColumnIndex = idx;
              }
              if (cellText.includes('ruaka') || cellText.includes('from ruaka')) {
                ruakaColumnIndex = idx;
              }
            });
            break;
          }
        }
        
        // Process rows (skip header if found)
        const startIndex = headerRowIndex >= 0 ? headerRowIndex + 1 : 1;
        
        for (let i = startIndex; i < rows.length; i++) {
          const cells = Array.from(rows[i].querySelectorAll('td, th'));
          
          if (cells.length >= 2) {
            const name = cells[0]?.textContent?.trim();
            
            // Extract CBD and Ruaka fees based on column indices
            let deliveryFromCBD = 0;
            let deliveryFromRuaka = 0;
            
            if (cbdColumnIndex >= 0 && cells[cbdColumnIndex]) {
              const cbdText = cells[cbdColumnIndex].textContent.trim();
              deliveryFromCBD = parseFloat(cbdText.replace(/[^0-9.]/g, '')) || 0;
            } else if (cells.length >= 2) {
              // Fallback: assume second column is CBD
              const cbdText = cells[1]?.textContent?.trim() || '0';
              deliveryFromCBD = parseFloat(cbdText.replace(/[^0-9.]/g, '')) || 0;
            }
            
            if (ruakaColumnIndex >= 0 && cells[ruakaColumnIndex]) {
              const ruakaText = cells[ruakaColumnIndex].textContent.trim();
              deliveryFromRuaka = parseFloat(ruakaText.replace(/[^0-9.]/g, '')) || 0;
            } else if (cells.length >= 3) {
              // Fallback: assume third column is Ruaka
              const ruakaText = cells[2]?.textContent?.trim() || '0';
              deliveryFromRuaka = parseFloat(ruakaText.replace(/[^0-9.]/g, '')) || 0;
            }
            
            if (name && name.length > 0 && name.length < 100 && 
                name !== 'Territory' && name !== 'Name' && 
                !name.toLowerCase().includes('delivery') &&
                !name.toLowerCase().includes('cbd') &&
                !name.toLowerCase().includes('ruaka') &&
                !name.match(/^\d+$/)) { // Skip pure numbers
              territories.push({
                name: name,
                deliveryFromCBD: deliveryFromCBD,
                deliveryFromRuaka: deliveryFromRuaka
              });
            }
          }
        }
      } else {
        console.log('No table found on page');
      }
      
      // If no table found, try to find any structured data
      if (territories.length === 0) {
        // Try to find divs or other elements with territory data
        const territoryElements = document.querySelectorAll('[class*="territory"], [id*="territory"], [data-territory]');
        
        territoryElements.forEach(el => {
          const name = el.textContent?.trim();
          if (name && name.length > 0 && name.length < 100) {
            territories.push({
              name: name,
              deliveryFromCBD: 0,
              deliveryFromRuaka: 0
            });
          }
        });
      }
      
      // Also try to extract from any visible text that might contain territory info
      if (territories.length === 0) {
        const bodyText = document.body.innerText;
        console.log('Page content preview:', bodyText.substring(0, 500));
      }
      
        return territories;
      });
    };
    
    // Collect territories from all pages
    console.log('📊 Extracting territories from all pages...');
    let allTerritories = [];
    let pageNumber = 1;
    let hasMorePages = true;
    let maxPageSeen = 1;
    
    while (hasMorePages && pageNumber <= 15) { // Safety limit of 15 pages
      console.log(`\n📄 Extracting from page ${pageNumber}...`);
      
      // Extract territories from current page
      const pageTerritories = await extractTerritoriesFromPage();
      console.log(`   Found ${pageTerritories.length} territories on page ${pageNumber}`);
      allTerritories = allTerritories.concat(pageTerritories);
      
      // Check for next page and click it
      const nextPageNum = pageNumber + 1;
      let clicked = false;
      
      // First, check what page numbers are available
      const availablePages = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const pageNumbers = [];
        links.forEach(link => {
          const text = link.textContent.trim();
          const href = link.getAttribute('href') || '';
          const num = parseInt(text);
          if (!isNaN(num) && num > 0) {
            pageNumbers.push({ num, text, href });
          }
          // Also check href for page numbers
          const hrefMatch = href.match(/[?&](?:page|p)=(\d+)/);
          if (hrefMatch) {
            const hrefNum = parseInt(hrefMatch[1]);
            if (!pageNumbers.find(p => p.num === hrefNum)) {
              pageNumbers.push({ num: hrefNum, text: '', href });
            }
          }
        });
        return pageNumbers.sort((a, b) => a.num - b.num);
      });
      
      console.log(`   Available page numbers: ${availablePages.map(p => p.num).join(', ')}`);
      
      // Try to find and click the next page number link
      const nextPageInfo = availablePages.find(p => p.num === nextPageNum);
      
      if (nextPageInfo) {
        const clickedResult = await page.evaluate((targetPage) => {
          const links = Array.from(document.querySelectorAll('a'));
          for (const link of links) {
            const text = link.textContent.trim();
            const href = link.getAttribute('href') || '';
            if (text === targetPage.toString() || 
                href.includes(`page=${targetPage}`) || 
                href.includes(`p=${targetPage}`)) {
              link.click();
              return true;
            }
          }
          return false;
        }, nextPageNum);
        
        if (clickedResult) {
          clicked = true;
          console.log(`   → Clicked page ${nextPageNum} link`);
        }
      }
      
      if (!clicked) {
        // Try to find "Next" button or link
        const nextClicked = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a, button'));
          for (const el of links) {
            const text = el.textContent.toLowerCase().trim();
            if (text === 'next' || text === '>' || text === '»' || text.includes('next')) {
              el.click();
              return true;
            }
          }
          return false;
        });
        
        if (nextClicked) {
          clicked = true;
          console.log(`   → Clicked Next button`);
        }
      }
      
      // Check the maximum page number available
      const maxPage = availablePages.length > 0 ? Math.max(...availablePages.map(p => p.num)) : pageNumber;
      if (maxPage > maxPageSeen) {
        maxPageSeen = maxPage;
      }
      
      // If we see page 10 in pagination, there might be pages 2-5 that are hidden
      // Try to navigate to them if we haven't visited them yet
      if (maxPage >= 10 && pageNumber < 6) {
        // We're on an early page but max page is 10, so pages 2-5 exist but are hidden
        // Continue to next page normally
      }
      
      if (clicked && nextPageNum <= maxPage && pageNumber < 15) {
        console.log(`   → Waiting for page ${nextPageNum} to load...`);
        await new Promise(resolve => setTimeout(resolve, 4000));
        
        // Wait for table to load
        try {
          await page.waitForSelector('table', { timeout: 10000 });
        } catch (e) {
          console.log('   ⚠️  Table not found, continuing...');
        }
        
        pageNumber++;
      } else if (nextPageNum > maxPage) {
        hasMorePages = false;
        console.log(`   ✋ Reached last page (max available: ${maxPage})`);
      } else if (!clicked && nextPageNum <= maxPage) {
        // Try navigating directly to the next page URL
        console.log(`   ⚠️  Couldn't click, trying direct navigation to page ${nextPageNum}...`);
        const directUrl = await page.evaluate((nextPage) => {
          const links = Array.from(document.querySelectorAll('a'));
          for (const link of links) {
            const href = link.getAttribute('href') || '';
            if (href.includes(`page=${nextPage}`) || href.includes(`p=${nextPage}`)) {
              return href.startsWith('http') ? href : (window.location.origin + (href.startsWith('/') ? '' : '/') + href);
            }
          }
          // Try constructing URL from current URL
          const currentUrl = window.location.href;
          if (currentUrl.includes('page=')) {
            return currentUrl.replace(/page=\d+/, `page=${nextPage}`);
          } else if (currentUrl.includes('p=')) {
            return currentUrl.replace(/p=\d+/, `p=${nextPage}`);
          } else {
            const separator = currentUrl.includes('?') ? '&' : '?';
            return `${currentUrl}${separator}page=${nextPage}`;
          }
        }, nextPageNum);
        
        if (directUrl) {
          console.log(`   → Navigating directly to: ${directUrl}`);
          try {
            await page.goto(directUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            await new Promise(resolve => setTimeout(resolve, 3000));
            clicked = true;
            pageNumber++;
          } catch (e) {
            console.log(`   ❌ Failed to navigate: ${e.message}`);
            hasMorePages = false;
          }
        } else {
          hasMorePages = false;
          console.log(`   ✋ No more pages found (tried page ${nextPageNum}, max available: ${maxPage})`);
        }
      } else {
        hasMorePages = false;
        console.log(`   ✋ No more pages found (tried page ${nextPageNum})`);
      }
    }
    
    console.log(`\n✅ Collected territories from ${pageNumber} page(s)`);
    console.log(`📦 Total territories found: ${allTerritories.length}`);
    
    // Remove duplicates based on name
    const uniqueTerritories = [];
    const seenNames = new Set();
    for (const territory of allTerritories) {
      if (!seenNames.has(territory.name)) {
        seenNames.add(territory.name);
        uniqueTerritories.push(territory);
      }
    }
    
    console.log(`📦 Unique territories: ${uniqueTerritories.length}`);
    
    const territoriesData = uniqueTerritories;
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'territories-page-screenshot.png', fullPage: true });
    console.log('📸 Screenshot saved to territories-page-screenshot.png');
    
    // Get page HTML for debugging
    const pageContent = await page.content();
    console.log('📄 Page HTML length:', pageContent.length);
    
    // Also try to get the raw HTML to parse manually
    console.log('\n📋 Extracted territories:', JSON.stringify(territoriesData, null, 2));
    
    if (territoriesData.length === 0) {
      console.log('\n⚠️  No territories found. Saving page HTML for manual inspection...');
      const fs = require('fs');
      fs.writeFileSync('territories-page-html.html', pageContent);
      console.log('💾 Page HTML saved to territories-page-html.html');
      
      // Try alternative parsing
      console.log('\n🔍 Trying alternative parsing methods...');
      const alternativeData = await page.evaluate(() => {
        // Look for any text that might be territory names
        const allText = document.body.innerText;
        const lines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        return {
          allText: allText.substring(0, 2000),
          lines: lines.slice(0, 50),
          tableCount: document.querySelectorAll('table').length,
          divCount: document.querySelectorAll('div').length
        };
      });
      
      console.log('Alternative data:', JSON.stringify(alternativeData, null, 2));
    }
    
    await browser.close();
    
    return territoriesData;
    
  } catch (error) {
    console.error('❌ Error scraping territories:', error);
    if (browser) {
      await browser.close();
    }
    throw error;
  }
}

async function importTerritories(territories) {
  console.log('\n💾 Importing territories into database...\n');
  
  let imported = 0;
  let updated = 0;
  let errors = 0;
  
  for (const territory of territories) {
    try {
      // Check if territory already exists
      const [territoryRecord, created] = await db.Territory.findOrCreate({
        where: { name: territory.name.trim() },
        defaults: {
          name: territory.name.trim(),
          deliveryFromCBD: territory.deliveryFromCBD || 0,
          deliveryFromRuaka: territory.deliveryFromRuaka || 0
        }
      });
      
      if (created) {
        console.log(`✅ Created: ${territory.name} (CBD: ${territory.deliveryFromCBD}, Ruaka: ${territory.deliveryFromRuaka})`);
        imported++;
      } else {
        // Update existing territory
        territoryRecord.deliveryFromCBD = territory.deliveryFromCBD || 0;
        territoryRecord.deliveryFromRuaka = territory.deliveryFromRuaka || 0;
        await territoryRecord.save();
        console.log(`🔄 Updated: ${territory.name} (CBD: ${territory.deliveryFromCBD}, Ruaka: ${territory.deliveryFromRuaka})`);
        updated++;
      }
    } catch (error) {
      console.error(`❌ Error importing ${territory.name}:`, error.message);
      errors++;
    }
  }
  
  console.log(`\n📊 Import Summary:`);
  console.log(`   ✅ Created: ${imported}`);
  console.log(`   🔄 Updated: ${updated}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📦 Total: ${territories.length}`);
}

async function main() {
  try {
    // Connect to database
    await db.sequelize.authenticate();
    console.log('✅ Database connection established.\n');
    
    // Scrape territories from website
    const territories = await scrapeTerritories();
    
    if (territories.length === 0) {
      console.log('\n⚠️  No territories found. Please check:');
      console.log('   1. The screenshot: territories-page-screenshot.png');
      console.log('   2. The HTML file: territories-page-html.html');
      console.log('   3. Verify the login credentials and URL are correct');
      process.exit(1);
    }
    
    // Save territories to JSON file for importing to other environments
    const fs = require('fs');
    const path = require('path');
    const territoriesFile = path.join(__dirname, 'territories-data.json');
    fs.writeFileSync(territoriesFile, JSON.stringify(territories, null, 2));
    console.log(`\n💾 Saved ${territories.length} territories to ${territoriesFile}`);
    console.log('   You can now import to other environments using:');
    console.log('   node backend/scripts/import-territories-to-all-envs.js --all\n');
    
    // Import into database
    await importTerritories(territories);
    
    console.log('\n✅ Import complete!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { scrapeTerritories, importTerritories };
