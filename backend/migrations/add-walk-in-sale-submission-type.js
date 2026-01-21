'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add 'walk_in_sale' to the submissionType enum
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        ALTER TYPE "enum_cash_submissions_submissionType" ADD VALUE IF NOT EXISTS 'walk_in_sale';
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Note: PostgreSQL doesn't support removing enum values directly
    // This would require recreating the enum, which is complex
    // For now, we'll leave it as a no-op
    console.log('Note: Removing enum values requires recreating the enum type');
  }
};
