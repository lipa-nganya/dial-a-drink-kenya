'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Postgres: add new value to enum types used by orders.paymentMethod.
    // Different environments/schemas may have different enum type names.
    // This is idempotent using DO blocks.

    // Common/legacy name used in this project DB
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_type t WHERE t.typname = 'payment_method_enum'
        ) AND NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = 'payment_method_enum'
            AND e.enumlabel = 'cash_at_hand'
        ) THEN
          ALTER TYPE "payment_method_enum" ADD VALUE 'cash_at_hand';
        END IF;
      END$$;
    `);

    // Sequelize default naming (if the enum was created by Sequelize)
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = 'enum_orders_paymentMethod'
            AND e.enumlabel = 'cash_at_hand'
        ) THEN
          ALTER TYPE "enum_orders_paymentMethod" ADD VALUE 'cash_at_hand';
        END IF;
      END$$;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Enum value removal is not supported safely in Postgres without recreating the type.
    // No-op.
  }
};

