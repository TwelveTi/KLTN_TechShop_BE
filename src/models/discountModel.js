module.exports = (sequelize, DataTypes) => {
  // A voucher code a shopper can apply at checkout.
  //
  // NOTE: only the schema exists at this point — there is no discountService
  // yet, and `POST /orders` still hardcodes `discountAmount: 0`. The table is
  // created now so the design is fixed in code (not just in README 5.13) and so
  // the later service work is purely a service-layer change.
  const Discount = sequelize.define(
    "Discount",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      code: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      discountType: {
        type: DataTypes.ENUM("PERCENT", "FIXED"),
        allowNull: false,
      },
      // Percentage points when PERCENT, an amount in VND when FIXED.
      value: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: { min: 0 },
      },
      // Ceiling for PERCENT codes, so "20% off" cannot take 16 million off an
      // 80-million order. Ignored for FIXED.
      maxDiscountAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        validate: { min: 0 },
      },
      minOrderValue: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 },
      },
      // NULL means unlimited.
      usageLimit: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: { min: 0 },
      },
      // The contended counter: this row is read with LOCK.UPDATE and bumped
      // inside the order-creation transaction, exactly like
      // products.stock_quantity. Without the lock a code limited to 100 uses
      // would be redeemed more times than that under concurrent checkouts.
      usedCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 },
      },
      usageLimitPerUser: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: { min: 0 },
      },
      startsAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      endsAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("ACTIVE", "PAUSED", "EXPIRED"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },
    },
    {
      tableName: "discounts",
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        { unique: true, fields: ["code"] },
        { fields: ["status"] },
        { fields: ["starts_at", "ends_at"] },
      ],
    },
  );

  Discount.associate = (models) => {
    Discount.hasMany(models.DiscountUsage, { foreignKey: "discountId", as: "usages" });
  };

  return Discount;
};
