module.exports = (sequelize, DataTypes) => {
  const NotificationRead = sequelize.define('NotificationRead', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    notificationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'notifications',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    driverId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'drivers',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'notification_reads',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['notificationId', 'driverId']
      }
    ]
  });

  return NotificationRead;
};
