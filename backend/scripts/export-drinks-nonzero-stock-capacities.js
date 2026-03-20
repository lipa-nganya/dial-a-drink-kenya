/**
 * CSV export: drinks with non-zero aggregate stock + capacity / pricing info (for phase-2 stock fixes).
 *
 * Usage (from backend folder):
 *   node scripts/export-drinks-nonzero-stock-capacities.js
 *   node scripts/export-drinks-nonzero-stock-capacities.js --out ./inventory-nonzero-stock.csv
 *   node scripts/export-drinks-nonzero-stock-capacities.js --positive-only
 *
 * --positive-only   Only rows where stock > 0 (default includes stock < 0 as well)
 */
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const db = require('../models');

function parseArgs(argv) {
  const args = { out: null, positiveOnly: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--out' && argv[i + 1]) {
      args.out = argv[i + 1];
      i += 1;
    } else if (a === '--positive-only') {
      args.positiveOnly = true;
    }
  }
  return args;
}

function csvEscape(val) {
  const s = val == null ? '' : String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function normalizePricing(raw) {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [];
  return arr.filter(Boolean);
}

function uniqueCapacityLabels(drink) {
  const set = new Set();
  const cap = drink.capacity;
  if (Array.isArray(cap)) {
    cap.forEach((c) => {
      const t = String(c || '').trim();
      if (t) set.add(t);
    });
  }
  normalizePricing(drink.capacityPricing).forEach((row) => {
    const t = String(row.capacity ?? row.size ?? '').trim();
    if (t) set.add(t);
  });
  return Array.from(set);
}

function pricingDetail(drink) {
  return normalizePricing(drink.capacityPricing)
    .map((row) => {
      const label = String(row.capacity ?? row.size ?? '').trim() || '?';
      const p = row.currentPrice ?? row.price ?? row.originalPrice;
      const n = parseFloat(p);
      const price = Number.isFinite(n) ? n : '';
      return `${label}@${price}`;
    })
    .join(' | ');
}

function stockByCapacityJson(drink) {
  const sbc = drink.stockByCapacity;
  if (sbc == null) return '';
  if (typeof sbc === 'object') {
    try {
      return JSON.stringify(sbc);
    } catch {
      return String(sbc);
    }
  }
  return String(sbc);
}

function capacityFieldRaw(drink) {
  const cap = drink.capacity;
  if (cap == null) return '';
  if (Array.isArray(cap)) return cap.join(' | ');
  try {
    return JSON.stringify(cap);
  } catch {
    return String(cap);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const where = args.positiveOnly
    ? { stock: { [Op.gt]: 0 } }
    : { stock: { [Op.ne]: 0 } };

  const drinks = await db.Drink.findAll({
    where,
    attributes: [
      'id',
      'name',
      'slug',
      'barcode',
      'stock',
      'capacity',
      'capacityPricing',
      'stockByCapacity',
      'isAvailable'
    ],
    include: [
      { model: db.Category, as: 'category', attributes: ['id', 'name'] },
      { model: db.Brand, as: 'brand', attributes: ['id', 'name'] }
    ],
    order: [
      ['categoryId', 'ASC'],
      ['brandId', 'ASC'],
      ['name', 'ASC']
    ]
  });

  const headers = [
    'id',
    'name',
    'slug',
    'barcode',
    'category',
    'brand',
    'aggregate_stock',
    'is_available',
    'stock_by_capacity_json',
    'capacity_field',
    'capacity_labels',
    'capacity_pricing_detail'
  ];

  const lines = [headers.join(',')];

  for (const d of drinks) {
    const row = [
      d.id,
      csvEscape(d.name),
      csvEscape(d.slug),
      csvEscape(d.barcode),
      csvEscape(d.category?.name ?? ''),
      csvEscape(d.brand?.name ?? ''),
      d.stock,
      d.isAvailable === true ? 'true' : d.isAvailable === false ? 'false' : '',
      csvEscape(stockByCapacityJson(d)),
      csvEscape(capacityFieldRaw(d)),
      csvEscape(uniqueCapacityLabels(d).join(' | ')),
      csvEscape(pricingDetail(d))
    ];
    lines.push(row.join(','));
  }

  const csv = `${lines.join('\n')}\n`;
  const defaultName = `drinks-nonzero-stock-${new Date().toISOString().slice(0, 10)}.csv`;
  const outPath = args.out
    ? path.isAbsolute(args.out)
      ? args.out
      : path.join(process.cwd(), args.out)
    : path.join(process.cwd(), defaultName);

  fs.writeFileSync(outPath, csv, 'utf8');
  console.log(`Wrote ${drinks.length} rows to ${outPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
