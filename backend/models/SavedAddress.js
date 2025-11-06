module.exports = (sequelize, DataTypes) => {
  const SavedAddress = sequelize.define('SavedAddress', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true
    },
    placeId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    formattedAddress: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    searchCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    apiCallsSaved: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    costSaved: {
      type: DataTypes.DECIMAL(10, 4),
      defaultValue: 0
    }
  }, {
    tableName: 'saved_addresses',
    timestamps: true
  });

  return SavedAddress;
};

