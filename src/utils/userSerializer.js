// The public shape of a user returned to its owner (profile endpoints, auth
// responses). Lives here rather than on a service because both authService and
// userService need it, and it is a pure projection with no data access.
//
// Never add passwordHash, avatarPublicId or deletedAt here.
const toSafeUser = (user) => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  phone: user.phone,
  avatarUrl: user.avatarUrl,
  role: user.role,
  status: user.status,
  emailVerifiedAt: user.emailVerifiedAt,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

module.exports = { toSafeUser };
