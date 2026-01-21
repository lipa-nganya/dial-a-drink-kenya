module.exports = (sequelize, DataTypes) => {
  const InventoryCheck = sequelize.define('InventoryCheck', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    shopAgentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'admins',
        key: 'id'
      },
      comment: 'Shop agent who submitted the check'
    },
    drinkId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'drinks',
        key: 'id'
      },
      comment: 'Drink/item being checked'
    },
    agentCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Count reported by shop agent'
    },
    databaseCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Count in database at time of check'
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'recount_requested'),
      allowNull: false,
      defaultValue: 'pending',
      comment: 'Status of the inventory check'
    },
    isFlagged: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'True if agent count does not match database count'
    },
    approvedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'admins',
        key: 'id'
      },
      comment: 'Admin who approved the check'
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the check was approved'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes about the check'
    }
  }, {
    tableName: 'inventory_checks',
    timestamps: true,
    indexes: [
      {
        fields: ['shopAgentId']
      },
      {
        fields: ['drinkId']
      },
      {
        fields: ['status']
      },
      {
        fields: ['isFlagged']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  InventoryCheck.associate = function(models) {
    InventoryCheck.belongsTo(models.Admin, {
      foreignKey: 'shopAgentId',
      as: 'shopAgent'
    });
    InventoryCheck.belongsTo(models.Drink, {
      foreignKey: 'drinkId',
      as: 'drink'
    });
    InventoryCheck.belongsTo(models.Admin, {
      foreignKey: 'approvedBy',
      as: 'approver'
    });
  };

  return InventoryCheck;
};
