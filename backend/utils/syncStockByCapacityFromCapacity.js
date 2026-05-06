/**
 * Ensures every capacity label (capacity column + capacityPricing rows, same as deriveCapacities)
 * has an entry in stockByCapacity.
 *
 * - If `stockByCapacity` **already has keys**, any capacity label without a matching bucket is treated as
 *   **new stock tracking** → **0** (do not pour aggregate `stock` into it). This fixes adds when `capacity`
 *   / `capacityPricing` on the row already listed the new tier or snapshot detection fails.
 * - If `stockByCapacity` is **empty**, admin PUT passes `previousCapacity` / `previousCapacityPricing`:
 *   tiers that existed before keep aggregate `stock`; tiers only added on this save start at **0**.
 * - Bulk / create with no snapshot and empty buckets: missing labels use aggregate `stock` (legacy).
 *
 * Aggregate `stock` is then set to the sum of all buckets (matches inventory usage elsewhere).
 */

const normalizeCapacityKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

const parseStockByCapacity = (value) => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return { ...value };
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? { ...parsed } : {};
    } catch {
      return {};
    }
  }
  return {};
};

/** Same label union as admin.js deriveCapacities */
const deriveCapacityLabels = (explicitCapacities, pricing) => {
  const set = new Set();
  const pricingRows = Array.isArray(pricing) ? pricing : [];

  if (Array.isArray(explicitCapacities)) {
    explicitCapacities.forEach((capacity) => {
      if (typeof capacity === 'string' && capacity.trim()) {
        set.add(capacity.trim());
      } else if (capacity !== undefined && capacity !== null) {
        const value = String(capacity).trim();
        if (value) set.add(value);
      }
    });
  }

  pricingRows.forEach((pricingRow) => {
    if (pricingRow && pricingRow.capacity) {
      set.add(String(pricingRow.capacity).trim());
    }
  });

  return Array.from(set);
};

const sumBuckets = (byCap) =>
  Object.values(byCap || {}).reduce((sum, v) => {
    const n = typeof v === 'number' ? v : parseInt(v, 10);
    return sum + (Number.isFinite(n) && !Number.isNaN(n) ? Math.max(0, n) : 0);
  }, 0);

/**
 * @param {object} drinkLike - capacity, capacityPricing, stock, stockByCapacity
 * @param {object} [options]
 * @param {unknown} [options.previousCapacity] - `capacity` before save (admin PUT only)
 * @param {unknown} [options.previousCapacityPricing] - `capacityPricing` before save (admin PUT only)
 * @returns {{ stockByCapacity: object, stock: number, changed: boolean }}
 */
function syncStockByCapacityFromCapacity(drinkLike, options = {}) {
  const labels = deriveCapacityLabels(drinkLike.capacity, drinkLike.capacityPricing);
  const baseStock = Math.max(0, parseInt(drinkLike.stock, 10) || 0);

  if (labels.length === 0) {
    return {
      stockByCapacity: drinkLike.stockByCapacity || null,
      stock: baseStock,
      changed: false
    };
  }

  const initialByCap = parseStockByCapacity(drinkLike.stockByCapacity);
  const hadPerCapacityData = Object.keys(initialByCap).length > 0;

  const usePreviousSnapshot =
    options &&
    (Object.prototype.hasOwnProperty.call(options, 'previousCapacity') ||
      Object.prototype.hasOwnProperty.call(options, 'previousCapacityPricing'));

  let previousNormalizedLabels = null;
  if (usePreviousSnapshot) {
    const pricingRows = Array.isArray(options.previousCapacityPricing)
      ? options.previousCapacityPricing
      : [];
    // Prefer tiers from saved pricing rows — `capacity` JSON often duplicates pricing or lists tiers early.
    const fromPricingOnly = deriveCapacityLabels([], pricingRows);
    const prevLabels =
      fromPricingOnly.length > 0
        ? fromPricingOnly
        : deriveCapacityLabels(options.previousCapacity, pricingRows);
    previousNormalizedLabels = new Set(prevLabels.map((l) => normalizeCapacityKey(l)));
  }

  const byCap = { ...initialByCap };

  const findKeyForLabel = (label) => {
    if (Object.prototype.hasOwnProperty.call(byCap, label)) return label;
    const nk = normalizeCapacityKey(label);
    return Object.keys(byCap).find((k) => normalizeCapacityKey(k) === nk) || null;
  };

  let touched = false;

  for (const label of labels) {
    const matchKey = findKeyForLabel(label);
    const keyToUse = matchKey || label;
    const rawVal = matchKey != null ? byCap[matchKey] : undefined;
    const n = typeof rawVal === 'number' ? rawVal : parseInt(rawVal, 10);
    const hasQuantity = Number.isFinite(n) && !Number.isNaN(n);

    if (!hasQuantity) {
      let fillValue;
      if (hadPerCapacityData) {
        // Already tracking per-capacity quantities: unknown bucket = newly sold format / new tier → 0.
        fillValue = 0;
      } else if (previousNormalizedLabels) {
        fillValue = previousNormalizedLabels.has(normalizeCapacityKey(label)) ? baseStock : 0;
      } else {
        fillValue = baseStock;
      }
      byCap[keyToUse] = fillValue;
      touched = true;
    }
  }

  const totalStock = sumBuckets(byCap);
  const prevStock = Math.max(0, parseInt(drinkLike.stock, 10) || 0);
  const changed = touched || totalStock !== prevStock;

  return {
    stockByCapacity: byCap,
    stock: totalStock,
    changed
  };
}

module.exports = {
  syncStockByCapacityFromCapacity,
  deriveCapacityLabels,
  parseStockByCapacity,
  normalizeCapacityKey
};
