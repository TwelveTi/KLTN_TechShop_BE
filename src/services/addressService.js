const AppError = require("../utils/AppError");
const addressRepository = require("../repositories/addressRepository");

class AddressService {
  async getMyAddresses(userId) {
    return addressRepository.findAllByUser(userId);
  }

  // Input is already validated + trimmed by validateCreateAddress middleware,
  // so the service only orchestrates the transaction and the default-address
  // business rule.
  async createMyAddress(userId, data) {
    const transaction = await addressRepository.beginTransaction();

    try {
      const addressCount = await addressRepository.countByUser(userId, { transaction });
      const shouldSetDefault = Boolean(data.isDefault) || addressCount === 0;

      if (shouldSetDefault) {
        await addressRepository.clearDefaultForUser(userId, { transaction });
      }

      const address = await addressRepository.create(
        {
          userId,
          receiverName: data.receiverName,
          receiverPhone: data.receiverPhone,
          province: data.province,
          district: data.district,
          ward: data.ward,
          addressLine: data.addressLine,
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
    const address = await addressRepository.findByIdForUser(addressId, userId);

    if (!address) {
      throw new AppError("Address not found", 404);
    }

    const transaction = await addressRepository.beginTransaction();

    try {
      await addressRepository.clearDefaultForUser(userId, { transaction });
      await addressRepository.update(address, { isDefault: true }, { transaction });
      await transaction.commit();
      return address;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async deleteMyAddress(userId, addressId) {
    const address = await addressRepository.findByIdForUser(addressId, userId);

    if (!address) {
      throw new AppError("Address not found", 404);
    }

    if (address.isDefault) {
      throw new AppError("Default address cannot be deleted", 400);
    }

    await addressRepository.destroy(address);
    return { message: "Address deleted successfully" };
  }
}

module.exports = new AddressService();
