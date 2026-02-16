module.exports = (sequelize, DataTypes) => {
  const Loan = sequelize.define('Loan', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    driverId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'drivers',
        key: 'id'
      },
      comment: 'Driver who received the loan'
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: 'Original loan amount'
    },
    balance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Remaining loan balance (reduced by deductions)'
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Reason for the loan'
    },
    nextDeductionDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Next scheduled deduction date (based on loan deduction frequency)'
    },
    status: {
      type: DataTypes.ENUM('active', 'paid_off', 'cancelled'),
      defaultValue: 'active',
      allowNull: false,
      comment: 'Loan status'
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'admins',
        key: 'id'
      },
      comment: 'Admin who created the loan'
    }
  }, {
    tableName: 'loans',
    timestamps: true
  });

  return Loan;
};
