/**
 * Capture tags from each product on production admin (dialadrinkkenya.com/admin)
 * and sync them to the equivalent product in the local dial-a-drink admin inventory.
 *
 * Flow:
 * 1. Log in to production admin
 * 2. Get list of all product edit URLs (from /admin/products or API)
 * 3. For each product page, extract tags (MuiChip-label in Tags section) and product name
 * 4. Match each to local drink by name/slug and update drink.tags in DB
 *
 * Usage:
 *   node scripts/sync-all-tags-from-production-admin.js           # all products (throttled)
 *   node scripts/sync-all-tags-from-production-admin.js --limit 10  # test with 10
 *   node scripts/sync-all-tags-from-production-admin.js --delay 2000 --limit 50
 *
 * Env: none required for production URL; local DB uses existing DATABASE_URL / config.
 */

require('dotenv').config();
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const db = require('../models');

const PRODUCTION_LOGIN = 'https://www.dialadrinkkenya.com/admin/login';
const PRODUCTION_PRODUCTS_LIST = 'https://www.dialadrinkkenya.com/admin/products';
const CREDENTIALS = { email: 'simonkimari@gmail.com', password: 'admin12345' };

const args = process.argv.slice(2);
const limitIndex = args.indexOf('--limit');
const delayIndex = args.indexOf('--delay');
const LIMIT = limitIndex >= 0 && args[limitIndex + 1] ? parseInt(args[limitIndex + 1], 10) : null;
const DELAY_MS = delayIndex >= 0 && args[delayIndex + 1] ? parseInt(args[delayIndex + 1], 10) : 1500;
const HEADLESS = args.includes('--headless');

function normalizeName(name) {
  if (name == null) return '';
  return String(name).trim().toLowerCase().replace(/\s+/g, ' ');
}

function findLocalDrink(prodItem, localDrinks) {
  const name = normalizeName(prodItem.name);
  if (!name) return null;
  let match = localDrinks.find(d => normalizeName(d.name) === name);
  if (match) return { drink: match, matchType: 'name' };
  if (prodItem.slug) {
    match = localDrinks.find(d => d.slug === prodItem.slug);
    if (match) return { drink: match, matchType: 'slug' };
  }
  return null;
}

async function updateLocalDrinkTags(drink, tagsArray) {
  const tags = Array.isArray(tagsArray) ? tagsArray.filter(t => t && String(t).trim()) : [];
  await drink.update({ tags });
  return { updated: true, count: tags.length };
}

async function updateLocalDrinkFromProduction(drink, { tags: tagsArray, pageTitle: pageTitleVal }) {
  const updates = {};
  if (tagsArray !== undefined) {
    updates.tags = Array.isArray(tagsArray) ? tagsArray.filter(t => t && String(t).trim()) : [];
  }
  if (pageTitleVal !== undefined && pageTitleVal !== null) {
    updates.pageTitle = String(pageTitleVal).trim() || null;
  }
  if (Object.keys(updates).length === 0) return { updated: false };
  await drink.update(updates);
  return { updated: true, ...updates };
}

