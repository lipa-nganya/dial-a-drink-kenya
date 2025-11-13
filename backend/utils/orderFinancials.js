const db = require('../models');

const toNumber = (value) => {
  const num = parseFloat(value);
  if (Number.isNaN(num)) {
    return 0;
  }
  return num;
};

/**
 * Returns a financial breakdown for an order using persisted data.
 * Totals are rounded to two decimal places to avoid floating point drift.
 */
const getOrderFinancialBreakdown = async (orderId) => {
  const order = await db.Order.findByPk(orderId, {
    include: [{
      model: db.OrderItem,
      as: 'items'
    }]
  });

  if (!order) {
    throw new Error(`Order ${orderId} not found when calculating financial breakdown`);
  }

  const tipAmount = toNumber(order.tipAmount);
  const totalAmount = toNumber(order.totalAmount);

  const items = Array.isArray(order.items) ? order.items : [];
  const itemsTotalRaw = items.reduce((sum, item) => {
    const price = toNumber(item.price);
    const quantity = toNumber(item.quantity || 0);
    return sum + price * quantity;
  }, 0);

  const itemsTotal = Number(itemsTotalRaw.toFixed(2));
  const deliveryFeeRaw = totalAmount - tipAmount - itemsTotal;
  const deliveryFee = Number(Math.max(deliveryFeeRaw, 0).toFixed(2));

  return {
    itemsTotal,
    deliveryFee,
    tipAmount: Number(tipAmount.toFixed ? tipAmount.toFixed(2) : tipAmount),
    totalAmount,
    order
  };
};

module.exports = {
  getOrderFinancialBreakdown
};


