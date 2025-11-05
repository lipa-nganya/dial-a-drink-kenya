const db = require('../models');

function toBaseName(name) {
  if (!name) return name;
  // Normalize whitespace and case-insensitive 'puffs' variants in name
  let base = name
    .replace(/\((?:\s|\d|,|\.)*puffs?\)/gi, '') // remove '(8000 puffs)'
    .replace(/\b\d{3,5}\s*puffs?\b/gi, '')        // remove '8000 puffs'
    .replace(/\b\d{3,5}\b\s*(puffs?)?/gi, (m)=> /puffs?/i.test(m) ? '' : m) // lone numbers
    .replace(/\s{2,}/g, ' ')                         // collapse spaces
    .trim();
  return base;
}

function getCapacityLabel(drink) {
  // Prefer existing capacity value if singular
  if (Array.isArray(drink.capacity) && drink.capacity.length > 0) {
    return String(drink.capacity[0]).trim();
  }
  // Derive from name
  const m = (drink.name || '').match(/(\d{3,5})\s*puffs?/i);
  if (m) return `${m[1]} puffs`;
  return null;
}

async function run() {
  try {
    console.log('🔎 Looking for duplicates in Smokes...');

    const smokesCategory = await db.Category.findOne({ where: { name: 'Smokes' } });
    if (!smokesCategory) {
      console.log('❌ Category "Smokes" not found');
      process.exit(0);
    }

    const drinks = await db.Drink.findAll({ where: { categoryId: smokesCategory.id } });

    // Group by base name
    const groups = new Map();
    for (const d of drinks) {
      const base = toBaseName(d.name);
      if (!groups.has(base)) groups.set(base, []);
      groups.get(base).push(d);
    }

    let mergedGroups = 0;

    for (const [baseName, items] of groups.entries()) {
      if (items.length < 2) continue; // not duplicates

      // Build combined capacities and pricing map
      const capacityToPrice = new Map();
      for (const item of items) {
        // collect from capacityPricing if present
        if (Array.isArray(item.capacityPricing) && item.capacityPricing.length > 0) {
          for (const row of item.capacityPricing) {
            const cap = String(row.capacity).trim();
            if (!cap) continue;
            if (!capacityToPrice.has(cap)) {
              capacityToPrice.set(cap, {
                capacity: cap,
                originalPrice: Number(row.originalPrice) || Number(item.originalPrice) || Number(item.price) || 0,
                currentPrice: Number(row.currentPrice) || Number(item.price) || Number(item.originalPrice) || 0,
              });
            }
          }
        } else {
          const cap = getCapacityLabel(item);
          if (cap) {
            if (!capacityToPrice.has(cap)) {
              capacityToPrice.set(cap, {
                capacity: cap,
                originalPrice: Number(item.originalPrice) || Number(item.price) || 0,
                currentPrice: Number(item.price) || Number(item.originalPrice) || 0,
              });
            }
          }
        }
      }

      const mergedCapacityPricing = Array.from(capacityToPrice.values());
      if (mergedCapacityPricing.length === 0) continue; // nothing to merge

      const mergedCapacities = mergedCapacityPricing.map(r => r.capacity);

      // Choose keeper (lowest id)
      const keeper = items.slice().sort((a,b)=>a.id-b.id)[0];
      const toDelete = items.filter(i => i.id !== keeper.id);

      // Update keeper
      const newName = baseName; // ensure base name without puff counts
      const defaultPrice = mergedCapacityPricing[0]?.currentPrice || Number(keeper.price) || 0;
      const defaultOriginal = mergedCapacityPricing[0]?.originalPrice || Number(keeper.originalPrice) || defaultPrice;

      await keeper.update({
        name: newName,
        capacity: mergedCapacities,
        capacityPricing: mergedCapacityPricing,
        price: defaultPrice,
        originalPrice: defaultOriginal,
      });

      // Remove duplicates
      for (const dup of toDelete) {
        await dup.destroy();
      }

      mergedGroups++;
      console.log(`✅ Merged ${items.length} -> 1 for "${baseName}" (capacities: ${mergedCapacities.join(', ')})`);
    }

    console.log(`\n🎉 Completed. Groups merged: ${mergedGroups}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error merging smokes duplicates:', err);
    process.exit(1);
  }
}

run();
