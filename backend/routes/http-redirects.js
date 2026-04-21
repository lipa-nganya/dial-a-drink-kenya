/**
 * HTTP redirects for SEO and legacy storefront URLs (not JSON API clients).
 * Used by Netlify/nginx proxy: GET /api/http-redirect/products/:slug → 301 to /:categorySlug/:productSlug
 *
 * Google often indexes short paths like /products/velo-max-free while the DB slug is longer
 * (e.g. …velo-max-freeze…). We resolve exact slug first, then unique prefix/substring matches only.
 */
const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const db = require('../models');
const { generateCategorySlugFromName } = require('../utils/slugGenerator');

const categoryInclude = {
  model: db.Category,
  as: 'category',
  attributes: ['id', 'name'],
  required: true
};

function sanitizeLegacySlug(raw) {
  return String(raw || '')
    .replace(/[^a-z0-9-]/gi, '')
    .slice(0, 160);
}

/**
 * @returns {Promise<import('sequelize').Model|null>}
 */
async function resolveDrinkForLegacyProductSlug(rawSlug) {
  const slug = sanitizeLegacySlug(rawSlug);
  if (!slug) return null;

  const findOne = (where) =>
    db.Drink.findOne({
      where: { isPublished: true, ...where },
      include: [categoryInclude]
    });

  let drink = await findOne({ slug });
  if (drink) return drink;

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

    const categorySlug = generateCategorySlugFromName(drink.category.name);
    const productSlug = drink.slug || sanitizeLegacySlug(slugParam);

    const canonicalPath = `/${categorySlug}/${productSlug}`;
    return res.redirect(301, absoluteRedirectLocation(req, canonicalPath));
  } catch (err) {
    console.error('http-redirect /products:', err);
    if (!res.headersSent) {
      res.status(500).send('Server error');
    }
  }
});

module.exports = router;
