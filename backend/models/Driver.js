module.exports = (sequelize, DataTypes) => {
  const Driver = sequelize.define('Driver', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    pushToken: {
      type: DataTypes.STRING,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'on_delivery', 'offline'),
      defaultValue: 'offline'
    },
    lastActivity: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW
    },
    pinHash: {
      type: DataTypes.STRING,
      allowNull: true
    },
    valkyrieEligible: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Whether this driver can be assigned to Valkyrie partner orders'
    }
  }, {
    tableName: 'drivers',
    timestamps: true
  });

  return Driver;
};





