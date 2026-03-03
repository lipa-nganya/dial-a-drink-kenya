/**
 * Log into dialadrinkkenya.com/admin, open a product edit page, and extract tags at the end of the page.
 *
 * Usage:
 *   node scripts/check-product-tags.js
 *   node scripts/check-product-tags.js "https://www.dialadrinkkenya.com/admin/products/64460bba4383581efbbc3855"
 */

const puppeteer = require('puppeteer');

const LOGIN_URL = 'https://www.dialadrinkkenya.com/admin/login';
const CREDENTIALS = { email: 'simonkimari@gmail.com', password: 'admin12345' };
const DEFAULT_PRODUCT_URL = 'https://www.dialadrinkkenya.com/admin/products/64460bba4383581efbbc3855';

async function run() {
  const productUrl = process.argv[2] || DEFAULT_PRODUCT_URL;
  let browser;
  let page;

  try {
    console.log('🚀 Logging in and fetching product tags...\n');
    const chromePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser'
    ];
    let executablePath = null;
    for (const p of chromePaths) {
      try {
        const fs = require('fs');
        if (fs.existsSync(p)) { executablePath = p; break; }
      } catch (e) {}
    }

    browser = await puppeteer.launch({
      headless: false,
      executablePath: executablePath || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Login
    console.log('📥 Navigating to login...');
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle2', timeout: 30000 });
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
      console.error('❌ Login failed – still on login page.');
      await browser.close();
      process.exit(1);
    }
    console.log('✅ Logged in.\n');

    // Go to product page
    console.log(`📦 Opening product: ${productUrl}`);
    await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    // Scroll to bottom so tags section is in view
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 1500));

    // Extract tags: look for Tags section, chips, labels, or any tag-like content at end of page
    const result = await page.evaluate(() => {
      const out = { sections: [], chips: [], labels: [], rawText: [], tagSection: null, tagsFromInput: [] };

      // Find "Press Enter or comma to add" and get sibling/parent chip labels
      const tagInput = Array.from(document.querySelectorAll('input, [contenteditable="true"]')).find(el =>
        /press enter|comma to add|add tag/i.test((el.placeholder || el.getAttribute('aria-label') || ''))
      );
      if (tagInput) {
        const container = tagInput.closest('form, div[class*="root"], div[class*="Tags"], section') || tagInput.parentElement;
        if (container) {
          const chips = container.querySelectorAll('[class*="Chip"], .MuiChip-root, [role="button"]');
          chips.forEach(c => {
            const label = c.getAttribute('data-tag') || c.getAttribute('data-value') || c.textContent || '';
            const t = String(label).trim().replace(/^×\s*|×\s*$/g, '').trim();
            if (t && t.length < 100 && !/^(×|Cancel|Delete)$/i.test(t)) out.tagsFromInput.push(t);
          });
        }
      }

      // Section that might be titled "Tags"
      document.querySelectorAll('section, div[class*="section"], fieldset, [class*="Tags"], [class*="tags"]').forEach(el => {
        const heading = el.querySelector('h2, h3, h4, label, [class*="title"], [class*="label"]');
        const title = heading ? (heading.textContent || '').trim() : '';
        if (/tags?/i.test(title) || /tags?/i.test(el.className || '')) {
          const chips = el.querySelectorAll('[class*="Chip"], .MuiChip-root, [class*="chip"], span[class*="tag"]');
          const tagTexts = Array.from(chips).map(c => (c.textContent || '').trim()).filter(Boolean);
          if (tagTexts.length || (el.textContent || '').trim().length < 500) {
            out.tagSection = { title, tagTexts, fullText: (el.textContent || '').trim().slice(0, 500) };
          }
        }
      });

      // Chips in Tags section: × is the delete icon – get only the tag label text
      const stripX = (s) => (s || '').trim().replace(/^×+\s*|×+\s*$/g, '').replace(/\s*×+\s*/g, ' ').trim();
      document.querySelectorAll('.MuiChip-root, [class*="Chip-root"], [class*="MuiChip"]').forEach(chip => {
        const labelEl = chip.querySelector('.MuiChip-label, [class*="Chip-label"]');
        let t = labelEl ? (labelEl.textContent || '').trim() : '';
        if (!t) {
          const clone = chip.cloneNode(true);
          clone.querySelectorAll('svg, button, [aria-label*="Delete" i], [class*="deleteIcon"]').forEach(n => n.remove());
          t = (clone.textContent || '').trim();
        }
        t = stripX(t);
        if (t && t.length < 120 && t !== '×') out.chips.push(t);
      });

      // Labels containing "Tag"
      document.querySelectorAll('label, [class*="label"], [class*="Label"]').forEach(el => {
        const text = (el.textContent || '').trim();
        if (/tags?/i.test(text) && text.length < 200) out.labels.push(text);
      });

      // Last part of page text (often contains tags)
      const body = document.body;
      if (body) {
        const walk = (node, depth) => {
          if (depth > 15) return;
          if (node.nodeType === 1) {
            const tag = (node.tagName || '').toLowerCase();
            if (tag === 'script' || tag === 'style') return;
            if (node.children.length === 0 && node.textContent) {
              const t = (node.textContent || '').trim();
              if (t.length > 0 && t.length < 300) out.rawText.push(t);
            }
            for (let i = 0; i < node.children.length; i++) walk(node.children[i], depth + 1);
          }
        };
        walk(body, 0);
        // Keep last 30 text nodes (bottom of page)
        out.rawText = out.rawText.slice(-30);
      }

      return out;
    });

    console.log('\n📋 TAGS / PAGE END EXTRACTION\n' + '='.repeat(50));
    if (result.tagsFromInput && result.tagsFromInput.length) {
      console.log('Tags (near "Press Enter or comma to add"):', result.tagsFromInput);
    }
    if (result.tagSection) {
      console.log('Tag section found:', result.tagSection.title || '(no title)');
      if (result.tagSection.tagTexts && result.tagSection.tagTexts.length) {
        console.log('Tags (chips):', result.tagSection.tagTexts);
      }
      if (result.tagSection.fullText) {
        console.log('Section text (excerpt):', result.tagSection.fullText.slice(0, 400));
      }
    }
    if (result.chips.length) {
      const unique = [...new Set(result.chips)];
      console.log('\nAll chips on page:', unique);
    }
    if (result.labels.length) console.log('\nLabels (tag-related):', [...new Set(result.labels)]);
    if (result.rawText.length) {
      console.log('\nText near end of page (last nodes):');
      result.rawText.forEach((t, i) => console.log(`  ${i + 1}. ${t.slice(0, 120)}`));
    }

    // Screenshot for manual check
    const pathModule = require('path');
    const screenshotPath = pathModule.join(__dirname, 'product-page-tags-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('\n📸 Full page screenshot saved:', screenshotPath);

    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (browser) await browser.close();
    process.exit(1);
  }
}

run();
