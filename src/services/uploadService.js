const sharp = require("sharp");
const streamifier = require("streamifier");
const cloudinary = require("../configs/cloudinary");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");

class UploadService {
  assertCloudinaryConfigured(meta = {}) {
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      logger.error("Cloudinary configuration missing", {
        requestId: meta.requestId,
        hasCloudName: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
        hasApiKey: Boolean(process.env.CLOUDINARY_API_KEY),
        hasApiSecret: Boolean(process.env.CLOUDINARY_API_SECRET),
      });
      throw new AppError("Cloudinary environment variables are not configured", 500);
    }
  }

  parsePublicIds(value) {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value.filter(Boolean);
    }

    if (typeof value === "string") {
      try {
        const parsedValue = JSON.parse(value);
        return Array.isArray(parsedValue) ? parsedValue.filter(Boolean) : [value];
      } catch (error) {
        return [value];
      }
    }

    return [];
  }

  async optimizeImage(file, meta = {}) {
    try {
      logger.info("Optimizing product image", {
        requestId: meta.requestId,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      });

      return await sharp(file.buffer)
        .resize({
          width: 1600,
          withoutEnlargement: true,
        })
        .sharpen()
        .webp({ quality: 92, effort: 4 })
        .toBuffer();
    } catch (error) {
      logger.error("Product image optimization failed", {
        requestId: meta.requestId,
        originalName: file.originalname,
        error: logger.serializeError(error),
      });
      throw error;
    }
  }

  uploadBuffer(buffer, options = {}, meta = {}) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error) {
          logger.error("Cloudinary product image upload failed", {
            requestId: meta.requestId,
            originalName: meta.originalName,
            error: logger.serializeError(error),
          });
          return reject(error);
        }

        logger.info("Cloudinary product image upload completed", {
          requestId: meta.requestId,
          originalName: meta.originalName,
          publicId: result.public_id,
          bytes: result.bytes,
          width: result.width,
          height: result.height,
        });

        return resolve(result);
      });

      streamifier.createReadStream(buffer).pipe(uploadStream);
    });
  }

  async uploadProductImages(files = [], rollbackPublicIds = [], meta = {}) {
    if (!files.length) {
      logger.warn("Product image upload rejected because no files were provided", {
        requestId: meta.requestId,
      });
      throw new AppError("Images are required", 400);
    }

    this.assertCloudinaryConfigured(meta);

    const uploadedImages = [];

    try {
      for (const file of files) {
        const optimizedBuffer = await this.optimizeImage(file, meta);
        const result = await this.uploadBuffer(
          optimizedBuffer,
          {
            folder: "techshop/products",
            resource_type: "image",
            format: "webp",
            quality: "auto:best",
          },
          {
            ...meta,
            originalName: file.originalname,
          },
        );

        uploadedImages.push({
          imageUrl: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      }

      return uploadedImages;
    } catch (error) {
      logger.error("Product image upload workflow failed, rolling back uploaded images", {
        requestId: meta.requestId,
        uploadedCount: uploadedImages.length,
        rollbackCount: rollbackPublicIds.length,
        error: logger.serializeError(error),
      });

      await this.deleteMany([
        ...uploadedImages.map((image) => image.publicId),
        ...rollbackPublicIds,
      ], meta);
      throw new AppError("Upload image failed. Uploaded images were removed, please try again.", 400);
    }
  }

  async uploadAvatar(file, previousPublicId = null, meta = {}) {
    if (!file) {
      throw new AppError("Avatar image is required", 400);
    }

    this.assertCloudinaryConfigured(meta);

    try {
      const optimizedBuffer = await sharp(file.buffer)
        .resize({
          width: 512,
          height: 512,
          fit: "cover",
          withoutEnlargement: true,
        })
        .webp({ quality: 90, effort: 4 })
        .toBuffer();

      const result = await this.uploadBuffer(
        optimizedBuffer,
        {
          folder: "techshop/avatars",
          resource_type: "image",
          format: "webp",
          quality: "auto:best",
        },
        {
          ...meta,
          originalName: file.originalname,
        },
      );

      if (previousPublicId) {
        await this.deleteOne(previousPublicId, meta);
      }

      return {
        avatarUrl: result.secure_url,
        avatarPublicId: result.public_id,
      };
    } catch (error) {
      logger.error("Avatar upload workflow failed", {
        requestId: meta.requestId,
        originalName: file.originalname,
        error: logger.serializeError(error),
      });
      throw new AppError("Upload avatar failed. Please try again.", 400);
    }
  }

  async deleteOne(publicId, meta = {}) {
    if (!publicId) {
      return null;
    }

    try {
      const result = await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
      logger.info("Cloudinary image deleted", {
        requestId: meta.requestId,
        publicId,
        result,
      });
      return result;
    } catch (error) {
      logger.error("Cloudinary image delete failed", {
        requestId: meta.requestId,
        publicId,
        error: logger.serializeError(error),
      });
      throw error;
    }
  }

  async deleteMany(publicIds = [], meta = {}) {
    const validPublicIds = publicIds.filter(Boolean);

    if (!validPublicIds.length) {
      return [];
    }

    return Promise.allSettled(validPublicIds.map((publicId) => this.deleteOne(publicId, meta)));
  }
}

module.exports = new UploadService();
