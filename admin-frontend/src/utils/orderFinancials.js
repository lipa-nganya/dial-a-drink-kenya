/**
 * Derives convenience / territory amounts from totals + line items when stored values are 0/null (legacy rows).
 * Aligns with backend `getOrderFinancialBreakdown` (residual = total - tip - items subtotal).
 */

function parseNum(value) {
  if (value === null || value === undefined || value === '') return NaN;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * @returns {{
 *   totalAmount: number,
 *   tipAmount: number,
 *   itemsSubtotal: number,
 *   convenienceFee: number,
 *   territoryDeliveryFee: number,
 *   orderValue: number
 * }}
 */
export function computeOrderDisplayAmounts(order) {
  const items = order.items || order.orderItems || [];
  const totalAmount = parseNum(order.totalAmount) || 0;
  const tipAmount = parseNum(order.tipAmount) || 0;

  const lineItemsSubtotal = items.reduce(
    (sum, it) => sum + (parseFloat(it.price || 0) * (parseInt(it.quantity, 10) || 0)),
    0
  );

  const storedItemsTotal = parseNum(order.itemsTotal);
  const itemsSubtotal =
    items.length > 0
      ? !Number.isFinite(storedItemsTotal) || storedItemsTotal === 0
        ? lineItemsSubtotal
        : storedItemsTotal
      : Number.isFinite(storedItemsTotal)
        ? storedItemsTotal
        : lineItemsSubtotal;

  const derivedConvenience = Math.max(0, totalAmount - tipAmount - itemsSubtotal);

  const parsedConv = parseNum(order.convenienceFee);
  const convenienceFee =
    Number.isFinite(parsedConv) && parsedConv > 0 ? parsedConv : derivedConvenience;

  const parsedTerr = parseNum(order.territoryDeliveryFee);
  const territoryFromTerritory =
    order.territory != null ? parseNum(order.territory.deliveryFromCBD) : NaN;

  let territoryDeliveryFee;
  if (Number.isFinite(parsedTerr) && parsedTerr > 0) {
    territoryDeliveryFee = parsedTerr;
  } else if (Number.isFinite(territoryFromTerritory) && territoryFromTerritory > 0) {
    territoryDeliveryFee = territoryFromTerritory;
  } else {
    territoryDeliveryFee = convenienceFee;
  }

  const orderValue = Math.max(0, totalAmount - tipAmount);

  return {
    totalAmount,
    tipAmount,
    itemsSubtotal,
    convenienceFee,
    territoryDeliveryFee,
    orderValue
  };
}

/** Used by sales / profit pages — same derivation, plus purchase cost and profit. */
export function orderFinancialsForReporting(order) {
  const items = order.items || order.orderItems || [];
  const amounts = computeOrderDisplayAmounts(order);
  let purchaseCost = 0;
  items.forEach((it) => {
    const pp =
      it.drink?.purchasePrice != null && it.drink.purchasePrice !== ''
        ? parseFloat(it.drink.purchasePrice)
        : null;
    if (pp != null && !Number.isNaN(pp) && pp >= 0) {
      purchaseCost += pp * (parseInt(it.quantity, 10) || 0);
    }
  });
  const profit = amounts.totalAmount - purchaseCost - amounts.territoryDeliveryFee;
  return {
    totalAmount: amounts.totalAmount,
    itemsTotal: amounts.itemsSubtotal,
    deliveryFee: amounts.territoryDeliveryFee,
    purchaseCost,
    profit,
    items
  };
}
