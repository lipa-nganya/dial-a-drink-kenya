module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define('Order', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    customerName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    customerPhone: {
      type: DataTypes.STRING,
      allowNull: false
    },
    customerEmail: {
      type: DataTypes.STRING,
      allowNull: true
    },
    deliveryAddress: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    tipAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0
    },
    status: {
      type: DataTypes.ENUM('pending', 'confirmed', 'out_for_delivery', 'delivered', 'completed', 'cancelled', 'pos_order'),
      defaultValue: 'pending'
    },
    paymentStatus: {
      type: DataTypes.ENUM('pending', 'paid', 'unpaid'),
      defaultValue: 'pending'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    paymentType: {
      type: DataTypes.ENUM('pay_now', 'pay_on_delivery'),
      allowNull: false,
      defaultValue: 'pay_on_delivery'
    },
    paymentMethod: {
      type: DataTypes.ENUM('card', 'mobile_money', 'cash'),
      allowNull: true
    },
    driverId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'drivers',
        key: 'id'
      }
    },
    driverAccepted: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null
    },
    driverPayCredited: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    driverPayCreditedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    driverPayAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0
    },
    branchId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'branches',
        key: 'id'
      }
    },
    adminOrder: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Flag to indicate if order was created by admin'
    },
    adminId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'admins',
        key: 'id'
      },
      comment: 'Admin who serviced/created the POS order'
    },
    territoryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'territories',
        key: 'id'
      }
    },
    deliverySequence: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Order sequence for delivery route (lower number = earlier in route)'
    },
    cancellationRequested: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether driver has requested cancellation of this order'
    },
    cancellationReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Reason provided by driver for cancellation request'
    },
    cancellationRequestedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp when cancellation was requested'
    },
    cancellationApproved: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
      comment: 'Whether admin approved the cancellation (null = pending, true = approved, false = rejected)'
    },
    cancellationApprovedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp when cancellation was approved/rejected by admin'
    },
    cancellationApprovedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'admins',
        key: 'id'
      },
      comment: 'Admin who approved/rejected the cancellation'
    },
    isStop: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether this order is a stop (deducts from driver savings)'
    },
    stopDeductionAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 100.00,
      comment: 'Amount to deduct from driver savings when order is completed (default 100)'
    },
    trackingToken: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      comment: 'Secure token for order tracking via SMS link'
    },
    deliveryDistance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Road distance in kilometers from origin to delivery address'
    }
  }, {
    tableName: 'orders',
    timestamps: true
  });

  return Order;
};

