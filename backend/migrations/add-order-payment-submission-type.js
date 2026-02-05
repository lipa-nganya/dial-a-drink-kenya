'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        ALTER TYPE "enum_cash_submissions_submissionType" ADD VALUE IF NOT EXISTS 'order_payment';
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  },

  async down(queryInterface, Sequelize) {
    // PostgreSQL doesn't support removing enum values easily
    console.log('Note: Removing enum values requires recreating the enum type');
  }
};
