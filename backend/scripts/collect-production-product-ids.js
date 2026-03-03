/**
 * Log in to production admin, go to products list, scroll and collect all product IDs
 * from the page (or from API responses). Saves to production-product-ids.txt for use
 * by sync-all-tags-from-production-admin.js.
 *
 * Run: node scripts/collect-production-product-ids.js
 */

require('dotenv').config();
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const https = require('https');

const LOGIN_URL = 'https://www.dialadrinkkenya.com/admin/login';
const PRODUCTS_URL = 'https://www.dialadrinkkenya.com/admin/products';
const CREDENTIALS = { email: 'simonkimari@gmail.com', password: 'admin12345' };
const OUT_FILE = path.join(__dirname, 'production-product-ids.txt');

async function run() {
  const allIds = new Set();
  const chromePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser'
  ];
  let executablePath = null;
  for (const p of chromePaths) {
    try {
      if (require('fs').existsSync(p)) { executablePath = p; break; }
    } catch (e) {}
  }

  console.log('🚀 Collecting product IDs from production admin...\n');
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: executablePath || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  page.on('response', async (res) => {
    const url = res.url();
    if (!url.includes('/drinks') && !url.includes('/products')) return;
    try {
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data && (data.data || data.drinks || data.products));
      if (list && list.length > 0) {
        list.forEach(p => {
          const id = p.id || p._id;
          if (id) allIds.add(String(id));
        });
      }
    } catch (e) {}
  });

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

  console.log('📜 Loading products page...');
  await page.goto(PRODUCTS_URL, { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise(r => setTimeout(r, 5000));

  // Try in-page API fetch (token from localStorage)
  const fromApi = await page.evaluate(async () => {
    const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
    if (!token) return [];
    const base = window.location.origin;
    for (const limit of [5000, 2500, 1000]) {
      try {
        const res = await fetch(base + '/api/admin/drinks?limit=' + limit, {
          headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
        });
        if (!res.ok) continue;
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data && (data.data || data.drinks || data.products));
        if (list && list.length > 0) return list.map(p => String(p.id || p._id)).filter(Boolean);
      } catch (e) {}
    }
    return [];
  });
  fromApi.forEach(id => allIds.add(id));
  if (fromApi.length > 0) console.log(`   Got ${fromApi.length} IDs from API.\n`);

  // Try Node fetch with session cookies (same origin as page)
  if (allIds.size === 0) {
    const cookies = await page.cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const fetchIds = () => new Promise((resolve) => {
      const url = new URL('https://www.dialadrinkkenya.com/api/admin/drinks');
      url.searchParams.set('limit', '2500');
      const req = https.get(url.toString(), {
        headers: { 'Cookie': cookieHeader, 'Accept': 'application/json' }
      }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            const list = Array.isArray(data) ? data : (data && (data.data || data.drinks || data.products));
            if (list && list.length > 0) list.forEach(p => allIds.add(String(p.id || p._id)));
          } catch (e) {}
          resolve();
        });
      });
      req.on('error', () => resolve());
      req.setTimeout(15000, () => { req.destroy(); resolve(); });
    });
    await fetchIds();
    if (allIds.size > 0) console.log(`   Got ${allIds.size} IDs via cookie request.\n`);
  }

  let lastCount = 0;
  let noNewCount = 0;
  const maxScrolls = 250;
  for (let s = 0; s < maxScrolls; s++) {
    const idsFromDom = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('a[href*="products/"]').forEach(el => {
        const href = (el.getAttribute('href') || '').trim();
        const m = href.match(/\/products\/([a-f0-9]+)/i) || href.match(/\/products\/(\d+)/);
        if (m && m[1]) out.push(m[1]);
      });
      return out;
    });
    idsFromDom.forEach(id => allIds.add(id));

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
      const t = document.querySelector('.MuiTableContainer-root, [class*="TableContainer"], [role="grid"]');
      if (t) t.scrollTop = t.scrollHeight;
    });
    await new Promise(r => setTimeout(r, 600));

    if (allIds.size !== lastCount) {
      lastCount = allIds.size;
      noNewCount = 0;
      if (s % 5 === 0) console.log(`   Scroll ${s + 1}: ${allIds.size} product IDs so far...`);
    } else {
      noNewCount++;
      if (noNewCount >= 15) {
        console.log(`   No new IDs after 15 scrolls. Total: ${allIds.size}`);
        break;
      }
    }
  }

  const ids = [...allIds].sort();
  const content = '# Production product IDs – one per line.\n# Used by sync-all-tags-from-production-admin.js\n\n' + ids.join('\n') + '\n';
  fs.writeFileSync(OUT_FILE, content);
  console.log(`\n✅ Saved ${ids.length} product IDs to ${OUT_FILE}`);
  await browser.close();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
