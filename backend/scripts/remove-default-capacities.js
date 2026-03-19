#!/usr/bin/env node
/*
 * Remove placeholder "Default" capacities from drinks.
 *
 * Usage:
 *   cd backend
 *   node scripts/remove-default-capacities.js
 */

const db = require('../models');

const isDefaultCapacity = (value) =>
  typeof value === 'string' && value.trim().toLowerCase() === 'default';

async function run() {
  console.log('Starting default capacity cleanup...');

  const drinks = await db.Drink.findAll({
    attributes: ['id', 'name', 'capacity', 'capacityPricing']
  });

  let updatedCount = 0;

  for (const drink of drinks) {
    const currentCapacity = Array.isArray(drink.capacity) ? drink.capacity : [];
    const currentPricing = Array.isArray(drink.capacityPricing) ? drink.capacityPricing : [];

    const cleanCapacity = currentCapacity.filter((cap) => !isDefaultCapacity(cap));
    const cleanPricing = currentPricing.filter((entry) => {
      if (!entry) return false;
      return !isDefaultCapacity(entry.capacity);
    });

    const capacityChanged = JSON.stringify(cleanCapacity) !== JSON.stringify(currentCapacity);
    const pricingChanged = JSON.stringify(cleanPricing) !== JSON.stringify(currentPricing);

    if (!capacityChanged && !pricingChanged) {
      continue;
    }

    await drink.update({
      capacity: cleanCapacity,
      capacityPricing: cleanPricing
    });

    updatedCount += 1;
    console.log(`Updated drink #${drink.id}: ${drink.name}`);
  }

  console.log(`Cleanup complete. Updated ${updatedCount} drinks.`);
}

run()
  .catch((error) => {
    console.error('Default capacity cleanup failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await db.sequelize.close();
    } catch (_) {
      // ignore close errors
    }
  });

