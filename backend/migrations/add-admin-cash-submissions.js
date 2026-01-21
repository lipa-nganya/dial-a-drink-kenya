'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Step 1: Add 'super_admin' to Admin role enum
    // First, create a new enum type with super_admin
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_admins_role_new" AS ENUM ('admin', 'manager', 'shop_agent', 'super_admin');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Step 2: Alter the column to use the new enum
    await queryInterface.sequelize.query(`
      ALTER TABLE "admins" 
      ALTER COLUMN "role" TYPE "enum_admins_role_new" 
      USING ("role"::text::"enum_admins_role_new");
    `);

    // Step 3: Drop the old enum and rename the new one
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_admins_role";
      ALTER TYPE "enum_admins_role_new" RENAME TO "enum_admins_role";
    `);

    // Step 4: Add adminId column to cash_submissions table
    await queryInterface.addColumn('cash_submissions', 'adminId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'admins',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Admin who created the submission (for admin cash submissions)'
    });

    // Step 5: Make driverId nullable (since admins can now create submissions)
    await queryInterface.changeColumn('cash_submissions', 'driverId', {
      type: Sequelize.INTEGER,
      allowNull: true, // Changed from false to true
      references: {
        model: 'drivers',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    // Step 6: Add constraint to ensure either driverId or adminId is set
    await queryInterface.sequelize.query(`
      ALTER TABLE "cash_submissions" 
      ADD CONSTRAINT "check_driver_or_admin" 
      CHECK (("driverId" IS NOT NULL) OR ("adminId" IS NOT NULL));
    `);

    // Step 7: Add index for adminId
    await queryInterface.addIndex('cash_submissions', ['adminId']);
  },

  async down(queryInterface, Sequelize) {
    // Remove constraint
    await queryInterface.sequelize.query(`
      ALTER TABLE "cash_submissions" 
      DROP CONSTRAINT IF EXISTS "check_driver_or_admin";
    `);

    // Remove adminId column
    await queryInterface.removeColumn('cash_submissions', 'adminId');

    // Make driverId non-nullable again
    await queryInterface.changeColumn('cash_submissions', 'driverId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'drivers',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    // Revert enum change (remove super_admin)
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_admins_role_old" AS ENUM ('admin', 'manager', 'shop_agent');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "admins" 
      ALTER COLUMN "role" TYPE "enum_admins_role_old" 
      USING (CASE WHEN "role"::text = 'super_admin' THEN 'admin'::text ELSE "role"::text END::"enum_admins_role_old");
    `);

    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_admins_role";
      ALTER TYPE "enum_admins_role_old" RENAME TO "enum_admins_role";
    `);
  }
};
