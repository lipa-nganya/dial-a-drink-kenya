module.exports = (sequelize, DataTypes) => {
  const Transaction = sequelize.define('Transaction', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Allow null for withdrawals (no order associated)
      references: {
        model: 'orders',
        key: 'id'
      }
    },
    driverId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'drivers',
        key: 'id'
      }
    },
    driverWalletId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'driver_wallets',
        key: 'id'
      }
    },
    transactionType: {
      type: DataTypes.ENUM('payment', 'refund', 'tip', 'withdrawal', 'delivery_pay', 'driver_pay', 'delivery_fee_debit', 'cash_settlement'),
      defaultValue: 'payment'
    },
    paymentMethod: {
      type: DataTypes.ENUM('card', 'mobile_money', 'cash', 'system'),
      allowNull: false
    },
    paymentProvider: {
      type: DataTypes.STRING, // e.g., 'mpesa', 'visa', 'mastercard'
      allowNull: true
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled'),
      defaultValue: 'pending'
    },
    paymentStatus: {
      type: DataTypes.ENUM('pending', 'paid', 'failed', 'cancelled', 'unpaid'),
      defaultValue: 'pending'
    },
    receiptNumber: {
      type: DataTypes.STRING,
      allowNull: true
    },
    checkoutRequestID: {
      type: DataTypes.STRING,
      allowNull: true
    },
    merchantRequestID: {
      type: DataTypes.STRING,
      allowNull: true
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: true
    },
    transactionDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'transactions',
    timestamps: true
  });

  return Transaction;
};

