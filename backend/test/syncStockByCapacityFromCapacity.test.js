const test = require('node:test');
const assert = require('node:assert/strict');
const {
  syncStockByCapacityFromCapacity
} = require('../utils/syncStockByCapacityFromCapacity');

test('legacy drink with no stockByCapacity: single label gets aggregate stock', () => {
  const r = syncStockByCapacityFromCapacity({
    capacity: ['750ml'],
    capacityPricing: [{ capacity: '750ml', price: 100 }],
    stock: 10,
    stockByCapacity: null
  });
  assert.equal(r.stock, 10);
  assert.deepEqual(r.stockByCapacity, { '750ml': 10 });
  assert.equal(r.changed, true);
});

test('drink with per-capacity data: added capacity starts at 0', () => {
  const r = syncStockByCapacityFromCapacity({
    capacity: ['750ml', '1 Litre'],
    capacityPricing: [
      { capacity: '750ml', price: 100 },
      { capacity: '1 Litre', price: 150 }
    ],
    stock: 10,
    stockByCapacity: { '750ml': 10 }
  });
  assert.equal(r.stock, 10);
  assert.deepEqual(r.stockByCapacity, { '750ml': 10, '1 Litre': 0 });
  assert.equal(r.changed, true);
});

test('drink with per-capacity data: existing bucket unchanged', () => {
  const r = syncStockByCapacityFromCapacity({
    capacity: ['750ml'],
    capacityPricing: [{ capacity: '750ml', price: 100 }],
    stock: 10,
    stockByCapacity: { '750ml': 10 }
  });
  assert.equal(r.stock, 10);
  assert.deepEqual(r.stockByCapacity, { '750ml': 10 });
  assert.equal(r.changed, false);
});

test('single-SKU (no stockByCapacity): adding tier via PUT snapshot keeps old stock on old tier, 0 on new', () => {
  const prevPricing = [{ capacity: '750ml', currentPrice: 500 }];
  const nextPricing = [
    { capacity: '750ml', currentPrice: 500 },
    { capacity: '1 litre', currentPrice: 900 }
  ];
  const r = syncStockByCapacityFromCapacity(
    {
      capacity: ['750ml', '1 litre'],
      capacityPricing: nextPricing,
      stock: 6,
      stockByCapacity: null
    },
    {
      previousCapacity: ['750ml'],
      previousCapacityPricing: prevPricing
    }
  );
  assert.equal(r.stock, 6);
  assert.deepEqual(r.stockByCapacity, { '750ml': 6, '1 litre': 0 });
  assert.equal(r.changed, true);
});

test('single-SKU: stale capacity array lists new tier early; snapshot uses pricing only → new tier is 0', () => {
  const r = syncStockByCapacityFromCapacity(
    {
      capacity: ['750ml', '1 litre'],
      capacityPricing: [
        { capacity: '750ml', currentPrice: 500 },
        { capacity: '1 litre', currentPrice: 900 }
      ],
      stock: 6,
      stockByCapacity: null
    },
    {
      previousCapacity: ['750ml', '1 litre'],
      previousCapacityPricing: [{ capacity: '750ml', currentPrice: 500 }]
    }
  );
  assert.equal(r.stock, 6);
  assert.deepEqual(r.stockByCapacity, { '750ml': 6, '1 litre': 0 });
});

test('misleading previous snapshot but stockByCapacity already tracked → new bucket stays 0', () => {
  const r = syncStockByCapacityFromCapacity(
    {
      capacity: ['750ml', '1 litre'],
      capacityPricing: [
        { capacity: '750ml', currentPrice: 500 },
        { capacity: '1 litre', currentPrice: 900 }
      ],
      stock: 6,
      stockByCapacity: { '750ml': 6 }
    },
    {
      previousCapacity: ['750ml', '1 litre'],
      previousCapacityPricing: [
        { capacity: '750ml', currentPrice: 500 },
        { capacity: '1 litre', currentPrice: 900 }
      ]
    }
  );
  assert.equal(r.stock, 6);
  assert.deepEqual(r.stockByCapacity, { '750ml': 6, '1 litre': 0 });
});
