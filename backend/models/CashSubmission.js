module.exports = (sequelize, DataTypes) => {
  const CashSubmission = sequelize.define('CashSubmission', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    driverId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'drivers',
        key: 'id'
      }
    },
    adminId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'admins',
        key: 'id'
      },
      comment: 'Admin who created the submission (for admin cash submissions)'
    },
    submissionType: {
      type: DataTypes.ENUM('purchases', 'cash', 'general_expense', 'payment_to_office', 'walk_in_sale', 'order_payment'),
      allowNull: false,
      comment: 'Type of cash submission'
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending',
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: 'Amount of cash submission'
    },
    // JSON field to store different fields based on submission type
    details: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Additional details based on submission type'
    },
    // For purchases: supplier, item, price, deliveryLocation
    // For cash: recipientName
    // For general_expense: nature
    // For payment_to_office: accountType (mpesa, till, bank, paybill, pdq)
    // For walk_in_sale: customerName (optional)
    approvedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'admins',
        key: 'id'
      },
      comment: 'Admin who approved the submission'
    },
    rejectedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'admins',
        key: 'id'
      },
      comment: 'Admin who rejected the submission'
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    rejectedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Reason for rejection if rejected'
    }
  }, {
    tableName: 'cash_submissions',
    timestamps: true
  });

  CashSubmission.associate = function(models) {
    CashSubmission.belongsTo(models.Driver, {
      foreignKey: 'driverId',
      as: 'driver'
    });
    CashSubmission.belongsTo(models.Admin, {
      foreignKey: 'adminId',
      as: 'admin'
    });
    CashSubmission.belongsTo(models.Admin, {
      foreignKey: 'approvedBy',
      as: 'approver'
    });
    CashSubmission.belongsTo(models.Admin, {
      foreignKey: 'rejectedBy',
      as: 'rejector'
    });
    // Many-to-many relationship with Order
    CashSubmission.belongsToMany(models.Order, {
      through: 'cash_submission_orders',
      foreignKey: 'cashSubmissionId',
      otherKey: 'orderId',
      as: 'orders'
    });
  };

  return CashSubmission;
};
