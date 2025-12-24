module.exports = (sequelize, DataTypes) => {
  const ValkyriePartnerUser = sequelize.define('ValkyriePartnerUser', {
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
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Hashed password, null if not set yet'
    },
    role: {
      type: DataTypes.ENUM('admin', 'ops', 'viewer'),
      defaultValue: 'admin',
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('active', 'suspended', 'inactive'),
      defaultValue: 'active',
      allowNull: false
    },
    inviteToken: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Token for password setup invitation'
    },
    inviteTokenExpiry: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Expiry date for invitation token'
    }
  }, {
    tableName: 'valkyrie_partner_users',
    timestamps: true,
    indexes: [
      {
        fields: ['partnerId']
      },
      {
        fields: ['email']
      },
      {
        fields: ['inviteToken']
      }
    ]
  });

  return ValkyriePartnerUser;
};
