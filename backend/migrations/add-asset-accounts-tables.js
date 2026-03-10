'use strict';

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

module.exports = {
  async up(queryInterface, Sequelize) {
    const [results] = await queryInterface.sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'asset_accounts'
      ) as table_exists;
    `);
    if (results[0]?.table_exists) {
      console.log('⚠️  asset_accounts already exists, skipping');
      return;
    }

    await queryInterface.createTable('asset_accounts', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.STRING,
        allowNull: true
      },
      balance: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      limit: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.createTable('asset_account_transactions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      asset_account_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'asset_accounts', key: 'id' },
        onDelete: 'CASCADE'
      },
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      reference: {
        type: Sequelize.STRING,
        allowNull: true
      },
      description: {
        type: Sequelize.STRING,
        allowNull: true
      },
      transaction_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      transaction_type: {
        type: Sequelize.ENUM('debit', 'credit'),
        allowNull: false
      },
      debit_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0
      },
      credit_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0
      },
      posted_by_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'admins', key: 'id' },
        onDelete: 'SET NULL'
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved'),
        allowNull: false,
        defaultValue: 'approved'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('asset_account_transactions', ['asset_account_id']);
    await queryInterface.addIndex('asset_account_transactions', ['transaction_date']);
    await queryInterface.addIndex('asset_account_transactions', ['status']);

    for (const row of ASSET_ACCOUNTS) {
      await queryInterface.bulkInsert('asset_accounts', [{
        name: row.name,
        description: row.description || '',
        balance: 0,
        limit: 0,
        created_at: new Date(),
        updated_at: new Date()
      }]);
    }
    console.log('✅ asset_accounts and asset_account_transactions created and seeded');
  },

  async down(queryInterface) {
    await queryInterface.dropTable('asset_account_transactions');
    await queryInterface.dropTable('asset_accounts');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_asset_account_transactions_transaction_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_asset_account_transactions_status";');
  }
};
