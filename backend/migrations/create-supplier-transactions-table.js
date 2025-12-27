'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create ENUM type for transaction_type
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE supplier_transaction_type_enum AS ENUM ('credit', 'debit');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create supplier_transactions table
    await queryInterface.createTable('supplier_transactions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      supplierId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'suppliers',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      transactionType: {
        type: Sequelize.ENUM('credit', 'debit'),
        allowNull: false,
        comment: 'credit = money owed to supplier (we owe them), debit = money paid to supplier (we paid them)'
      },
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        validate: {
          min: 0
        }
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Reason for the credit or debit transaction'
      },
      reference: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Reference number or invoice number'
      },
      createdBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'admins',
          key: 'id'
        },
        comment: 'Admin user who created this transaction'
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

    // Create indexes for better query performance
    await queryInterface.addIndex('supplier_transactions', ['supplierId']);
    await queryInterface.addIndex('supplier_transactions', ['createdAt']);
    await queryInterface.addIndex('supplier_transactions', ['transactionType']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('supplier_transactions');
    
    // Drop ENUM type
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS supplier_transaction_type_enum;
    `);
  }
};

