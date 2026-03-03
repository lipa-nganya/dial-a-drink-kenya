const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Script to scrape tags from dialadrinkkenya.com/admin
 * 
 * This script:
 * 1. Logs in to the admin panel
 * 2. Navigates to the products/inventory page
 * 3. Extracts tags from all drinks
 * 4. Saves to JSON file
 * 
 * Usage:
 *   node scripts/scrape-tags-from-dialadrinkkenya.js
 */

const LOGIN_URL = 'https://www.dialadrinkkenya.com/admin/login';
const PRODUCTS_URL = 'https://www.dialadrinkkenya.com/admin/products';
const CREDENTIALS = {
  email: 'simonkimari@gmail.com',
  password: 'admin12345'
};

async function scrapeTags() {
  let browser;
  let page;
  try {
    console.log('🚀 Starting tag scraping from dialadrinkkenya.com...\n');

    // Launch browser - try to use system Chrome
    console.log('🌐 Launching browser...');
    const chromePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser'
    ];
    
    let executablePath = null;
    for (const path of chromePaths) {
      try {
        const fs = require('fs');
        if (fs.existsSync(path)) {
          executablePath = path;
          console.log(`✅ Found Chrome at: ${path}`);
          break;
        }
      } catch (e) {
        // Continue
      }
    }
    
    browser = await puppeteer.launch({
      headless: false,
      executablePath: executablePath || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Capture all API responses (merge paginated pages; production has ~2077 products)
    const capturedBatches = [];
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/drinks') || (url.includes('/products') && (url.includes('/api') || url.includes('admin')))) {
        try {
          const data = await response.json();
          const list = Array.isArray(data) ? data : (data && (data.data || data.drinks || data.products));
          if (Array.isArray(list) && list.length > 0) {
            const first = list[0];
            if (first && (first.name !== undefined || first.title !== undefined)) {
              capturedBatches.push(list);
              console.log(`   📥 Captured batch of ${list.length} from API`);
            }
          }
        } catch (e) {}
      }
    });

    // Step 1: Navigate to login page
    console.log('📥 Navigating to login page...');
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // Step 2: Fill in login form
    console.log('🔐 Filling in login credentials...');
    await page.waitForSelector('input[type="email"], input[name="email"], input[type="text"]', { timeout: 10000 });
    
    // Try different selectors for email field
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[placeholder*="Email" i]',
      'input[placeholder*="email" i]',
      'input[type="text"]'
    ];
    
    let emailFilled = false;
    for (const selector of emailSelectors) {
      try {
        const emailField = await page.$(selector);
        if (emailField) {
          await emailField.type(CREDENTIALS.email, { delay: 100 });
          emailFilled = true;
          console.log(`✅ Filled email using selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }

    if (!emailFilled) {
      throw new Error('Could not find email input field');
    }

    // Fill password
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.type('input[type="password"]', CREDENTIALS.password, { delay: 100 });
    console.log('✅ Filled password');

    // Step 3: Click login button (Puppeteer does not support :has-text(); try multiple selectors)
    console.log('🔘 Clicking login button...');
    const loginButtonClicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, input[type="submit"]');
      for (const btn of buttons) {
        const text = (btn.textContent || btn.value || '').trim();
        if (/sign\s*in|login/i.test(text) || btn.type === 'submit') {
          btn.click();
          return true;
        }
      }
      return false;
    });
    if (!loginButtonClicked) {
      throw new Error('Could not find Sign In / Login button');
    }
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});

    // Wait a bit for redirect
    await new Promise(r => setTimeout(r, 2000));

    // Check if login was successful (URL should change)
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);

    if (currentUrl.includes('/login')) {
      console.error('❌ Still on login page. Login may have failed.');
      console.log('💡 Taking screenshot for debugging...');
      await page.screenshot({ path: 'login-failed.png', fullPage: true });
      throw new Error('Login failed - still on login page');
    }

    console.log('✅ Login successful!');

    // Step 4: Navigate to products page
    console.log('📦 Navigating to products page...');
    await page.goto(PRODUCTS_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000)); // Wait for page to load

    // Scroll to trigger lazy loading / load all rows
    // Scroll and paginate to load all ~2077 products (virtual list / lazy load)
    console.log('📜 Scrolling / paginating to load all products...');
    const maxScrolls = 80;
    const scrollPause = 600;
    for (let i = 0; i < maxScrolls; i++) {
      const prevHeight = await page.evaluate(() => document.body.scrollHeight);
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
        const table = document.querySelector('table [role="grid"], .MuiTableContainer-root, [class*="TableContainer"]');
        if (table) table.scrollTop = table.scrollHeight;
      });
      await new Promise(r => setTimeout(r, scrollPause));
      const newHeight = await page.evaluate(() => document.body.scrollHeight);
      if (i > 5 && newHeight === prevHeight) break;
      if ((i + 1) % 10 === 0) console.log(`   Scrolled ${i + 1} times...`);
    }
    for (let p = 0; p < 100; p++) {
      const clicked = await page.evaluate(() => {
        const next = Array.from(document.querySelectorAll('button, a, [role="button"]')).find(el =>
          /next|›|»|>\s*$/.test((el.textContent || '').trim()) || (el.getAttribute('aria-label') || '').toLowerCase().includes('next')
        );
        if (next && !next.disabled) { next.click(); return true; }
        return false;
      });
      if (!clicked) break;
      await new Promise(r => setTimeout(r, 1500));
      if ((p + 1) % 5 === 0) console.log(`   Pagination page ${p + 1}...`);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 1000));

    console.log('⏳ Extracting data...');
    await new Promise(r => setTimeout(r, 2000));
    
    // If we didn't capture from network, try API + DOM; then optionally collect while scrolling (for virtual/paginated tables)
    if (!drinksData) {
      console.log('🔍 Trying to extract data from page (API then DOM)...');
      drinksData = await page.evaluate(async () => {
        // 1) Try localStorage + API (request high limit to get all ~2077 products)
        const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
        if (token) {
          const base = window.location.origin;
          const baseEndpoints = [
            '/api/admin/drinks',
            '/api/drinks',
            base + '/api/admin/drinks',
            'https://deliveryos-production-backend-805803410802.us-central1.run.app/api/admin/drinks'
          ];
          const limitParams = ['?limit=2500', '?limit=5000', '?per_page=2500', '?pageSize=2500', ''];
          for (const endpoint of baseEndpoints) {
            const urlBase = endpoint.startsWith('http') ? endpoint : base + endpoint;
            for (const q of limitParams) {
              try {
                const url = q ? urlBase + (urlBase.includes('?') ? '&' + q.replace('?', '') : q) : urlBase;
                const response = await fetch(url, {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  }
                });
                if (!response.ok) continue;
                const body = await response.json();
                let drinks = Array.isArray(body) ? body : (body.data || body.drinks || body.products || null);
                if (drinks && drinks.length > 0 && drinks[0] && (drinks[0].name !== undefined || drinks[0].title !== undefined)) {
                  return drinks;
                }
              } catch (e) {}
            }
          }
          // Pagination fallback: fetch page by page until no more
          for (const endpoint of baseEndpoints) {
            const urlBase = endpoint.startsWith('http') ? endpoint : base + endpoint;
            const all = [];
            for (let page = 1; page <= 150; page++) {
              try {
                const sep = urlBase.includes('?') ? '&' : '?';
                const url = `${urlBase}${sep}page=${page}&limit=100`;
                const response = await fetch(url, {
                  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
                });
                if (!response.ok) break;
                const body = await response.json();
                let list = Array.isArray(body) ? body : (body.data || body.drinks || body.products || []);
                if (!list || list.length === 0) break;
                all.push(...list);
                if (list.length < 100) break;
              } catch (e) { break; }
            }
            if (all.length > 0 && all[0] && (all[0].name !== undefined || all[0].title !== undefined)) {
              return all;
            }
          }
        }

        // 2) Try __NEXT_DATA__ or similar hydration JSON
        const scriptEl = document.querySelector('script#__NEXT_DATA__');
        if (scriptEl && scriptEl.textContent) {
          try {
            const nextData = JSON.parse(scriptEl.textContent);
            const props = nextData.props || nextData.propsPage || {};
            const pageProps = props.pageProps || {};
            const drinks = pageProps.drinks || pageProps.products || nextData.props?.pageProps?.drinks;
            if (Array.isArray(drinks) && drinks.length > 0) return drinks;
          } catch (e) {}
        }

        // 3) DOM scrape: find product rows/cards and their tags
        const results = [];
        const seenNames = new Set();

        function addProduct(id, name, tags) {
          const n = (name || '').trim();
          if (!n || seenNames.has(n)) return;
          seenNames.add(n);
          const tagList = Array.isArray(tags) ? tags : (tags ? [].concat(tags) : []);
          const uniqueTags = [...new Set(tagList.map(t => String(t).trim()).filter(Boolean))];
          results.push({ id: id || null, name: n, slug: null, tags: uniqueTags });
        }

        // 3a) Table rows: tr with cells containing product link and tag chips
        const rows = document.querySelectorAll('table tbody tr, [role="row"]');
        for (const row of rows) {
          const cells = row.querySelectorAll('td, [role="cell"]');
          let name = null;
          let id = null;
          const tagTexts = [];
          for (const cell of cells) {
            const link = cell.querySelector('a[href*="/product"], a[href*="/drink"], a[href*="edit"]');
            if (link) {
              name = (link.textContent || '').trim();
              const href = (link.getAttribute('href') || '');
              const idMatch = href.match(/\/(\d+)\/?$/);
              if (idMatch) id = idMatch[1];
            }
            const chips = cell.querySelectorAll('[class*="Chip"], .MuiChip-root, [class*="chip"]');
            chips.forEach(chip => {
              const t = (chip.textContent || '').trim();
              if (t && t.length < 80) tagTexts.push(t);
            });
            if (!chips.length && cell.getAttribute('data-field') === 'tags') {
              const t = (cell.textContent || '').trim();
              if (t) tagTexts.push(...t.split(/[,;]/).map(s => s.trim()).filter(Boolean));
            }
          }
          if (name) addProduct(id, name, tagTexts);
        }

        // 3b) Product cards / list items: container with title + tags
        const containers = document.querySelectorAll('[class*="product"], [class*="Product"], [data-id], .MuiTableRow-root');
        for (const container of containers) {
          const link = container.querySelector('a[href*="/product"], a[href*="/drink"], a[href*="edit"]');
          const nameEl = container.querySelector('[class*="name"], [class*="title"], td:first-child');
          const name = link ? (link.textContent || '').trim() : (nameEl ? (nameEl.textContent || '').trim() : '');
          if (!name) continue;
          const href = link ? (link.getAttribute('href') || '') : '';
          const idMatch = href.match(/\/(\d+)\/?$/);
          const id = idMatch ? idMatch[1] : null;
          const tagEls = container.querySelectorAll('[class*="Chip"], .MuiChip-root, [class*="tag"]');
          const tagTexts = [];
          tagEls.forEach(el => {
            const t = (el.textContent || '').trim();
            if (t && t.length < 80) tagTexts.push(t);
          });
          addProduct(id, name, tagTexts);
        }

        // 3c) Any row-like container with product link + chips
        if (results.length === 0) {
          document.querySelectorAll('tr, [role="row"], [class*="card"], [class*="Card"]').forEach(row => {
            const nameEl = row.querySelector('a[href*="/product"], a[href*="/drink"], a[href*="edit"], a[href*="admin"]');
            const name = nameEl ? (nameEl.textContent || '').trim() : null;
            if (name) {
              const tags = [];
              row.querySelectorAll('[class*="Chip"], .MuiChip-root').forEach(chip => {
                const t = (chip.textContent || '').trim();
                if (t) tags.push(t);
              });
              if (name && !seenNames.has(name)) {
                seenNames.add(name);
                results.push({
                  id: (nameEl.getAttribute('href') || '').match(/\/(\d+)\/?$/)?.[1] || null,
                  name,
                  slug: null,
                  tags
                });
              }
            }
          });
        }

        // 3d) Broad fallback: any <a> with product/drink/edit in href, use text as name
        if (results.length === 0) {
          document.querySelectorAll('a[href*="product"], a[href*="drink"], a[href*="edit"]').forEach(link => {
            const name = (link.textContent || '').trim();
            if (!name || name.length > 200) return;
            const parent = link.closest('tr, [role="row"], [class*="row"], [class*="card"], [class*="item"]') || link.parentElement;
            const tags = [];
            if (parent) {
              parent.querySelectorAll('[class*="Chip"], .MuiChip-root, [class*="tag"]').forEach(el => {
                const t = (el.textContent || '').trim();
                if (t && t !== name && t.length < 80) tags.push(t);
              });
            }
            if (!seenNames.has(name)) {
              seenNames.add(name);
              results.push({
                id: (link.getAttribute('href') || '').match(/\/(\d+)\/?$/)?.[1] || null,
                name,
                slug: null,
                tags
              });
            }
          });
        }

        return results.length > 0 ? results : null;
      });

      // If we got very few from DOM, collect while scrolling (virtual/paginated table)
      if (!drinksData || drinksData.length < 100) {
        const merged = new Map(); // key by id or name
        const merge = (item) => {
          const key = item.id || item.name;
          if (!key) return;
          const existing = merged.get(key);
          if (!existing || (item.tags && item.tags.length > (existing.tags && existing.tags.length))) {
            merged.set(key, { id: item.id, name: item.name, slug: item.slug || null, tags: item.tags || [] });
          }
        };
        (drinksData || []).forEach(merge);
        const scrollAndCollect = () => page.evaluate(() => {
          const out = [];
          const seen = new Set();
          function add(id, name, tags) {
            const n = (name || '').trim();
            if (!n || seen.has(n)) return;
            seen.add(n);
            out.push({ id: id || null, name: n, slug: null, tags: Array.isArray(tags) ? tags : (tags ? [tags] : []) });
          }
          document.querySelectorAll('table tbody tr, [role="row"]').forEach(row => {
            const cells = row.querySelectorAll('td, [role="cell"]');
            let name = null, id = null, tagTexts = [];
            for (const cell of cells) {
              const link = cell.querySelector('a[href*="product"], a[href*="drink"], a[href*="edit"], a[href*="admin"]');
              if (link) { name = (link.textContent || '').trim(); const m = (link.getAttribute('href') || '').match(/\/(\d+)\/?$/); if (m) id = m[1]; }
              cell.querySelectorAll('[class*="Chip"], .MuiChip-root').forEach(chip => { const t = (chip.textContent || '').trim(); if (t && t.length < 80) tagTexts.push(t); });
            }
            if (name) add(id, name, tagTexts);
          });
          document.querySelectorAll('a[href*="product"], a[href*="drink"], a[href*="edit"]').forEach(link => {
            const name = (link.textContent || '').trim();
            if (!name || name.length > 200) return;
            const parent = link.closest('tr, [role="row"], [class*="row"], [class*="card"]') || link.parentElement;
            const tags = [];
            if (parent) parent.querySelectorAll('[class*="Chip"], .MuiChip-root').forEach(el => { const t = (el.textContent || '').trim(); if (t && t !== name) tags.push(t); });
            add((link.getAttribute('href') || '').match(/\/(\d+)\/?$/)?.[1] || null, name, tags);
          });
          return out;
        });
        console.log('📜 Collecting rows while scrolling (virtual/paginated table)...');
        for (let s = 0; s < 60; s++) {
          await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
            const t = document.querySelector('table [role="grid"], .MuiTableContainer-root, [class*="TableContainer"]');
            if (t) t.scrollTop = t.scrollHeight;
          });
          await new Promise(r => setTimeout(r, 500));
          const chunk = await scrollAndCollect();
          chunk.forEach(merge);
          if ((s + 1) % 15 === 0) console.log(`   Scrolled ${s + 1} times, collected ${merged.size} products so far...`);
          if (s > 10 && chunk.length === 0) break;
        }
        if (merged.size > 0) {
          drinksData = Array.from(merged.values());
          console.log(`✅ Collected ${drinksData.length} products from scroll.`);
        }
      }
    }

    // Build export data: use extracted drinks or empty array (always save a file for import script)
    let exportData = [];
    if (drinksData && Array.isArray(drinksData) && drinksData.length > 0) {
      const normalized = drinksData.map(d => {
        const name = d.name != null ? d.name : (d.title != null ? d.title : '');
        let tags = d.tags;
        if (!Array.isArray(tags)) tags = tags ? [].concat(tags) : [];
        tags = tags.map(t => typeof t === 'string' ? t : (t && t.name != null ? t.name : (t && t.label != null ? t.label : String(t)))).filter(Boolean);
        return { id: d.id ?? null, name: String(name).trim(), slug: d.slug ?? null, tags };
      }).filter(d => d.name);
      exportData = normalized.map(d => ({
        id: d.id,
        name: d.name,
        slug: d.slug || null,
        tags: d.tags || []
      }));
      console.log(`✅ Extracted ${exportData.length} drinks`);
      const withTags = exportData.filter(d => d.tags && d.tags.length > 0);
      console.log(`📋 ${withTags.length} drinks have tags`);
    } else {
      console.log('⚠️  No drink data extracted from API or DOM; saving empty list.');
      await page.screenshot({ path: path.join(__dirname, 'products-page.png'), fullPage: true }).catch(() => {});
      console.log('📸 Screenshot saved to products-page.png for inspection.');
    }

    const outputPath = path.join(__dirname, 'production-tags.json');
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    console.log(`\n✅ Saved ${exportData.length} drinks to: ${outputPath}`);
    if (exportData.length === 0) {
      console.log('   Run import after scraping with data, or add production-tags.json manually.');
    }
    return exportData;

  } catch (error) {
    console.error('❌ Error during scraping:', error.message);
    console.error(error.stack);
    
    if (browser && page) {
      try {
        await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
        console.log('📸 Error screenshot saved to error-screenshot.png');
      } catch (e) {
        // ignore
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the scraper
scrapeTags()
  .then(() => {
    console.log('\n✅ Scraping completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Scraping failed:', error);
    process.exit(1);
  });
