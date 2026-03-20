/**
 * Lists drinks whose capacityPricing likely causes customer-site issues:
 *   - DUP_NORM: two rows with the same label after trim/lowercase/remove_spaces
 *   - SAME_VOLUME_SAME_PRICE: e.g. 750ml vs 0.75L vs "750 ml bottle" with the same selling price
 *   - MISSING_PRICE: a row has no usable currentPrice/price (or ≤ 0)
 *   - SAME_PRICE_MULTI: 2+ distinct (norm) labels sharing one price (review manually — may be OK)
 *
 * Usage (from backend folder):
 *   node scripts/list-products-capacity-pricing-issues.js
 *   node scripts/list-products-capacity-pricing-issues.js --csv
 *   node scripts/list-products-capacity-pricing-issues.js --multi-only
 *
 *   --multi-only   Print every drink with 2+ capacityPricing rows (for manual cleanup),
 *                  even if no heuristic matched. Does not print the heuristic section.
 */
/* eslint-disable no-console */

const db = require('../models');

function compactCapacityToken(raw) {
  try {
    return String(raw ?? '')
      .normalize('NFKC')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
  } catch {
    return String(raw ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
  }
}

function parseVolumeToMl(compact) {
  if (!compact) return null;
  const m = compact.match(
    /^(\d+(?:\.\d+)?)(ml|cl|litres|liters|litre|liter|ltr|lt|l)?$/
  );
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n) || n < 0) return null;
  let unit = m[2] || null;
  if (!unit) {
    if (!Number.isFinite(n)) return null;
    if (n % 1 !== 0) unit = 'l';
    else if (n >= 100) unit = 'ml';
    else if (Number.isInteger(n) && n >= 1 && n <= 9) unit = 'l';
    else return null;
  }
  let ml;
  if (
    unit === 'l' ||
    unit === 'ltr' ||
    unit === 'lt' ||
    unit === 'litre' ||
    unit === 'liter' ||
    unit === 'litres' ||
    unit === 'liters'
  ) {
    ml = n * 1000;
  } else if (unit === 'cl') {
    ml = n * 10;
  } else {
    ml = n;
  }
  return Math.round(ml * 100000) / 100000;
}

/** Stable ml bucket for "same bottle size" or null if not a parseable volume */
function volumeMlFromLabel(raw) {
  const c = compactCapacityToken(raw);
  if (!c) return null;
  let ml = parseVolumeToMl(c);
  if (ml != null) return ml;
  const frag = /(\d+(?:\.\d+)?)(ml|cl|litres|liters|litre|liter|ltr|lt|l)/g;
  let m;
  while ((m = frag.exec(c)) !== null) {
    ml = parseVolumeToMl(m[0]);
    if (ml != null) return ml;
  }
  return null;
}

function rowLabel(r) {
  const cap = r.capacity != null ? r.capacity : r.size;
  return cap == null ? '' : String(cap).trim();
}

function rowPrice(r) {
  const n = parseFloat(r.currentPrice ?? r.price);
  return Number.isFinite(n) ? n : NaN;
}

