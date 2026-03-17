#!/usr/bin/env node
/**
 * Fix Pay Now cash-at-hand adjustment audit rows to store positive amounts.
 *
 * Background:
 * - The cash-at-hand balance change is applied to drivers.cashAtHand separately.
 * - These transactions are for audit/history display; the amount should be positive,
 *   and the UI/logging should treat it as a debit based on notes/type.
 *
 * What this does:
 * - Finds transactions where:
 *   - transactionType = 'cash_settlement'
 *   - notes contain 'Cash at hand − 50% delivery fee' OR legacy 'Pay Now: 50% delivery fee - cash at hand'
 *   - amount < 0
 * - Updates amount to ABS(amount)
 *
 * Usage:
 *   DRY_RUN=1 node scripts/fix-paynow-cash-settlement-signs.js        # preview
 *   node scripts/fix-paynow-cash-settlement-signs.js                 # apply
 *   node scripts/fix-paynow-cash-settlement-signs.js 472             # one order
 */

require('dotenv').config();
const db = require('../models');
const { Op } = require('sequelize');

async function main() {
  const dryRun = String(process.env.DRY_RUN || '') === '1';
  const orderIdArg = process.argv[2] ? parseInt(process.argv[2], 10) : null;

  const where = {
    transactionType: 'cash_settlement',
    amount: { [Op.lt]: 0 },
    [Op.or]: [
      { notes: { [Op.like]: '%Cash at hand − 50% delivery fee%' } },
      { notes: { [Op.like]: '%Pay Now: 50% delivery fee - cash at hand%' } }
    ]
  };
  if (orderIdArg) where.orderId = orderIdArg;

  const rows = await db.Transaction.findAll({
    where,
    order: [['createdAt', 'ASC']],
    attributes: ['id', 'orderId', 'driverId', 'amount', 'notes', 'createdAt']
  });

  console.log(`Found ${rows.length} Pay Now cash_settlement rows with negative amount${orderIdArg ? ` for order ${orderIdArg}` : ''}.`);
  if (rows.length === 0) return;

  for (const tx of rows) {
    const oldAmt = parseFloat(tx.amount || 0);
    const newAmt = Math.abs(oldAmt);
    console.log(`- tx #${tx.id} orderId=${tx.orderId} driverId=${tx.driverId} amount ${oldAmt} -> ${newAmt}`);
    if (!dryRun) {
      await tx.update({ amount: newAmt });
    }
  }

  console.log(dryRun ? 'DRY_RUN=1: no changes applied.' : 'Done: amounts updated.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

