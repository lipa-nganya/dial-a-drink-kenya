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
      type: DataTypes.ENUM('admin', 'manager'),
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
    }
  }, {
    tableName: 'admins',
    timestamps: true
  });

  return Admin;
};





