/**
 * HTTP redirects for SEO and legacy storefront URLs (not JSON API clients).
 * Proxied paths (nginx): /products/:slug → /api/http-redirect/products/:slug
 * Single-segment URLs /:slug → /api/http-redirect/segment/:slug (nginx)
 */
const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const db = require('../models');
const { generateCategorySlugFromName } = require('../utils/slugGenerator');
const { normalizeSlug } = require('../utils/slugCanonical');

const categoryInclude = {
  model: db.Category,
  as: 'category',
  attributes: ['id', 'name', 'slug'],
  required: true
};

/** SPA routes using a single path segment — do not 301 away from the frontend */
const RESERVED_SINGLE_SEGMENT = new Set([
  '', 'menu', 'cart', 'brands', 'offers', 'test-offers', 'profile', 'orders', 'login',
  'verify-email', 'suggest-drink', 'report-problem', 'privacy-policy', 'terms-of-service',
  'delivery-locations', 'pricelist', 'sitemap', 'admin', 'payment-success', 'order-success',
  'order-tracking', 'products', 'product', 'debug', 'static', 'api', 'checkout',
  '_next'
]);

function sanitizeLegacySlug(raw) {
  return String(raw || '')
    .replace(/[^a-z0-9-]/gi, '')
    .slice(0, 160);
}

function canonicalCategorySlug(category) {
  if (!category) return '';
  if (category.slug && String(category.slug).trim()) {
    return normalizeSlug(category.slug);
  }
  return generateCategorySlugFromName(category.name);
}

function canonicalDrinkSlug(drink) {
  const s = drink.slug || '';
  return normalizeSlug(s) || s || String(drink.id || '');
}

/**
 * @returns {Promise<import('sequelize').Model|null>}
 */
async function resolveDrinkForLegacyProductSlug(rawSlug) {
  const sanitized = sanitizeLegacySlug(rawSlug);
  const normalized = normalizeSlug(rawSlug);

  const findOne = (where) =>
    db.Drink.findOne({
      where: { isPublished: true, ...where },
      include: [categoryInclude]
    });

  if (sanitized) {
    let drink = await findOne({ slug: sanitized });
    if (drink) return drink;
    drink = await findOne({ slug: rawSlug });
    if (drink) return drink;
  }

  if (normalized) {
    const drink = await findOne({ slug: normalized });
    if (drink) return drink;
  }

  const slug = sanitized;
  if (!slug) return null;

  const prefixRows = await db.Drink.findAll({
    where: { isPublished: true, slug: { [Op.iLike]: `${slug}%` } },
    include: [categoryInclude],
    limit: 5
  });
  if (prefixRows.length === 1) return prefixRows[0];

  const subRows = await db.Drink.findAll({
    where: { isPublished: true, slug: { [Op.iLike]: `%${slug}%` } },
    include: [categoryInclude],
    limit: 25
  });
  if (subRows.length === 1) return subRows[0];

  return null;
}

function absoluteRedirectLocation(req, pathnameWithLeadingSlash) {
  const proto =
    req.get('x-forwarded-proto') || (req.secure ? 'https' : req.protocol) || 'https';
  const rawHost = req.get('x-forwarded-host') || req.get('host');
  const host = rawHost ? String(rawHost).split(',')[0].trim() : '';
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const path = `${pathnameWithLeadingSlash}${qs}`;

  if (host && host.length > 0 && !/[\s\r\n]/.test(host)) {
    return `${proto}://${host}${path}`;
  }
  return path;
}

router.get('/products/:slug', async (req, res) => {
  try {
    const slugParam = req.params.slug;
    if (!slugParam || String(slugParam).includes('/')) {
      return res.status(400).send('Bad request');
    }

    const drink = await resolveDrinkForLegacyProductSlug(slugParam);

    if (!drink || !drink.category?.name) {
      const legacy = sanitizeLegacySlug(slugParam);
      const menuPath = `/menu?search=${encodeURIComponent(legacy || slugParam)}`;
      return res.redirect(301, absoluteRedirectLocation(req, menuPath));
    }

    const categorySlugOut = canonicalCategorySlug(drink.category);
    const productSlugOut = canonicalDrinkSlug(drink);

    const canonicalPath = `/${categorySlugOut}/${productSlugOut}`;
    return res.redirect(301, absoluteRedirectLocation(req, canonicalPath));
  } catch (err) {
    console.error('http-redirect /products:', err);
    if (!res.headersSent) {
      res.status(500).send('Server error');
    }
  }
});

/**
 * Single-path segment (/bad-slug) mistaken for category in SPA — 301 to canonical product URL when unique.
 */
router.get('/segment/:segment', async (req, res) => {
  try {
    const raw = req.params.segment;
    if (!raw || String(raw).includes('/') || String(raw).includes('.')) {
      return res.status(404).send('Not a legacy segment');
    }

    const lower = raw.toLowerCase();
    if (RESERVED_SINGLE_SEGMENT.has(lower)) {
      return res.status(404).send('SPA route');
    }

    const normalizedSeg = normalizeSlug(raw);
    if (!normalizedSeg) {
      return res.status(404).send('Empty segment');
    }

    const categories = await db.Category.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'slug']
    });

    for (const c of categories) {
      const cs = c.slug ? normalizeSlug(c.slug) : normalizeSlug(generateCategorySlugFromName(c.name));
      const csName = normalizeSlug(generateCategorySlugFromName(c.name));
      if (normalizedSeg === cs || normalizedSeg === csName || raw === c.slug) {
        return res.status(404).send('Category menu');
      }
    }

    const orClauses = [{ slug: raw }];
    if (normalizedSeg !== raw) {
      orClauses.push({ slug: normalizedSeg });
    }

    const drink = await db.Drink.findOne({
      where: {
        isPublished: true,
        [Op.or]: orClauses
      },
      include: [categoryInclude]
    });

    if (!drink || !drink.category?.name) {
      const fuzzy = await resolveDrinkForLegacyProductSlug(raw);
      if (!fuzzy || !fuzzy.category?.name) {
        return res.status(404).send('No product match');
      }
      const catOut = canonicalCategorySlug(fuzzy.category);
      const prodOut = canonicalDrinkSlug(fuzzy);
      return res.redirect(301, absoluteRedirectLocation(req, `/${catOut}/${prodOut}`));
    }

    const catOut = canonicalCategorySlug(drink.category);
    const prodOut = canonicalDrinkSlug(drink);
    return res.redirect(301, absoluteRedirectLocation(req, `/${catOut}/${prodOut}`));
  } catch (err) {
    console.error('http-redirect /segment:', err);
    if (!res.headersSent) {
      res.status(500).send('Server error');
    }
  }
});

module.exports = router;
