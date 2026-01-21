module.exports = (sequelize, DataTypes) => {
  const PartnerInvoice = sequelize.define('PartnerInvoice', {
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
    invoiceNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    period: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'e.g., "2024-01" for January 2024'
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    status: {
      type: DataTypes.ENUM('draft', 'issued', 'paid'),
      defaultValue: 'draft',
      allowNull: false
    },
    dueDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    paidDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'partner_invoices',
    timestamps: true,
    indexes: [
      {
        fields: ['partnerId', 'period']
      },
      {
        fields: ['status']
      }
    ]
  });

  return PartnerInvoice;
};
















