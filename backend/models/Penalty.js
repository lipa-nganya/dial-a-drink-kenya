module.exports = (sequelize, DataTypes) => {
  const Penalty = sequelize.define('Penalty', {
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
      comment: 'Driver who received the penalty'
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: 'Original penalty amount'
    },
    balance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Remaining penalty balance (reduced by payments)'
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Reason for the penalty'
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'admins',
        key: 'id'
      },
      comment: 'Admin who created the penalty'
    }
  }, {
    tableName: 'penalties',
    timestamps: true
  });

  return Penalty;
};
