#!/usr/bin/env node
'use strict';

// Load env (same order as server / run-asset-accounts-migration)
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { Sequelize } = require('sequelize');
const config = require('../config');
const { getDatabaseConfigName } = require('../utils/envDetection');

// Same list as add-asset-accounts-tables.js migration
const ASSET_ACCOUNTS = [
  { name: 'Co-operative bank', description: 'Co-operative bank' },
  { name: 'Credit Card', description: 'Credit card' },
  { name: 'Delivery Fee', description: 'Riders Delivery Fee' },
  { name: 'Equity Bank', description: 'Equity Bank' },
  { name: 'Kcb 2', description: 'Kcb Second account' },
  { name: 'KCB Bank', description: 'KCB BANK' },
  { name: 'MPESA', description: 'MPESA' },
  { name: 'On Account2', description: 'On account' },
  { name: 'Pesapal', description: 'pesapal' },
  { name: 'Petty Cash', description: 'Petty Cash' },
  { name: 'Petty cash OLD', description: 'Petty' },
  { name: 'Ruaka Petty Cash', description: 'Ruaka Petty Cash' },
  { name: 'Shop Till', description: 'Shop TILL' },
  { name: 'Suspense Account', description: 'reconciliation' },
  { name: 'Thika Road Petty Cash', description: 'thika road petty cash' },
  { name: 'TR Till', description: 'thika road till' },
  { name: 'Transaction charges', description: 'Charges' },
  { name: 'UBA BANK', description: 'UBA BANK' }
];

const env = getDatabaseConfigName();
const dbConfig = config[env];

let sequelize;
if (dbConfig.use_env_variable) {
  const databaseUrl = process.env[dbConfig.use_env_variable];
  if (!databaseUrl) {
    console.error('Missing', dbConfig.use_env_variable);
    process.exit(1);
  }
  sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    logging: false,
    ...(dbConfig.dialectOptions || {})
  });
} else {
  sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    { ...dbConfig, logging: false }
  );
}

async function run() {
  const queryInterface = sequelize.getQueryInterface();

  // Ensure table exists
  const [existsResult] = await queryInterface.sequelize.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'asset_accounts'
    ) AS table_exists;
  `);
  if (!existsResult[0]?.table_exists) {
    console.error('asset_accounts table does not exist. Run run-asset-accounts-migration.js first.');
    process.exit(1);
  }

  // Get existing names (case-sensitive match to match migration)
  const [existing] = await queryInterface.sequelize.query(
    `SELECT name FROM asset_accounts`
  );
  const existingNames = new Set((existing || []).map((r) => r.name));

  let inserted = 0;
  for (const row of ASSET_ACCOUNTS) {
    if (existingNames.has(row.name)) continue;
    await queryInterface.bulkInsert('asset_accounts', [{
      name: row.name,
      description: row.description || '',
      balance: 0,
      limit: 0,
      created_at: new Date(),
      updated_at: new Date()
    }]);
    existingNames.add(row.name);
    inserted++;
    console.log('  +', row.name);
  }

  if (inserted === 0) {
    console.log('No new asset accounts to add (all names already exist).');
  } else {
    console.log('Inserted', inserted, 'asset account(s) with balance=0, limit=0.');
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
