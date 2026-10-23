// Đếm lần đăng nhập sai theo email và thời điểm hết khoá. Khoá theo email chứ không theo tài khoản,
// để email không tồn tại cũng bị khoá y hệt, không ai dò được email nào đã đăng ký.
// Bảng mới thay cho `login_lockouts` cũ (khoá theo userId) vì `sync()` không đổi được khoá chính bảng đã có.
module.exports = (sequelize, DataTypes) => {
  const LoginLockout = sequelize.define(
    "LoginLockout",
    {
      // SHA-256 của email đã chuẩn hoá, không lưu email thô của những lần thử.
      emailKey: {
        type: DataTypes.STRING(64),
        primaryKey: true,
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
      tableName: "login_email_lockouts",
      timestamps: true,
      underscored: true,
    },
  );

  return LoginLockout;
};
