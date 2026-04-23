const express = require('express');
const router = express.Router();
const db = require('../models');
const { generateCategorySlugFromName, generateSlug } = require('../utils/slugGenerator');
const { normalizeSlug } = require('../utils/slugCanonical');

const CANONICAL_ORIGIN = 'https://dialadrinkkenya.com';

function xmlEscape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isoDate(value) {
  const d = value ? new Date(value) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function categorySeg(category) {
  if (!category) return '';
  return normalizeSlug(category.slug || generateCategorySlugFromName(category.name || ''));
}

function productSeg(drink) {
  if (!drink) return '';
  if (drink.slug && String(drink.slug).trim()) return normalizeSlug(drink.slug);
  const brandName = drink.brand && drink.brand.name ? drink.brand.name : null;
  let capacity = null;
  if (Array.isArray(drink.capacityPricing) && drink.capacityPricing.length > 0) {
    const caps = drink.capacityPricing
      .map((e) => (e && (e.capacity != null ? e.capacity : e.size)) || null)
      .filter(Boolean);
    if (caps.length > 0) {
      capacity = [...caps].sort((a, b) => String(b).length - String(a).length)[0];
    }
  } else if (Array.isArray(drink.capacity) && drink.capacity.length > 0) {
    capacity = [...drink.capacity].sort((a, b) => String(b).length - String(a).length)[0];
  } else if (drink.capacity) {
    capacity = drink.capacity;
  }
  return normalizeSlug(generateSlug(drink.name || `product-${drink.id}`, brandName, capacity));
}

router.get('/index.xml', async (req, res) => {
  try {
    const now = new Date().toISOString();
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${CANONICAL_ORIGIN}/sitemap-pages.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${CANONICAL_ORIGIN}/sitemap-products.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
</sitemapindex>`;

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=900');
    res.status(200).send(xml);
  } catch (error) {
    console.error('❌ Error generating sitemap index:', error);
    res.status(500).send('Failed to generate sitemap index');
  }
});

router.get('/pages.xml', async (req, res) => {
  try {
    const pages = [
      ['/', 'daily', '1.0'],
      ['/menu', 'daily', '0.9'],
      ['/offers', 'daily', '0.85'],
      ['/brands', 'weekly', '0.85'],
      ['/pricelist', 'weekly', '0.8'],
      ['/delivery-locations', 'monthly', '0.75'],
      ['/order-tracking', 'monthly', '0.7'],
      ['/privacy-policy', 'yearly', '0.5'],
      ['/terms-of-service', 'yearly', '0.5']
    ];

    const body = pages.map(([path, freq, prio]) => `  <url>
    <loc>${xmlEscape(`${CANONICAL_ORIGIN}${path}`)}</loc>
    <changefreq>${freq}</changefreq>
    <priority>${prio}</priority>
  </url>`).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.status(200).send(xml);
  } catch (error) {
    console.error('❌ Error generating pages sitemap:', error);
    res.status(500).send('Failed to generate pages sitemap');
  }
});

router.get('/products.xml', async (req, res) => {
  try {
    const drinks = await db.Drink.findAll({
      where: { isPublished: true },
      attributes: ['id', 'name', 'slug', 'updatedAt', 'capacity', 'capacityPricing'],
      include: [
        {
          model: db.Category,
          as: 'category',
          required: false,
          attributes: ['name', 'slug', 'isActive']
        },
        {
          model: db.Brand,
          as: 'brand',
          required: false,
          attributes: ['name']
        }
      ],
      order: [['updatedAt', 'DESC']]
    });

    const urls = [];
    for (const d of drinks) {
      if (!d || !d.category || d.category.isActive === false) continue;
      const c = categorySeg(d.category);
      const p = productSeg(d);
      if (!c || !p) continue;
      urls.push({
        loc: `${CANONICAL_ORIGIN}/${c}/${p}`,
        lastmod: isoDate(d.updatedAt)
      });
    }

    const body = urls.map((u) => `  <url>
    <loc>${xmlEscape(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=900');
    res.status(200).send(xml);
  } catch (error) {
    console.error('❌ Error generating products sitemap:', error);
    res.status(500).send('Failed to generate products sitemap');
  }
});

module.exports = router;
