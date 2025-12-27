module.exports = (sequelize, DataTypes) => {
  const ValkyriePartnerOrder = sequelize.define('ValkyriePartnerOrder', {
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
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'orders',
        key: 'id'
      }
    },
    assignedDriverId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'drivers',
        key: 'id'
      }
    },
    fulfillmentType: {
      type: DataTypes.ENUM('partner_driver', 'deliveryos_driver'),
      allowNull: true
    },
    externalOrderId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Partner\'s internal order ID for reference'
    }
  }, {
    tableName: 'valkyrie_partner_orders',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['partnerId', 'orderId']
      },
      {
        fields: ['externalOrderId']
      }
    ]
  });

  return ValkyriePartnerOrder;
};







