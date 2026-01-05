module.exports = (sequelize, DataTypes) => {
  const PartnerGeofence = sequelize.define('PartnerGeofence', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    partnerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'valkyrie_partners',
        key: 'id'
      }
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    geometry: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: 'GeoJSON Polygon or MultiPolygon'
    },
    source: {
      type: DataTypes.ENUM('zeus', 'partner'),
      defaultValue: 'partner',
      allowNull: false
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'ZeusAdmin ID if created by Zeus, null if by partner'
    }
  }, {
    tableName: 'partner_geofences',
    timestamps: true,
    indexes: [
      {
        fields: ['partnerId']
      },
      {
        fields: ['active']
      }
    ]
  });

  return PartnerGeofence;
};














