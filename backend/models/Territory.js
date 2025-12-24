module.exports = (sequelize, DataTypes) => {
  const Territory = sequelize.define('Territory', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    deliveryFromCBD: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Delivery cost from CBD location'
    },
    deliveryFromRuaka: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Delivery cost from Ruaka location'
    }
  }, {
    tableName: 'territories',
    timestamps: true
  });

  return Territory;
};

