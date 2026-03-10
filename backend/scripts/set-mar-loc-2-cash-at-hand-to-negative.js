#!/usr/bin/env node

/**
 * One-off: Set Mar Loc 2 actual cash at hand to -100.
 * The latest cash at hand transaction (driver submitted 100 when balance was 0)
 * should result in actual balance -100.
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

    const current = parseFloat(driver.cashAtHand || 0);
    const target = -100;

    console.log(`Driver: ${driver.name} (ID ${driver.id})`);
    console.log(`Current cashAtHand: ${current}`);
    console.log(`Setting cashAtHand to: ${target}`);

    await driver.update({ cashAtHand: target });
    console.log(`\n✅ Updated driver.cashAtHand: ${current} → ${target}`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
