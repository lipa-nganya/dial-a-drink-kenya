'use strict';

/** @param {import('sequelize').QueryInterface} queryInterface */
module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      const [rows] = await queryInterface.sequelize.query(`
        SELECT t.typname AS enum_name
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname LIKE '%admin%role%' OR t.typname LIKE '%admins_role%'
        GROUP BY t.typname
        LIMIT 1;
      `);
      const enumTypeName = rows?.[0]?.enum_name;
      if (enumTypeName) {
        await queryInterface.sequelize.query(`
          DO $$ BEGIN
            ALTER TYPE "${enumTypeName}" ADD VALUE IF NOT EXISTS 'super_super_admin';
          EXCEPTION
            WHEN duplicate_object THEN NULL;
          END $$;
        `);
      }
    }

    await queryInterface.createTable('cash_at_hand_log_overrides', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      driverId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'drivers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      entryKey: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      debitAmount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true
      },
      creditAmount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true
      },
      balanceAfter: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true
      },
      updatedByAdminId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'admins', key: 'id' },
        onUpdate: 'SET NULL',
        onDelete: 'SET NULL'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('cash_at_hand_log_overrides', ['driverId', 'entryKey'], {
      unique: true,
      name: 'cash_at_hand_log_overrides_driver_entry_key'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('cash_at_hand_log_overrides');
  }
};