function analyzeDrink(drink) {
  const raw = drink.capacityPricing;
  let rows = [];
  if (Array.isArray(raw)) rows = raw;
  else if (typeof raw === 'string' && raw.trim()) {
    try {
      const p = JSON.parse(raw);
      rows = Array.isArray(p) ? p : [];
    } catch {
      rows = [];
    }
  }

  if (rows.length === 0) return null;

  const codes = new Set();
  const notes = [];

  const normCounts = new Map();
  const pricedRows = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const label = rowLabel(r);
    if (!label) {
      codes.add('EMPTY_LABEL');
      notes.push(`Row ${i + 1}: empty capacity/size`);
      continue;
    }

    const norm = compactCapacityToken(label);
    normCounts.set(norm, (normCounts.get(norm) || 0) + 1);

    const p = rowPrice(r);
    if (!Number.isFinite(p) || p <= 0) {
      codes.add('MISSING_PRICE');
      notes.push(`"${label}": missing or zero price`);
    } else {
      pricedRows.push({ label, norm, price: p, vol: volumeMlFromLabel(label) });
    }
  }

  for (const [norm, count] of normCounts) {
    if (count > 1) {
      codes.add('DUP_NORM');
      notes.push(`Same normalized label ×${count}: ${norm}`);
    }
  }

  const byVol = new Map();
  for (const pr of pricedRows) {
    if (pr.vol == null) continue;
    const k = `${pr.vol}:${pr.price}`;
    if (!byVol.has(k)) byVol.set(k, []);
    byVol.get(k).push(pr.label);
  }
  for (const [k, labels] of byVol) {
    if (labels.length > 1) {
      const uniq = [...new Set(labels.map((L) => compactCapacityToken(L)))];
      if (uniq.length > 1) {
        codes.add('SAME_VOLUME_SAME_PRICE');
        notes.push(
          `Same volume+price (${k}): ${labels.join(' | ')}`
        );
      }
    }
  }

  if (pricedRows.length >= 2) {
    const byNormPrice = new Map();
    for (const pr of pricedRows) {
      const key = `${pr.norm}@@${pr.price}`;
      byNormPrice.set(key, true);
    }
    const prices = [...new Set(pricedRows.map((p) => p.price))];
    if (prices.length === 1 && normCounts.size > 1) {
      codes.add('SAME_PRICE_MULTI');
      notes.push(
        `All ${pricedRows.length} priced rows share KES ${prices[0]} (different labels) — check for duplicates`
      );
    }
  }

  if (codes.size === 0) return null;

  return {
    id: drink.id,
    name: drink.name,
    slug: drink.slug || '',
    issues: [...codes].sort().join('+'),
    note: notes.join(' — ')
  };
}

function getPricingRows(drink) {
  const raw = drink.capacityPricing;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function main() {
  const asCsv = process.argv.includes('--csv');
  const multiOnly = process.argv.includes('--multi-only');

  const drinks = await db.Drink.findAll({
    attributes: ['id', 'name', 'slug', 'capacityPricing']
  });

  if (multiOnly) {
    const multi = [];
    for (const d of drinks) {
      const rows = getPricingRows(d);
      if (rows.length >= 2) {
        multi.push({
          id: d.id,
          name: d.name,
          slug: d.slug || '',
          rowCount: rows.length,
          summary: rows
            .map((r) => {
              const lab = rowLabel(r);
              const p = rowPrice(r);
              const pr = Number.isFinite(p) ? p : '?';
              return `${lab}→${pr}`;
            })
            .join(' | ')
        });
      }
    }
    multi.sort((a, b) => a.name.localeCompare(b.name));
    console.log(
      `Drinks with 2+ capacityPricing rows: ${multi.length} (manual review list)\n`
    );
    if (asCsv) {
      const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
      console.log('id,name,slug,row_count,capacity_summary');
      for (const r of multi) {
        console.log(
          [r.id, esc(r.name), esc(r.slug), r.rowCount, esc(r.summary)].join(',')
        );
      }
    } else {
      for (const r of multi) {
        console.log(
          `#${r.id}\t${r.rowCount} rows\t${r.slug || '(no slug)'}\t${r.name}`
        );
        console.log(`   ${r.summary}\n`);
      }
    }
    process.exit(0);
  }

  const flagged = [];
  for (const d of drinks) {
    const row = analyzeDrink(d);
    if (row) flagged.push(row);
  }

  flagged.sort((a, b) => {
    const ia = a.issues.localeCompare(b.issues);
    if (ia !== 0) return ia;
    return a.name.localeCompare(b.name);
  });

  console.log(
    `Scanned ${drinks.length} drinks, ${flagged.length} with heuristic flags.\n`
  );

  if (asCsv) {
    const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
    console.log('id,name,slug,issues,detail');
    for (const r of flagged) {
      console.log(
        [r.id, esc(r.name), esc(r.slug), r.issues, esc(r.note)].join(',')
      );
    }
  } else {
    for (const r of flagged) {
      console.log(
        `#${r.id}\t${r.issues}\t${r.slug || '(no slug)'}\t${r.name}`
      );
      console.log(`   ${r.note}\n`);
    }
  }

  const multiCount = drinks.filter((d) => getPricingRows(d).length >= 2).length;
  console.log(
    `\nTip: ${multiCount} drinks have 2+ capacity rows total. Full manual list:\n` +
      '  node scripts/list-products-capacity-pricing-issues.js --multi-only\n' +
      '  node scripts/list-products-capacity-pricing-issues.js --multi-only --csv\n'
  );

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
