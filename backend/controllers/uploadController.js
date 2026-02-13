const asyncHandler = require("express-async-handler");
const cloudinary = require("../config/cloudinary");
const { Readable } = require("stream");

/**
 * @description  Upload a file to Cloudinary via the backend
 * @route        POST /api/upload
 * @access       Protected
 *
 * Uses upload_stream with resource_type "auto" so Cloudinary accepts
 * ANY file type (images, videos, PDFs, documents, archives, etc.)
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
    throw new Error(
      "File upload service is not configured. Please set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET."
    );
  }

  try {
    console.log("📤 Uploading file:", {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      bufferLength: req.file.buffer ? req.file.buffer.length : 0,
    });

    // Use upload_stream — streams the buffer directly to Cloudinary.
    // This is far more reliable than the data-URI approach because it
    // avoids base64 encoding issues and works for ALL file types.
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "auto", // auto-detect: image, video, or raw
          folder: "chat-app-files",
          use_filename: true,
          unique_filename: true,
          overwrite: false,
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );

      // Convert the buffer into a readable stream and pipe it to Cloudinary
      const readableStream = new Readable();
      readableStream.push(req.file.buffer);
      readableStream.push(null); // signal end of stream
      readableStream.pipe(uploadStream);
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
    console.error("❌ Cloudinary upload error:", error);
    res.status(500);
    throw new Error(
      "Failed to upload file: " + (error.message || "Unknown error")
    );
  }
});

module.exports = { uploadFile };
