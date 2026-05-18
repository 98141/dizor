const { cloudinary, isCloudinaryConfigured } = require("../config/cloudinary");

const uploadFromBuffer = (buffer, folder = "dizor/products") =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [{ quality: "auto", fetch_format: "auto" }],
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });

exports.uploadProductImages = async (files) => {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary no configurado");
  }

  const uploads = await Promise.all(
    files.map(async (file) => {
      const result = await uploadFromBuffer(file.buffer);
      return {
        url: result.secure_url,
        publicId: result.public_id,
        alt: file.originalname?.replace(/\.[^.]+$/, "") || "",
      };
    })
  );

  return uploads;
};

exports.deleteImage = async (publicId) => {
  if (!publicId || !isCloudinaryConfigured()) return;
  await cloudinary.uploader.destroy(publicId);
};
