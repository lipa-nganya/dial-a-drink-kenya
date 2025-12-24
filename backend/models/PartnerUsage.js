module.exports = (sequelize, DataTypes) => {
  const PartnerUsage = sequelize.define('PartnerUsage', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    partnerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'valkyrie_partners',
        key: 'id'
      }
    },
    metric: {
      type: DataTypes.ENUM('orders', 'api_calls', 'km', 'drivers'),
      allowNull: false
    },
    value: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    period: {
      type: DataTypes.ENUM('daily', 'monthly'),
      allowNull: false
    },
    periodDate: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'The date this usage period represents (YYYY-MM-DD for daily, YYYY-MM-01 for monthly)'
    }
  }, {
    tableName: 'partner_usage',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['partnerId', 'metric', 'period', 'periodDate']
      },
      {
        fields: ['partnerId', 'periodDate']
      }
    ]
  });

  return PartnerUsage;
};






