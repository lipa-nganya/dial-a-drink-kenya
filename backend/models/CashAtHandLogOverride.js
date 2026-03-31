module.exports = (sequelize, DataTypes) => {
  const CashAtHandLogOverride = sequelize.define(
    'CashAtHandLogOverride',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      driverId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      entryKey: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      debitAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true
      },
      creditAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true
      },
      balanceAfter: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true
      },
      hidden: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      updatedByAdminId: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    },
    {
      tableName: 'cash_at_hand_log_overrides',
      timestamps: true
    }
  );

  return CashAtHandLogOverride;
};
