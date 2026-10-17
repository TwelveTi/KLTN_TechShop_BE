// Đếm lần đăng nhập sai của từng tài khoản và thời điểm hết khoá.
// Để ở bảng riêng chứ không thêm cột vào `users`: app tạo bảng bằng `sync()` thường,
// nên bảng mới tự có trên DB đang chạy, còn cột mới thì không.
module.exports = (sequelize, DataTypes) => {
  const LoginLockout = sequelize.define(
    "LoginLockout",
    {
      userId: {
        type: DataTypes.UUID,
        primaryKey: true,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
      },
      failedCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      lockedUntil: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      lastFailedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "login_lockouts",
      timestamps: true,
      underscored: true,
    },
  );

  LoginLockout.associate = (models) => {
    LoginLockout.belongsTo(models.User, { foreignKey: "userId", as: "user" });
  };

  return LoginLockout;
};
