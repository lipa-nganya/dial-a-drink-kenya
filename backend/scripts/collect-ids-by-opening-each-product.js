/**
 * Log in to production admin, go to products list, then open each product one by one
 * and extract the product ID from the URL of each product page.
 *
 * Strategy: Row-by-row with pagination. On each list page we click each row -> product page ->
 * read ID from URL -> goBack() to list (stays on same page). After processing all rows we
 * click "Next" to load the next page of rows, then repeat. This avoids relying on collecting
 * links (which only showed ~20 per page and Next wasn't loading more).
 *
 * Saves all IDs to production-product-ids.txt.
 *
 * Run: node scripts/collect-ids-by-opening-each-product.js [--limit N] [--delay MS]
 *   --limit N   stop after collecting N IDs (default: no limit)
 *   --delay MS  delay between each product (default 600)
 */

require('dotenv').config();
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const LOGIN_URL = 'https://www.dialadrinkkenya.com/admin/login';
const PRODUCTS_LIST_URL = 'https://www.dialadrinkkenya.com/admin/products';
const CREDENTIALS = { email: 'simonkimari@gmail.com', password: 'admin12345' };
const OUT_FILE = path.join(__dirname, 'production-product-ids.txt');

const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const delayIdx = args.indexOf('--delay');
const LIMIT = limitIdx >= 0 && args[limitIdx + 1] ? parseInt(args[limitIdx + 1], 10) : null;
const DELAY_MS = delayIdx >= 0 && args[delayIdx + 1] ? parseInt(args[delayIdx + 1], 10) : 600;

function extractIdFromUrl(url) {
  const m = (url || '').match(/\/products\/([a-f0-9]+)/i) || (url || '').match(/\/products\/(\d+)/);
  return m ? m[1] : null;
}

function saveProgress(allIds) {
  const content = '# Production product IDs – one per line.\n# Collected by opening each product and reading ID from URL.\n\n' + allIds.join('\n') + '\n';
  fs.writeFileSync(OUT_FILE, content);
}

async function run() {
  const allIds = [];
  const seen = new Set();

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  console.log('🚀 Open each product one by one, extract ID from URL (row-by-row + pagination)\n');
  console.log('📥 Logging in...');
  await page.goto(LOGIN_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.type('input[type="email"], input[name="email"]', CREDENTIALS.email, { delay: 50 });
  await page.type('input[type="password"]', CREDENTIALS.password, { delay: 50 });
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

  console.log('📜 Loading products list. Will click each row -> product page -> ID from URL -> Back, then Next page.\n');
  await page.goto(PRODUCTS_LIST_URL, { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise(r => setTimeout(r, 3000));

  let listPageNum = 0;
  let consecutiveEmptyPages = 0;

  while (true) {
    const rowCount = await page.evaluate(() => document.querySelectorAll('table tbody tr').length);
    if (rowCount === 0) {
      consecutiveEmptyPages++;
      if (consecutiveEmptyPages >= 2) {
        console.log('   No rows on this page, stopping.');
        break;
      }
    } else {
      consecutiveEmptyPages = 0;
    }

    for (let i = 0; i < rowCount; i++) {
      if (LIMIT && allIds.length >= LIMIT) break;

      try {
        const clicked = await page.evaluate((idx) => {
          const rows = document.querySelectorAll('table tbody tr');
          const row = rows[idx];
          if (!row) return false;
          const link = row.querySelector('a[href*="product"], a[href*="admin"]');
          const target = link || row.querySelector('td a') || row.querySelector('td') || row;
          target.click();
          return true;
        }, i);
        if (!clicked) continue;

        try {
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 25000 });
        } catch (_) {
          await new Promise(r => setTimeout(r, 2500));
        }

        const url = page.url();
        const id = extractIdFromUrl(url);
        if (id && !seen.has(id)) {
          seen.add(id);
          allIds.push(id);
          if (allIds.length <= 30 || allIds.length % 50 === 0) {
            console.log(`   [${allIds.length}] ${id}`);
          }
          if (allIds.length % 100 === 0) saveProgress(allIds);
        }

        const backOk = await page.goBack({ waitUntil: 'networkidle2', timeout: 25000 }).then(() => true).catch(() => false);
        if (!backOk) {
          await page.goto(PRODUCTS_LIST_URL, { waitUntil: 'networkidle2', timeout: 25000 });
          for (let n = 0; n < listPageNum; n++) {
            await new Promise(r => setTimeout(r, 800));
            const found = await page.evaluate(() => {
              const btn = document.querySelector('button[aria-label="Go to next page"], button[aria-label*="next" i]');
              if (btn && btn.getAttribute('aria-disabled') !== 'true') { btn.click(); return true; }
              return false;
            });
            if (!found) break;
          }
        }
      } catch (err) {
        console.warn(`   Row ${i + 1} error: ${err.message}`);
        try {
          if (!page.url().includes('/admin/products') || page.url().match(/\/admin\/products\/[a-f0-9]+/i)) {
            await page.goto(PRODUCTS_LIST_URL, { waitUntil: 'networkidle2', timeout: 25000 });
            for (let n = 0; n < listPageNum; n++) {
              await new Promise(r => setTimeout(r, 800));
              await page.evaluate(() => {
                const btn = document.querySelector('button[aria-label="Go to next page"], button[aria-label*="next" i]');
                if (btn && btn.getAttribute('aria-disabled') !== 'true') btn.click();
              });
            }
          }
        } catch (_) {}
      }
      await new Promise(r => setTimeout(r, DELAY_MS));
    }

    if (LIMIT && allIds.length >= LIMIT) break;

    saveProgress(allIds);

    const hasNext = await page.evaluate(() => {
      const byAria = document.querySelector('button[aria-label="Go to next page"], button[aria-label*="next" i], [aria-label*="Next page" i]');
      if (byAria && byAria.getAttribute('aria-disabled') !== 'true' && !byAria.disabled) {
        byAria.click();
        return true;
      }
      const buttons = document.querySelectorAll('button');
      for (const b of buttons) {
        if (b.getAttribute('aria-disabled') === 'true' || b.disabled) continue;
        if (/next|›|»/i.test((b.textContent || '').trim()) || (b.getAttribute('aria-label') || '').toLowerCase().includes('next')) {
          b.click();
          return true;
        }
      }
      return false;
    });

    if (!hasNext) {
      console.log('   No Next button (or disabled). Done.');
      break;
    }
    listPageNum++;
    console.log(`   --- List page ${listPageNum + 1} (${allIds.length} IDs so far) ---`);
    await new Promise(r => setTimeout(r, 2000));
  }

  saveProgress(allIds);
  console.log(`\n✅ Saved ${allIds.length} product IDs to ${OUT_FILE}`);
  await browser.close();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
