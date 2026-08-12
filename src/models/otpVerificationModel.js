module.exports = (sequelize, DataTypes) => {
  const OtpVerification = sequelize.define(
    "OtpVerification",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
      },
      // Kept generic so the same table can back other OTP flows later
      // (e.g. phone verification) without a schema change.
      purpose: {
        type: DataTypes.ENUM("PASSWORD_RESET"),
        allowNull: false,
        defaultValue: "PASSWORD_RESET",
      },
      // HMAC-SHA256 of the 6-digit OTP. The plaintext OTP is NEVER stored.
      otpHash: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 },
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      // Set once the OTP has been successfully verified. From this point the OTP
      // itself can no longer be replayed; the short-lived reset token takes over.
      verifiedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // Terminal state: the record has been consumed (password reset) or
      // invalidated (superseded by a resend / too many attempts / expired).
      usedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // SHA-256 of the reset authorization token handed to the client after a
      // successful OTP verification. Never store the raw token.
      resetTokenHash: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      resetTokenExpiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "otp_verifications",
      timestamps: true,
      paranoid: false,
      underscored: true,
      indexes: [
        { name: "idx_otp_user_purpose", fields: ["user_id", "purpose"] },
        { name: "idx_otp_reset_token_hash", fields: ["reset_token_hash"] },
      ],
    },
  );

  OtpVerification.associate = (models) => {
    OtpVerification.belongsTo(models.User, { foreignKey: "userId", as: "user" });
  };

  return OtpVerification;
};
