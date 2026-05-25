const multer = require("multer");
const AppError = require("../utils/AppError");
const { isCloudinaryConfigured } = require("../config/cloudinary");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new AppError("Solo se permiten imágenes", 400), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 3,
  },
});

exports.uploadProductImages = upload.array("images", 3);

exports.requireCloudinary = (req, res, next) => {
  if (!isCloudinaryConfigured()) {
    return next(
      new AppError(
        "Cloudinary no está configurado. Agrega las variables en .env o usa URLs de imagen.",
        503
      )
    );
  }
  next();
};
