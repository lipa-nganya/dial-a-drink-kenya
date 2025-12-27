module.exports = (sequelize, DataTypes) => {
  const SupplierTransaction = sequelize.define('SupplierTransaction', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    supplierId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'suppliers',
        key: 'id'
      }
    },
    transactionType: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [['credit', 'debit']]
      },
      comment: 'credit = money owed to supplier (we owe them), debit = money paid to supplier (we paid them)'
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Reason for the credit or debit transaction'
    },
    reference: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Reference number or invoice number'
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'admins',
        key: 'id'
      },
      comment: 'Admin user who created this transaction'
    }
  }, {
    tableName: 'supplier_transactions',
    timestamps: true
  });

  return SupplierTransaction;
};

