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
    fileSize: 5 * 1024 * 1024,
    files: 10,
  },
});

exports.uploadProductImages = upload.array("images", 10);

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
