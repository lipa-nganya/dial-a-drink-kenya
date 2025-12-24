module.exports = (sequelize, DataTypes) => {
  const ValkyriePartner = sequelize.define('ValkyriePartner', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('active', 'suspended', 'restricted'),
      defaultValue: 'active',
      allowNull: false
    },
    allowedCities: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: []
    },
    allowedVehicleTypes: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: []
    },
    billingPlan: {
      type: DataTypes.STRING,
      allowNull: true
    },
    apiKey: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    },
    apiSecret: {
      type: DataTypes.STRING,
      allowNull: true
    },
    webhookUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    webhookSecret: {
      type: DataTypes.STRING,
      allowNull: true
    },
    apiRateLimit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1000,
      comment: 'API calls per hour'
    },
    zeusManaged: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Whether this partner is managed by Zeus'
    },
    environment: {
      type: DataTypes.ENUM('sandbox', 'production'),
      defaultValue: 'sandbox',
      allowNull: false,
      comment: 'Environment: sandbox (from website) or production (Zeus managed)'
    },
    productionEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Whether production API access is enabled (partners can generate production API keys)'
    }
  }, {
    tableName: 'valkyrie_partners',
    timestamps: true
  });

  return ValkyriePartner;
};
