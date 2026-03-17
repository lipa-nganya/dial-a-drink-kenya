#!/usr/bin/env node

/**
 * Cancel legacy Pay Now "cash at hand reduction" debit transactions.
 *
 * Background:
 * - Older code paths logged Pay Now cash-at-hand adjustments as `delivery_fee_debit`.
 * - New code logs these as `cash_settlement` credits.
 * - This script cancels the old debit rows (audit cleanup) without touching balances.
 *
 * Usage:
 *   node scripts/cancel-legacy-paynow-cash-at-hand-debits.js
 *   DRY_RUN=1 node scripts/cancel-legacy-paynow-cash-at-hand-debits.js
 */

require('dotenv').config({ path: '.env.local' });
const db = require('../models');
const { Op } = require('sequelize');

const isDryRun = String(process.env.DRY_RUN || '').trim() === '1';

(async () => {
  const t = await db.sequelize.transaction();
  try {
    const candidates = await db.Transaction.findAll({
      where: {
        transactionType: 'delivery_fee_debit',
        paymentProvider: { [Op.ne]: 'stop_deduction' },
        status: { [Op.ne]: 'cancelled' },
        notes: { [Op.like]: '%Pay Now:%cash at hand%reduction%' }
      },
      order: [['createdAt', 'ASC']],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    console.log(`Found ${candidates.length} legacy Pay Now debit transaction(s). DRY_RUN=${isDryRun}`);

    if (!isDryRun) {
      for (const tx of candidates) {
        await tx.update(
          {
            status: 'cancelled',
            paymentStatus: 'cancelled',
            notes: `${tx.notes || ''}\nCancelled: legacy Pay Now cash-at-hand debit replaced by cash_settlement.`.trim()
          },
          { transaction: t }
        );
      }
    }

    await t.commit();
    console.log(isDryRun ? 'Dry run complete (no changes made).' : 'Done. Legacy debits cancelled.');
  } catch (err) {
    await t.rollback();
    console.error('Failed:', err);
    process.exitCode = 1;
  } finally {
    await db.sequelize.close().catch(() => {});
  }
})();

