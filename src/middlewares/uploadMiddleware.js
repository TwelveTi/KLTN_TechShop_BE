const multer = require("multer");
const AppError = require("../utils/AppError");

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_PRODUCT_IMAGES = 10;

const storage = multer.memoryStorage();

const imageFileFilter = (req, file, cb) => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    return cb(new AppError("Only JPG, PNG and WEBP images are allowed", 400));
  }

  return cb(null, true);
};

const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_PRODUCT_IMAGES,
  },
});

const uploadProductImages = upload.array("images", MAX_PRODUCT_IMAGES);
const avatarUpload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 1 * 1024 * 1024,
    files: 1,
  },
});
const uploadAvatar = avatarUpload.single("avatar");

module.exports = {
  uploadAvatar,
  uploadProductImages,
};
