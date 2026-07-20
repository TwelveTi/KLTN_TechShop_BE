const db = require("../models");
const AppError = require("../utils/AppError");

class AddressService {
  async getMyAddresses(userId) {
    return db.UserAddress.findAll({
      where: { userId },
      order: [["isDefault", "DESC"], ["createdAt", "DESC"]],
    });
  }

  async createMyAddress(userId, data) {
    const requiredFields = ["receiverName", "receiverPhone", "province", "district", "ward", "addressLine"];

    requiredFields.forEach((field) => {
      if (!data[field] || !String(data[field]).trim()) {
        throw new AppError(`${field} is required`, 400);
      }
    });

    const transaction = await db.sequelize.transaction();

    try {
      const addressCount = await db.UserAddress.count({ where: { userId }, transaction });
      const shouldSetDefault = Boolean(data.isDefault) || addressCount === 0;

      if (shouldSetDefault) {
        await db.UserAddress.update({ isDefault: false }, { where: { userId }, transaction });
      }

      const address = await db.UserAddress.create(
        {
          userId,
          receiverName: data.receiverName.trim(),
          receiverPhone: data.receiverPhone.trim(),
          province: data.province.trim(),
          district: data.district.trim(),
          ward: data.ward.trim(),
          addressLine: data.addressLine.trim(),
          postalCode: data.postalCode || null,
          isDefault: shouldSetDefault,
        },
        { transaction },
      );

      await transaction.commit();
      return address;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async setDefaultAddress(userId, addressId) {
    const address = await db.UserAddress.findOne({ where: { id: addressId, userId } });

    if (!address) {
      throw new AppError("Address not found", 404);
    }

    const transaction = await db.sequelize.transaction();

    try {
      await db.UserAddress.update({ isDefault: false }, { where: { userId }, transaction });
      await address.update({ isDefault: true }, { transaction });
      await transaction.commit();
      return address;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async deleteMyAddress(userId, addressId) {
    const address = await db.UserAddress.findOne({ where: { id: addressId, userId } });

    if (!address) {
      throw new AppError("Address not found", 404);
    }

    if (address.isDefault) {
      throw new AppError("Default address cannot be deleted", 400);
    }

    await address.destroy();
    return { message: "Address deleted successfully" };
  }
}

module.exports = new AddressService();
