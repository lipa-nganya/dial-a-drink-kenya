module.exports = (sequelize, DataTypes) => {
  const Drink = sequelize.define('Drink', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    image: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'categories',
        key: 'id'
      }
    },
    subCategoryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'subcategories',
        key: 'id'
      }
    },
    isAvailable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    isPopular: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    isOnOffer: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    limitedTimeOffer: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    originalPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    capacity: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    capacityPricing: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    abv: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    barcode: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    }
  }, {
    tableName: 'drinks',
    timestamps: true
  });

  return Drink;
};