/** Extract tags from product edit page. × is the delete icon per tag – we only want the tag label text. */
function getTagsExtractor() {
  return () => {
    const tags = [];
    // Strip delete icon: × (U+00D7), ✕, ⨯ at end/start (not the letter x)
    const stripX = (s) => (s || '')
      .trim()
      .replace(/[\s×✕⨯]+$/g, '')
      .replace(/^[\s×✕⨯]+/g, '')
      .replace(/\s*[×✕⨯]\s*/g, ' ')
      .trim();

    function getTagTextFromChip(chip) {
      const labelEl = chip.querySelector('.MuiChip-label, [class*="Chip-label"]');
      if (labelEl) {
        const t = stripX((labelEl.textContent || '').trim());
        if (t) return t;
      }
      const clone = chip.cloneNode(true);
      clone.querySelectorAll('svg, button, [aria-label*="Delete" i], [class*="deleteIcon"], [class*="delete-icon"], .MuiChip-deleteIcon').forEach(n => n.remove());
      return stripX((clone.textContent || '').trim());
    }

    // 1) Find the Tags section: label "Tags" then parent container
    const labels = document.querySelectorAll('label, [class*="label"], [class*="Label"]');
    let tagsContainer = null;
    for (const lab of labels) {
      if (/^tags?$/i.test((lab.textContent || '').trim())) {
        tagsContainer = lab.closest('div[class*="root"], form, section, fieldset, div[class*="Tags"]') || lab.parentElement;
        break;
      }
    }
    if (tagsContainer) {
      const chips = tagsContainer.querySelectorAll('.MuiChip-root, [class*="Chip-root"], [class*="MuiChip"]');
      chips.forEach(chip => {
        const t = getTagTextFromChip(chip);
        if (t && t.length < 120 && !/^(Cancel|Delete|Press Enter)/i.test(t)) tags.push(t);
      });
    }
    // 2) Fallback: chips near input "Press Enter or comma to add"
    if (tags.length === 0 && tagsContainer) {
      tagsContainer.querySelectorAll('.MuiChip-root, [class*="Chip-root"], [class*="MuiChip"], [role="button"]').forEach(chip => {
        if (chip.querySelector('input, [contenteditable]')) return;
        const t = getTagTextFromChip(chip);
        if (t && t.length < 120) tags.push(t);
      });
    }
    // 3) Any element in Tags area that has data-value / data-tag
    if (tags.length === 0 && tagsContainer) {
      tagsContainer.querySelectorAll('[data-value], [data-tag]').forEach(el => {
        const t = stripX((el.getAttribute('data-value') || el.getAttribute('data-tag') || '').trim());
        if (t && t.length < 120) tags.push(t);
      });
    }
    // 4) Tags container: elements whose text is exactly "tag×" (single chip, × at end) – strip ×
    if (tags.length === 0 && tagsContainer) {
      const walk = (node) => {
        if (node.nodeType !== 1) return;
        if (['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA'].includes(node.tagName)) return;
        const text = (node.textContent || '').trim();
        // Single tag: one × at end, no other × (avoids parent with "tag1× tag2×")
        if (text && text.length > 1 && text.length < 300 && /^[^×]*×\s*$/.test(text)) {
          const t = stripX(text);
          if (t && !/^(Cancel|Delete|Press Enter|Add|Tags)$/i.test(t) && !tags.includes(t)) tags.push(t);
          return;
        }
        for (let i = 0; i < node.children.length; i++) walk(node.children[i]);
      };
      walk(tagsContainer);
    }
    return tags;
  };
}

/** Extract product name from edit page (title, heading, or name field) */
function getProductNameExtractor() {
  return () => {
    const byInput = document.querySelector('input[name="name"], input[id*="name"], input[placeholder*="Name" i], input[placeholder*="Product" i]');
    if (byInput && (byInput.value || '').trim()) return byInput.value.trim();
    const byHeading = document.querySelector('h1, h2, [class*="productName"], [class*="product-name"], [class*="title"]');
    if (byHeading) {
      const t = (byHeading.textContent || '').trim();
      if (t && t.length < 200) return t;
    }
    const title = document.querySelector('title');
    if (title) {
      const t = (title.textContent || '').trim();
      const m = t.match(/^(.+?)\s*[-|–—]\s*Dial A Drink/i) || t.match(/^(.+?)\s*[-|]/);
      if (m && m[1]) return m[1].trim();
    }
    return '';
  };
}

/** Extract Page Title (SEO) from product edit page */
function getPageTitleExtractor() {
  return () => {
    const labels = document.querySelectorAll('label, [class*="label"], [class*="Label"], span');
    for (const lab of labels) {
      const text = (lab.textContent || '').trim();
      if (!/^page\s*title$/i.test(text)) continue;
      const container = lab.closest('div, form, fieldset, section') || lab.parentElement;
      if (!container) continue;
      const input = container.querySelector('input[type="text"], input:not([type="hidden"])');
      if (input && (input.value || '').trim()) return input.value.trim();
      const next = lab.nextElementSibling;
      if (next && (next.tagName === 'INPUT' || next.tagName === 'TEXTAREA') && (next.value || '').trim())
        return next.value.trim();
    }
    const byName = document.querySelector('input[name="pageTitle"], input[name="page_title"], input[id*="pageTitle" i], input[placeholder*="Page title" i]');
    if (byName && (byName.value || '').trim()) return byName.value.trim();
    return '';
  };
}

