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
      type: DataTypes.ENUM('pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'completed', 'cancelled', 'pos_order'),
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
    }
  }, {
    tableName: 'orders',
    timestamps: true
  });

  return Order;
};

