module.exports = (sequelize, DataTypes) => {
  const AdminWallet = sequelize.define('AdminWallet', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    balance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    totalRevenue: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    totalOrders: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    cashAtHand: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      comment: 'Cash at hand amount for admin (calculated from cash orders - settlements - submissions)'
    }
  }, {
    tableName: 'admin_wallets',
    timestamps: true
  });

  return AdminWallet;
};

