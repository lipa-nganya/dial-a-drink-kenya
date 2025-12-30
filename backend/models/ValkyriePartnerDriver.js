module.exports = (sequelize, DataTypes) => {
  const ValkyriePartnerDriver = sequelize.define('ValkyriePartnerDriver', {
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
    driverId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'drivers',
        key: 'id'
      }
    },
    ownershipType: {
      type: DataTypes.ENUM('partner_owned', 'deliveryos_owned'),
      defaultValue: 'partner_owned',
      allowNull: false
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    }
  }, {
    tableName: 'valkyrie_partner_drivers',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['partnerId', 'driverId']
      }
    ]
  });

  return ValkyriePartnerDriver;
};










