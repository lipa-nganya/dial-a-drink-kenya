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
    brandId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'brands',
        key: 'id'
      }
    },
    isAvailable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    isPublished: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'When false, drink is hidden from the customer site (admin can still see it).'
    },
    isPopular: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    isBrandFocus: {
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
    nbv: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Nicotine by volume: percentage (%) for vapes, milligrams (mg) for pouches'
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
    },
    stockByCapacity: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
      comment: 'Per-capacity stock e.g. {"250ml": 10, "500ml": 5}. When set, capacity-specific updates use this.'
    },
    purchasePrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Purchase/cost price of the inventory item'
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    },
    pageTitle: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'SEO page title for the product'
    },
    keywords: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'SEO keywords for the product'
    },
    youtubeUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'YouTube video URL for the product'
    },
    tags: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of tags for the product'
    },
    clicks: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: 'Number of product details page views (product detail clicks)'
    }
  }, {
    tableName: 'drinks',
    timestamps: true,
    hooks: {
      beforeCreate: async (drink, options) => {
        // Auto-generate slug if not provided
        if (!drink.slug) {
          const { generateDrinkSlug } = require('../utils/slugGenerator');
          try {
            // Fetch brand if brandId is provided
            if (drink.brandId && !drink.brand) {
              const Brand = options.sequelize.models.Brand;
              drink.brand = await Brand.findByPk(drink.brandId);
            }
            drink.slug = await generateDrinkSlug(drink, options.sequelize);
          } catch (error) {
            console.error('Error generating slug:', error);
            // Fallback to ID-based slug if generation fails
            drink.slug = `product-${Date.now()}`;
          }
        }
      },
      beforeUpdate: async (drink, options) => {
        // Regenerate slug if name, brand, or capacity changed
        const changedFields = drink.changed();
        if (changedFields && (
          changedFields.includes('name') ||
          changedFields.includes('brandId') ||
          changedFields.includes('capacity') ||
          changedFields.includes('capacityPricing')
        )) {
          const { generateDrinkSlug } = require('../utils/slugGenerator');
          try {
            // Fetch brand if brandId is provided
            if (drink.brandId && !drink.brand) {
              const Brand = options.sequelize.models.Brand;
              drink.brand = await Brand.findByPk(drink.brandId);
            }
            drink.slug = await generateDrinkSlug(drink, options.sequelize, drink.id);
          } catch (error) {
            console.error('Error regenerating slug:', error);
            // Keep existing slug if regeneration fails
          }
        }
      }
    }
  });

  return Drink;
};

