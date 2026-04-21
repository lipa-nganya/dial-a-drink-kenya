/**
 * HTTP redirects for SEO and legacy storefront URLs (not JSON API clients).
 * Used by Netlify/nginx proxy: GET /api/http-redirect/products/:slug → 301 to /:categorySlug/:productSlug
 */
const express = require('express');
const router = express.Router();
const db = require('../models');
const { generateCategorySlugFromName } = require('../utils/slugGenerator');

router.get('/products/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    if (!slug || String(slug).includes('/')) {
      return res.status(400).send('Bad request');
    }

    const drink = await db.Drink.findOne({
      where: { slug, isPublished: true },
      include: [
        {
          model: db.Category,
          as: 'category',
          attributes: ['id', 'name'],
          required: false
        }
      ]
    });

    if (!drink || !drink.category?.name) {
      return res.status(404).send('Not found');
    }

    const categorySlug = generateCategorySlugFromName(drink.category.name);
    const productSlug = drink.slug || slug;

    const proto =
      req.get('x-forwarded-proto') || (req.secure ? 'https' : req.protocol) || 'https';
    const rawHost = req.get('x-forwarded-host') || req.get('host');
    const host = rawHost ? String(rawHost).split(',')[0].trim() : '';
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const path = `/${categorySlug}/${productSlug}${qs}`;

    const location =
      host && host.length > 0 && !/[\s\r\n]/.test(host)
        ? `${proto}://${host}${path}`
        : path;

    return res.redirect(301, location);
  } catch (err) {
    console.error('http-redirect /products:', err);
    if (!res.headersSent) {
      res.status(500).send('Server error');
    }
  }
});

module.exports = router;
