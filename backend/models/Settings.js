module.exports = (sequelize, DataTypes) => {
  const Settings = sequelize.define('Settings', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    key: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'settings',
    timestamps: true
  });

  return Settings;
};


























