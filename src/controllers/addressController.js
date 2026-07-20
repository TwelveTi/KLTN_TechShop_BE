const addressService = require("../services/addressService");
const APIResponse = require("../utils/ApiResponse");

class AddressController {
  async getMyAddresses(req, res) {
    const addresses = await addressService.getMyAddresses(req.user.id);

    return APIResponse.success(res, "Get my addresses successfully", addresses);
  }

  async createMyAddress(req, res) {
    const address = await addressService.createMyAddress(req.user.id, req.body);

    return APIResponse.success(res, "Create address successfully", address, 201);
  }

  async setDefaultAddress(req, res) {
    const address = await addressService.setDefaultAddress(req.user.id, req.params.id);

    return APIResponse.success(res, "Set default address successfully", address);
  }

  async deleteMyAddress(req, res) {
    const result = await addressService.deleteMyAddress(req.user.id, req.params.id);

    return APIResponse.success(res, result.message);
  }
}

module.exports = new AddressController();
