const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SubCategory = sequelize.define('SubCategory', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'categories',
        key: 'id'
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'subcategories',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['name', 'categoryId']
      }
    ]
  });

  return SubCategory;
};
