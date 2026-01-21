module.exports = (sequelize, DataTypes) => {
  const ZeusAdmin = sequelize.define('ZeusAdmin', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true
    },
    role: {
      type: DataTypes.ENUM('super_admin', 'ops', 'finance'),
      defaultValue: 'ops',
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      defaultValue: 'active',
      allowNull: false
    }
  }, {
    tableName: 'zeus_admins',
    timestamps: true
  });

  return ZeusAdmin;
};
















