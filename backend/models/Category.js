module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define('Category', {
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
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    image: {
      type: DataTypes.STRING,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    }
  }, {
    tableName: 'categories',
    timestamps: true,
    hooks: {
      beforeCreate: async (category, options) => {
        // Auto-generate slug if not provided
        if (!category.slug) {
          const { generateCategorySlug } = require('../utils/slugGenerator');
          try {
            category.slug = await generateCategorySlug(category, options.sequelize);
          } catch (error) {
            console.error('Error generating category slug:', error);
            // Fallback to name-based slug
            category.slug = category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          }
        }
      },
      beforeUpdate: async (category, options) => {
        // Regenerate slug if name changed
        const changedFields = category.changed();
        if (changedFields && changedFields.includes('name')) {
          const { generateCategorySlug } = require('../utils/slugGenerator');
          try {
            category.slug = await generateCategorySlug(category, options.sequelize, category.id);
          } catch (error) {
            console.error('Error regenerating category slug:', error);
            // Keep existing slug if regeneration fails
          }
        }
      }
    }
  });

  return Category;
};

