module.exports = (sequelize, DataTypes) => {
  const Customer = sequelize.define('Customer', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: 'Can be either email or phone number'
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Hashed password, null if not set yet'
    },
    customerName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    hasSetPassword: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'customers',
    timestamps: true
  });

  return Customer;
};

























