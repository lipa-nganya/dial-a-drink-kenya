#!/usr/bin/env node
'use strict';

require('dotenv').config();
const { Sequelize } = require('sequelize');
const config = require('../config');
const { getDatabaseConfigName } = require('../utils/envDetection');

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
    logging: console.log,
    ...(dbConfig.dialectOptions || {})
  });
} else {
  sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    { ...dbConfig, logging: console.log }
  );
}

const migration = require('../migrations/add-asset-accounts-tables');
const queryInterface = sequelize.getQueryInterface();

migration
  .up(queryInterface, Sequelize)
  .then(() => {
    console.log('Migration completed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
