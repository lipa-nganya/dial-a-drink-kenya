const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Countdown = sequelize.define('Countdown', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'start_date'
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'end_date'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    title: {
      type: DataTypes.STRING,
      defaultValue: 'Special Offer',
      allowNull: false
    }
  }, {
    tableName: 'countdowns',
    timestamps: true
  });

  return Countdown;
};
