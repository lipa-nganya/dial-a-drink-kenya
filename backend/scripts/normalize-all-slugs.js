#!/usr/bin/env node
/**
 * One-time (or repeatable) normalization of category + drink slug columns.
 * Uses the same rules as backend/utils/slugCanonical.js + uniqueness helpers.
 *
 * Usage (from repo root):
 *   cd backend && DATABASE_URL="postgresql://..." node scripts/normalize-all-slugs.js
 *
 * Dry run (no writes):
 *   DRY_RUN=1 DATABASE_URL="..." node scripts/normalize-all-slugs.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const db = require('../models');
const { normalizeSlug } = require('../utils/slugCanonical');
const { generateCategorySlugFromName, generateSlug } = require('../utils/slugGenerator');

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

async function desiredCategorySlug(cat) {
  const raw = cat.slug || generateCategorySlugFromName(cat.name);
  let base = normalizeSlug(raw);
  if (!base) base = `category-${cat.id}`;
  return base;
}

async function resolveUniqueCategorySlugs(categories) {
  const targets = new Map();
  const used = new Set();

  for (const cat of categories) {
    let base = await desiredCategorySlug(cat);
    let candidate = base;
    let n = 2;
    while (used.has(candidate)) {
      candidate = `${base}-${n}`;
      n += 1;
    }
    used.add(candidate);
    targets.set(cat.id, candidate);
  }

  return targets;
}

async function applyCategories(categories, idToSlug) {
  for (const cat of categories) {
    const next = idToSlug.get(cat.id);
    if (!next || cat.slug === next) continue;
    console.log(`Category ${cat.id} "${cat.name}": "${cat.slug}" → "${next}"`);
    if (!DRY_RUN) {
      await db.Category.update({ slug: next }, { where: { id: cat.id } });
    }
  }
}

function desiredDrinkSlug(drink) {
  let base = normalizeSlug(drink.slug || '');
  if (base) return base;
  const brandName = drink.brand?.name || drink.brandName || null;
  let cap = drink.capacity || null;
  if (!cap && drink.capacityPricing && drink.capacityPricing[0]) {
    cap = drink.capacityPricing[0].capacity || drink.capacityPricing[0].size;
  }
  base = normalizeSlug(generateSlug(drink.name, brandName, cap));
  if (!base) base = `product-${drink.id}`;
  return base;
}

async function resolveUniqueDrinkSlugs(drinks) {
  const targets = new Map();
  const used = new Set();

  for (const d of drinks) {
    let base = desiredDrinkSlug(d);
    let candidate = base;
    let n = 2;
    while (used.has(candidate)) {
      candidate = `${base}-${n}`;
      n += 1;
    }
    used.add(candidate);
    targets.set(d.id, candidate);
  }

  return targets;
}

async function applyDrinks(drinks, idToSlug) {
  for (const d of drinks) {
    const next = idToSlug.get(d.id);
    if (!next || d.slug === next) continue;
    console.log(`Drink ${d.id} "${d.name}": "${d.slug}" → "${next}"`);
    if (!DRY_RUN) {
      await db.Drink.update({ slug: next }, { where: { id: d.id } });
    }
  }
}

async function main() {
  await db.sequelize.authenticate();
  console.log(DRY_RUN ? '🔎 DRY RUN — no updates' : '📝 Applying slug updates');

  const categories = await db.Category.findAll({ order: [['id', 'ASC']] });
  const catMap = await resolveUniqueCategorySlugs(categories);
  await applyCategories(categories, catMap);

  const drinks = await db.Drink.findAll({
    order: [['id', 'ASC']],
    include: [
      { model: db.Category, as: 'category', required: false },
      { model: db.Brand, as: 'brand', required: false }
    ]
  });

  const drinkTargets = await resolveUniqueDrinkSlugs(drinks);
  await applyDrinks(drinks, drinkTargets);

  console.log('✅ Done.');
  await db.sequelize.close();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
