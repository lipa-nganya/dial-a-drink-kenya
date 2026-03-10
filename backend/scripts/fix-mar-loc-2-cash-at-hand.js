#!/usr/bin/env node

/**
 * One-off: Fix Mar Loc 2 cash at hand.
 * The old code deducted pending submissions from driver.cashAtHand on create.
 * This adds back the sum of pending submission amounts so actual = 0, pending = -100.
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const db = require('../models');
const { Op } = require('sequelize');

async function run() {
  try {
    const driver = await db.Driver.findOne({
      where: { name: { [Op.iLike]: '%Mar Loc 2%' } }
    });
    if (!driver) {
      console.error('Driver "Mar Loc 2" not found');
      process.exit(1);
    }

    const pending = await db.CashSubmission.findAll({
      where: { driverId: driver.id, status: 'pending' },
      attributes: ['id', 'amount']
    });
    const pendingTotal = pending.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);

    const current = parseFloat(driver.cashAtHand || 0);
    const corrected = current + pendingTotal;

    console.log(`Driver: ${driver.name} (ID ${driver.id})`);
    console.log(`Current cashAtHand: ${current}`);
    console.log(`Pending submissions: ${pending.length}, total: ${pendingTotal}`);
    console.log(`Corrected cashAtHand: ${corrected}`);

    await driver.update({ cashAtHand: corrected });
    console.log(`\n✅ Updated driver.cashAtHand: ${current} → ${corrected}`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
