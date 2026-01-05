module.exports = (sequelize, DataTypes) => {
  const Stop = sequelize.define('Stop', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    driverId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'drivers',
        key: 'id'
      },
      comment: 'The rider/driver this stop belongs to'
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Stop name'
    },
    location: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Stop location/address'
    },
    instruction: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Special instructions for the stop'
    },
    payment: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      comment: 'Payment amount for this stop'
    },
    insertAfterIndex: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: -1,
      comment: 'Position in route: -1 = after last order, 0+ = after order at this index'
    },
    sequence: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Order among stops at the same insertAfterIndex position'
    }
  }, {
    tableName: 'stops',
    timestamps: true
  });

  return Stop;
};