async function run() {
  console.log('🚀 Sync tags from production admin → local inventory\n');
  if (LIMIT) console.log(`   Limit: ${LIMIT} products (use without --limit for all)\n`);
  console.log(`   Delay between pages: ${DELAY_MS}ms\n`);

  const chromePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser'
  ];
  let executablePath = null;
  for (const p of chromePaths) {
    try {
      if (require('fs').existsSync(p)) { executablePath = p; break; }
    } catch (e) {}
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: HEADLESS,
      executablePath: executablePath || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Capture all product list batches from API (paginated responses)
    const capturedBatches = [];
    page.on('response', async (res) => {
      const url = res.url();
      if (!url.includes('/drinks') && !url.includes('/products')) return;
      if (url.includes('/login') || url.includes('/auth')) return;
      try {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data && (data.data || data.drinks || data.products));
        if (list && list.length > 0 && list[0] && (list[0].name != null || list[0].title != null)) {
          capturedBatches.push(list);
        }
      } catch (e) {}
    });

    // —— Login ——
    console.log('📥 Logging in to production admin...');
    await page.goto(PRODUCTION_LOGIN, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
    const emailSel = (await page.$('input[type="email"]')) ? 'input[type="email"]' : 'input[name="email"]';
    await page.type(emailSel, CREDENTIALS.email, { delay: 80 });
    await page.type('input[type="password"]', CREDENTIALS.password, { delay: 80 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button, input[type="submit"]')).find(b =>
        /sign\s*in|login/i.test((b.textContent || b.value || '').trim()) || b.type === 'submit'
      );
      if (btn) btn.click();
    });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    if (page.url().includes('/login')) {
      console.error('❌ Login failed.');
      await browser.close();
      process.exit(1);
    }
    console.log('✅ Logged in.\n');

    // —— Get product list: try API first, else scrape list page for links ——
    let productUrls = [];
    const tryApi = await page.evaluate(async () => {
      const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
      if (!token) return null;
      const base = window.location.origin;
      for (const q of ['?limit=2500', '?limit=5000', '']) {
        try {
          const url = base + '/api/admin/drinks' + q;
          const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
          if (!res.ok) continue;
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data && (data.data || data.drinks || data.products));
          if (list && list.length > 0 && list[0] && (list[0].name != null || list[0].title != null)) {
            return list.map(d => ({
              url: `${base}/admin/products/${d.id || d._id}`,
              name: d.name || d.title || '',
              slug: d.slug || null,
              tags: Array.isArray(d.tags) ? d.tags : (d.tags ? [d.tags] : [])
            }));
          }
        } catch (e) {}
      }
      return null;
    });

    if (tryApi && tryApi.length > 0) {
      console.log(`✅ Got ${tryApi.length} products from API.`);
      const withTags = tryApi.filter(p => p.tags && p.tags.length > 0);
      if (withTags.length > 0) {
        console.log(`   ${withTags.length} have tags in API; using API data (no page visits).\n`);
      } else {
        console.log(`   No tags in API response; will visit each product page to extract tags.\n`);
      }
      productUrls = tryApi.map(p => ({
        url: p.url,
        name: p.name,
        slug: p.slug || null,
        tags: Array.isArray(p.tags) ? p.tags : [],
        fromApi: !!(p.tags && p.tags.length > 0)
      }));
    }

    if (productUrls.length === 0) {
      console.log('📜 Loading products page to capture list (API or DOM links)...');
      await page.goto(PRODUCTION_PRODUCTS_LIST, { waitUntil: 'networkidle2', timeout: 45000 });
      await new Promise(r => setTimeout(r, 5000));
      // Scroll to trigger more API requests (paginated list)
      for (let s = 0; s < 100; s++) {
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
          const t = document.querySelector('.MuiTableContainer-root, [class*="TableContainer"], [role="grid"]');
          if (t) t.scrollTop = t.scrollHeight;
        });
        await new Promise(r => setTimeout(r, 400));
      }
      await new Promise(r => setTimeout(r, 2000));
      if (capturedBatches.length > 0) {
        const byId = new Map();
        capturedBatches.forEach(batch => {
          batch.forEach(p => {
            const id = p.id || p._id;
            if (id && !byId.has(id)) byId.set(id, p);
          });
        });
        const merged = Array.from(byId.values());
        const base = 'https://www.dialadrinkkenya.com';
        productUrls = merged.map(p => ({
          url: `${base}/admin/products/${p.id || p._id}`,
          name: p.name || p.title || '',
          slug: p.slug || null,
          tags: Array.isArray(p.tags) ? p.tags : (p.tags ? [p.tags] : []),
          fromApi: !!(p.tags && (Array.isArray(p.tags) ? p.tags.length > 0 : true))
        }));
        console.log(`   Captured ${productUrls.length} products from API (${capturedBatches.length} batches).\n`);
      }
      if (productUrls.length === 0) {
        // Collect IDs: scroll list and gather links (any <a> with product ID in href, or from rows)
        const idSet = new Set();
        const origin = 'https://www.dialadrinkkenya.com';
        for (let s = 0; s < 150; s++) {
          const batch = await page.evaluate(() => {
            const out = [];
            const add = (href) => {
              if (!href) return;
              const m = String(href).match(/\/products\/([a-f0-9]{20,})/i) || String(href).match(/\/products\/([a-f0-9]+)/i) || String(href).match(/\/products\/(\d+)/);
              if (m && m[1]) out.push(m[1]);
            };
            document.querySelectorAll('a[href*="product"]').forEach(el => add(el.getAttribute('href')));
            document.querySelectorAll('table tbody tr, [role="row"]').forEach(row => {
              const a = row.querySelector('a[href*="product"]');
              if (a) add(a.getAttribute('href'));
            });
            return out;
          });
          batch.forEach(id => idSet.add(id));
          await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
            const t = document.querySelector('.MuiTableContainer-root, [class*="TableContainer"], [role="grid"], table');
            if (t) t.scrollTop = t.scrollHeight;
          });
          await new Promise(r => setTimeout(r, 450));
          if (s % 20 === 0 && idSet.size > 0) console.log(`   Scroll ${s}: ${idSet.size} product IDs...`);
        }
        if (idSet.size > 0) {
          productUrls = Array.from(idSet).map(id => ({
            url: `${origin}/admin/products/${id}`,
            name: null,
            slug: null,
            tags: [],
            fromApi: false
          }));
          console.log(`   Collected ${productUrls.length} product IDs from list.\n`);
        }
      }
    }

    if (productUrls.length === 0) {
      // Fallback: try product list file or env
      const listPath = process.env.SYNC_PRODUCT_LIST_FILE || path.join(__dirname, 'production-product-ids.txt');
      if (fs.existsSync(listPath)) {
        const content = fs.readFileSync(listPath, 'utf8');
        const lines = content.split(/\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
        const base = 'https://www.dialadrinkkenya.com';
        productUrls = lines.map(line => {
          const id = line.replace(/.*\/products\/([a-f0-9]+).*$/i, '$1').replace(/^([a-f0-9]+).*$/i, '$1');
          return { url: `${base}/admin/products/${id}`, name: null, slug: null, tags: [], fromApi: false };
        }).filter(p => p.url.length > 40);
        console.log(`   Loaded ${productUrls.length} product URLs from ${listPath}\n`);
      }
    }
    if (productUrls.length === 0) {
      console.error('❌ No product URLs found. Add a file with one product ID or URL per line:');
      console.error('   backend/scripts/production-product-ids.txt');
      console.error('   Or set SYNC_PRODUCT_LIST_FILE=/path/to/file.txt');
      await browser.close();
      process.exit(1);
    }

    const toProcess = LIMIT ? productUrls.slice(0, LIMIT) : productUrls;
    const extractTags = getTagsExtractor();
    const extractName = getProductNameExtractor();
    const extractPageTitle = getPageTitleExtractor();
    const results = [];

    for (let i = 0; i < toProcess.length; i++) {
      const item = toProcess[i];
      if (item.fromApi && item.tags && item.tags.length > 0) {
        results.push({ name: item.name, slug: item.slug, tags: item.tags, pageTitle: item.pageTitle || '' });
        if ((i + 1) % 100 === 0) console.log(`   Processed ${i + 1}/${toProcess.length} (from API)`);
        continue;
      }
      const url = typeof item === 'string' ? item : item.url;
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
        const currentUrl = page.url();
        const idFromUrl = (currentUrl.match(/\/products\/([a-f0-9]+)/i) || currentUrl.match(/\/products\/(\d+)/) || [])[1];
        await new Promise(r => setTimeout(r, 800));
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, 500));
        const tags = await page.evaluate(extractTags);
        const name = await page.evaluate(extractName) || item.name || '';
        const pageTitle = await page.evaluate(extractPageTitle) || '';
        const finalName = name.trim() || item.name || '';
        results.push({ name: finalName, slug: item.slug || null, tags, pageTitle: (pageTitle || '').trim() });
        if (tags.length > 0 || pageTitle) {
          console.log(`   [${i + 1}/${toProcess.length}] id=${idFromUrl || '?'} ${(finalName || '').slice(0, 40)} → ${tags.length} tags${pageTitle ? ', pageTitle' : ''}`);
        } else if ((i + 1) % 50 === 0) {
          console.log(`   [${i + 1}/${toProcess.length}] id=${idFromUrl || '?'} … (0 tags)`);
        }
      } catch (e) {
        console.warn(`   [${i + 1}] Failed: ${url} - ${e.message}`);
        results.push({ name: item.name || '', slug: item.slug || null, tags: [], pageTitle: '' });
      }
      if (DELAY_MS > 0 && !(item.fromApi && item.tags?.length > 0)) {
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
    }

    await browser.close();

    // —— Sync to local DB ——
    console.log('\n📦 Loading local drinks...');
    const localDrinks = await db.Drink.findAll({ attributes: ['id', 'name', 'slug', 'tags', 'pageTitle'] });
    console.log(`   ${localDrinks.length} local drinks.\n🔄 Matching and updating tags + pageTitle...\n`);

    let matched = 0, updated = 0, notFound = 0, skipped = 0;
    for (const prod of results) {
      const tags = Array.isArray(prod.tags) ? prod.tags : [];
      const pageTitleVal = prod.pageTitle != null ? String(prod.pageTitle).trim() || null : null;
      const found = findLocalDrink(prod, localDrinks);
      if (!found) {
        if (prod.name) {
          notFound++;
          console.log(`   ⚠ No local match: "${(prod.name || '').slice(0, 60)}"`);
        }
        continue;
      }
      matched++;
      const { drink } = found;
      const hasTags = tags.length > 0;
      const hasPageTitle = pageTitleVal && pageTitleVal.length > 0;
      if (!hasTags && !hasPageTitle) {
        skipped++;
        continue;
      }
      const localTags = Array.isArray(drink.tags) ? drink.tags : [];
      const tagsUnchanged = JSON.stringify([...localTags].sort()) === JSON.stringify([...tags].sort());
      const pageTitleUnchanged = (drink.pageTitle || '') === (pageTitleVal || '');
      if (tagsUnchanged && pageTitleUnchanged) {
        skipped++;
        continue;
      }
      await updateLocalDrinkFromProduction(drink, { tags: hasTags ? tags : undefined, pageTitle: hasPageTitle ? pageTitleVal : undefined });
      updated++;
      const parts = [];
      if (hasTags) parts.push(`${tags.length} tags`);
      if (hasPageTitle) parts.push('pageTitle');
      console.log(`   ✅ ${drink.name} (${parts.join(', ')})`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 SUMMARY');
    console.log('='.repeat(50));
    console.log(`Production products processed: ${results.length}`);
    console.log(`Matched to local drink: ${matched}`);
    console.log(`Updated (tags and/or pageTitle): ${updated}`);
    console.log(`Skipped (unchanged): ${skipped}`);
    console.log(`Not found locally: ${notFound}`);
    console.log('='.repeat(50));
    console.log('\n✅ Done. Tags and Page Title are in the local DB; open Inventory → Edit Product to see them.');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    if (browser) await browser.close().catch(() => {});
    process.exit(1);
  }
}

run();
