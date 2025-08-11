import cloudinary from "../config/cloudinary.js";


export const uploadToCloudinary = async (
  fileBuffer,
  folder = "garden",
  fileName = null
) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: folder,
      resource_type: "image",
      format: "webp",
      quality: "auto",
      fetch_format: "auto",
    };

    if (fileName) {
      uploadOptions.public_id = fileName;
    }

    cloudinary.uploader
      .upload_stream(uploadOptions, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            public_id: result.public_id,
            url: result.secure_url,
          });
        }
      })
      .end(fileBuffer);
  });
};


export const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error("Error deleting from cloudinary:", error);
    throw error;
  }
};


export const uploadMultipleToCloudinary = async (files, folder = "garden") => {
  const uploadPromises = files.map((file, index) =>
    uploadToCloudinary(file.buffer, folder, `${Date.now()}_${index}`)
  );

  return Promise.all(uploadPromises);
};
