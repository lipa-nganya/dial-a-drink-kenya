module.exports = (sequelize, DataTypes) => {
  const AssetAccount = sequelize.define('AssetAccount', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Account name'
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Account description'
    },
    balance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Current balance'
    },
    limit: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Account limit (e.g. overdraft)'
    }
  }, {
    tableName: 'asset_accounts',
    timestamps: true,
    underscored: true
  });

  return AssetAccount;
};
