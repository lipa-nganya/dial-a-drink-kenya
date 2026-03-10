module.exports = (sequelize, DataTypes) => {
  const AssetAccountTransaction = sequelize.define('AssetAccountTransaction', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    assetAccountId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'asset_accounts', key: 'id' },
      onDelete: 'CASCADE',
      comment: 'Asset account this transaction belongs to'
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      comment: 'Absolute amount'
    },
    reference: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Reference text'
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Optional description'
    },
    transactionDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: 'Date of the transaction'
    },
    transactionType: {
      type: DataTypes.ENUM('debit', 'credit'),
      allowNull: false,
      comment: 'Debit = increase asset, Credit = decrease asset'
    },
    debitAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0,
      comment: 'Debit amount for display (one of debit/credit is 0)'
    },
    creditAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0,
      comment: 'Credit amount for display'
    },
    postedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'admins', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Admin who posted the transaction'
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved'),
      allowNull: false,
      defaultValue: 'approved',
      comment: 'Transaction status'
    }
  }, {
    tableName: 'asset_account_transactions',
    timestamps: true,
    underscored: true
  });

  return AssetAccountTransaction;
};
