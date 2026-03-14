/**
 * Add adminId to cash_submissions for local DB (if missing).
 * Run: node backend/scripts/add-admin-id-cash-submissions-local.js
 * Uses DATABASE_URL from env or default local.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = require('../models');

async function main() {
  const dialect = db.sequelize.getDialect();
  if (dialect !== 'postgres') {
    console.log('This script is for PostgreSQL. Dialect:', dialect);
    await db.sequelize.close();
    process.exit(1);
  }

  try {
    await db.sequelize.authenticate();
    console.log('Database connected.\n');

    const [cols] = await db.sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'cash_submissions'
    `);
    const names = (cols || []).map((r) => r.column_name);
    const hasAdminId = names.includes('adminId');

    if (hasAdminId) {
      console.log('Column cash_submissions.adminId already exists. Nothing to do.');
      await db.sequelize.close();
      return;
    }

    console.log('Adding cash_submissions.adminId ...');
    await db.sequelize.query(`
      ALTER TABLE cash_submissions
      ADD COLUMN IF NOT EXISTS "adminId" INTEGER NULL
      REFERENCES admins(id) ON UPDATE CASCADE ON DELETE SET NULL
    `);
    await db.sequelize.query(`
      CREATE INDEX IF NOT EXISTS cash_submissions_admin_id_idx ON cash_submissions("adminId")
    `);

    console.log('Making driverId nullable (if not already) ...');
    try {
      await db.sequelize.query(`
        ALTER TABLE cash_submissions
        ALTER COLUMN "driverId" DROP NOT NULL
      `);
    } catch (e) {
      console.log('  (driverId already nullable or skip):', e.message);
    }

    console.log('\nDone. cash_submissions.adminId is in place.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await db.sequelize.close();
  }
}

main();
