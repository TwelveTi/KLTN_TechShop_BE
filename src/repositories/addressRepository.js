const db = require("../models");

// Data-access for user delivery addresses.
class AddressRepository {
  beginTransaction() {
    return db.sequelize.transaction();
  }

  findAllByUser(userId, { transaction } = {}) {
    return db.UserAddress.findAll({
      where: { userId },
      order: [["isDefault", "DESC"], ["createdAt", "DESC"]],
      transaction,
    });
  }

  countByUser(userId, { transaction } = {}) {
    return db.UserAddress.count({ where: { userId }, transaction });
  }

  findByIdForUser(addressId, userId, { transaction, lock } = {}) {
    return db.UserAddress.findOne({
      where: { id: addressId, userId },
      transaction,
      ...(lock ? { lock: transaction.LOCK.UPDATE } : {}),
    });
  }

  clearDefaultForUser(userId, { transaction } = {}) {
    return db.UserAddress.update({ isDefault: false }, { where: { userId }, transaction });
  }

  create(data, { transaction } = {}) {
    return db.UserAddress.create(data, { transaction });
  }

  update(address, changes, { transaction } = {}) {
    return address.update(changes, { transaction });
  }

  destroy(address, { transaction } = {}) {
    return address.destroy({ transaction });
  }
}

module.exports = new AddressRepository();
