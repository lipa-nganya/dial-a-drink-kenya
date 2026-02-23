module.exports = (sequelize, DataTypes) => {
  const Admin = sequelize.define('Admin', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true // Allow null for invited users who haven't set password yet
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    role: {
      type: DataTypes.ENUM('admin', 'manager', 'shop_agent', 'super_admin'),
      allowNull: false,
      defaultValue: 'manager'
    },
    inviteToken: {
      type: DataTypes.STRING,
      allowNull: true
    },
    inviteTokenExpiry: {
      type: DataTypes.DATE,
      allowNull: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Full name for shop agents'
    },
    mobileNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Mobile number for shop agents'
    },
    pinHash: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Hashed PIN for shop agents'
    },
    hasSetPin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether shop agent has set their PIN'
    },
    pushToken: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'FCM push token for shop agents'
    }
  }, {
    tableName: 'admins',
    timestamps: true
  });

  return Admin;
};





