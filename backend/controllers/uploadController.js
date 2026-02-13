const asyncHandler = require("express-async-handler");
const cloudinary = require("../config/cloudinary");

/**
 * @description  Upload a file to Cloudinary via the backend
 * @route        POST /api/upload
 * @access       Protected
 *
 * Uses resource_type "auto" so Cloudinary accepts ANY file type
 * (images, videos, PDFs, documents, archives, etc.)
 */
const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No file provided");
  }

  // Verify Cloudinary credentials are available
  if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error("❌ CLOUDINARY_API_KEY or CLOUDINARY_API_SECRET not set!");
    res.status(500);
    throw new Error("File upload service is not configured. Please set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.");
  }

  try {
    // Upload using a data URI from the multer memory buffer
    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;

    const result = await cloudinary.uploader.upload(dataURI, {
      resource_type: "auto",            // auto-detect: image, video, or raw
      folder: "chat-app-files",         // organise uploads in a folder
      use_filename: true,               // keep original filename
      unique_filename: true,            // add random suffix to avoid collisions
      overwrite: false,
    });

    console.log("✅ File uploaded to Cloudinary:", {
      public_id: result.public_id,
      format: result.format,
      resource_type: result.resource_type,
      bytes: result.bytes,
      url: result.secure_url,
    });

    res.json({
      url: result.secure_url,
      public_id: result.public_id,
      resource_type: result.resource_type,
      format: result.format,
      bytes: result.bytes,
    });
  } catch (error) {
    console.error("❌ Cloudinary upload error:", error.message || error);
    res.status(500);
    throw new Error("Failed to upload file: " + (error.message || "Unknown error"));
  }
});

module.exports = { uploadFile };

