module.exports = (sequelize, DataTypes) => {
  const DriverWallet = sequelize.define('DriverWallet', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    driverId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: 'drivers',
        key: 'id'
      }
    },
    balance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    totalTipsReceived: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    totalTipsCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    totalDeliveryPay: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    totalDeliveryPayCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    savings: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Driver-owned savings (withheld delivery fees). This is leverage, not revenue.'
    }
  }, {
    tableName: 'driver_wallets',
    timestamps: true
  });

  return DriverWallet;
};

