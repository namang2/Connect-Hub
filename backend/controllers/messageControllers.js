const asyncHandler = require("express-async-handler");
const Message = require("../models/messageModel");
const User = require("../models/userModel");
const Chat = require("../models/chatModel");

//@description     Get all Messages
//@route           GET /api/Message/:chatId
//@access          Protected
const allMessages = asyncHandler(async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate("sender", "name pic email")
      .populate("chat");
    res.json(messages);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

//@description     Create New Message
//@route           POST /api/Message/
//@access          Protected
const sendMessage = asyncHandler(async (req, res) => {
  const { content, chatId } = req.body;

  if (!content || !chatId) {
    console.log("Invalid data passed into request");
    return res.sendStatus(400);
  }

  var newMessage = {
    sender: req.user._id,
    content: content,
    chat: chatId,
  };

  try {
    var message = await Message.create(newMessage);

    message = await Message.findOne({ _id: message._id })
      .populate("sender", "name pic email")
      .populate("chat");

    message = await User.populate(message, {
      path: "chat.users",
      select: "name pic email",
    });

    await Chat.findByIdAndUpdate(req.body.chatId, { latestMessage: message });

    res.json(message);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

//@description     Send File Message
//@route           POST /api/Message/file
//@access          Protected
const sendFileMessage = asyncHandler(async (req, res) => {
  const { chatId, fileUrl, fileName, fileType, fileSize, content } = req.body;

  if (!chatId || !fileUrl) {
    console.log("Invalid data passed into request");
    return res.sendStatus(400);
  }

  // Determine file category
  let fileCategory = "other";
  if (fileType) {
    if (fileType.startsWith("image/")) {
      fileCategory = "image";
    } else if (fileType.startsWith("video/")) {
      fileCategory = "video";
    } else if (fileType.startsWith("audio/")) {
      fileCategory = "audio";
    } else if (
      fileType.includes("pdf") ||
      fileType.includes("document") ||
      fileType.includes("msword") ||
      fileType.includes("spreadsheet") ||
      fileType.includes("presentation")
    ) {
      fileCategory = "document";
    }
  }

  var newMessage = {
    sender: req.user._id,
    content: content || fileName || "File",
    chat: chatId,
    isFile: true,
    file: {
      url: fileUrl,
      name: fileName,
      type: fileCategory,
      size: fileSize,
    },
  };

  try {
    var message = await Message.create(newMessage);

    message = await Message.findOne({ _id: message._id })
      .populate("sender", "name pic email")
      .populate("chat");

    message = await User.populate(message, {
      path: "chat.users",
      select: "name pic email",
    });

    await Chat.findByIdAndUpdate(chatId, { latestMessage: message });

    res.json(message);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

//@description     Send Location Message
//@route           POST /api/Message/location
//@access          Protected
const sendLocationMessage = asyncHandler(async (req, res) => {
  const { chatId, latitude, longitude, address, isLive, duration } = req.body;

  if (!chatId || latitude === undefined || longitude === undefined) {
    console.log("Invalid location data passed into request");
    return res.sendStatus(400);
  }

  // Calculate expiry time for live location (default 15 minutes)
  let expiresAt = null;
  if (isLive) {
    const durationMs = (duration || 15) * 60 * 1000; // Convert minutes to ms
    expiresAt = new Date(Date.now() + durationMs);
  }

  var newMessage = {
    sender: req.user._id,
    content: isLive ? "📍 Live Location" : "📍 Current Location",
    chat: chatId,
    isLocation: true,
    location: {
      latitude,
      longitude,
      address: address || "",
      isLive: isLive || false,
      expiresAt,
    },
  };

  try {
    var message = await Message.create(newMessage);

    message = await Message.findOne({ _id: message._id })
      .populate("sender", "name pic email")
      .populate("chat");

    message = await User.populate(message, {
      path: "chat.users",
      select: "name pic email",
    });

    await Chat.findByIdAndUpdate(chatId, { latestMessage: message });

    res.json(message);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

//@description     Update Live Location
//@route           PUT /api/Message/location/:messageId
//@access          Protected
const updateLiveLocation = asyncHandler(async (req, res) => {
  const { latitude, longitude } = req.body;
  const { messageId } = req.params;

  if (!messageId || latitude === undefined || longitude === undefined) {
    return res.sendStatus(400);
  }

  try {
    const message = await Message.findById(messageId);

    if (!message || !message.isLocation || !message.location.isLive) {
      res.status(404);
      throw new Error("Live location message not found");
    }

    // Check if live location has expired
    if (message.location.expiresAt && new Date() > message.location.expiresAt) {
      res.status(400);
      throw new Error("Live location has expired");
    }

    // Update location
    message.location.latitude = latitude;
    message.location.longitude = longitude;
    await message.save();

    const updatedMessage = await Message.findOne({ _id: messageId })
      .populate("sender", "name pic email")
      .populate("chat");

    res.json(updatedMessage);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

//@description     Download file via proxy (avoids CORS issues)
//@route           GET /api/Message/download
//@access          Protected
const downloadFileProxy = asyncHandler(async (req, res) => {
  const { url, name } = req.query;

  if (!url) {
    res.status(400);
    throw new Error("File URL is required");
  }

  // Determine correct content-type from file extension
  const getContentTypeFromName = (fileName) => {
    const ext = (fileName || "").split(".").pop().toLowerCase();
    const mimeTypes = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      txt: "text/plain",
      csv: "text/csv",
      zip: "application/zip",
      rar: "application/x-rar-compressed",
      "7z": "application/x-7z-compressed",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      mp4: "video/mp4",
      avi: "video/x-msvideo",
      mov: "video/quicktime",
      mkv: "video/x-matroska",
      webm: "video/webm",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      json: "application/json",
      xml: "application/xml",
      html: "text/html",
      css: "text/css",
      js: "application/javascript",
    };
    return mimeTypes[ext] || "application/octet-stream";
  };

  try {
    const https = require("https");
    const http = require("http");

    const fileName = name || "download";

    // Transform Cloudinary URL to ensure we get the original file
    // PDFs stored as "image" type need fl_attachment to return original PDF
    let downloadUrl = url;
    if (url.includes("cloudinary.com") && url.includes("/upload/")) {
      const fileExt = (fileName || url).split(".").pop().toLowerCase();
      const isDocument = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "zip", "rar", "7z"].includes(fileExt);

      if (isDocument && !url.includes("fl_attachment")) {
        // Add fl_attachment to force original file delivery (not rasterized image)
        downloadUrl = url.replace("/upload/", "/upload/fl_attachment/");
        console.log("📎 Transformed Cloudinary URL for document download:", downloadUrl);
      }
    }

    // Recursive function to follow redirects (up to 10 levels)
    const fetchWithRedirects = (fetchUrl, redirectCount = 0, isRetryWithOriginal = false) => {
      if (redirectCount > 10) {
        if (!res.headersSent) {
          res.status(500).json({ message: "Too many redirects" });
        }
        return;
      }

      let parsedUrl;
      try {
        parsedUrl = new URL(fetchUrl);
      } catch (e) {
        if (!res.headersSent) {
          res.status(400).json({ message: "Invalid URL" });
        }
        return;
      }

      const protocol = parsedUrl.protocol === "https:" ? https : http;

      const request = protocol.get(fetchUrl, { timeout: 30000 }, (fileResponse) => {
        // Follow redirects
        if ([301, 302, 303, 307, 308].includes(fileResponse.statusCode)) {
          const redirectUrl = fileResponse.headers.location;
          if (redirectUrl) {
            const absoluteUrl = redirectUrl.startsWith("http")
              ? redirectUrl
              : new URL(redirectUrl, fetchUrl).toString();
            // Consume the redirect response to free up the socket
            fileResponse.resume();
            fetchWithRedirects(absoluteUrl, redirectCount + 1);
            return;
          }
        }

        if (fileResponse.statusCode !== 200) {
          // Consume response to free socket
          fileResponse.resume();

          // If fl_attachment URL failed, retry with original URL
          if (!isRetryWithOriginal && fetchUrl !== url) {
            console.log(`📎 fl_attachment URL returned ${fileResponse.statusCode}, retrying with original URL...`);
            fetchWithRedirects(url, 0, true);
            return;
          }

          if (!res.headersSent) {
            res.status(fileResponse.statusCode || 500).json({
              message: `File not found or unavailable (status: ${fileResponse.statusCode})`,
            });
          }
          return;
        }

        // Determine content type from file name (most reliable)
        // Cloudinary often returns wrong content-type for documents (e.g. image/png for PDFs)
        const nameBasedType = getContentTypeFromName(fileName);
        const serverContentType = fileResponse.headers["content-type"] || "";
        // Use name-based type if it's specific, otherwise use server's response
        const contentType =
          nameBasedType !== "application/octet-stream"
            ? nameBasedType
            : serverContentType || "application/octet-stream";

        // Set download headers
        res.setHeader("Content-Type", contentType);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(fileName)}"`
        );
        res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
        if (fileResponse.headers["content-length"]) {
          res.setHeader("Content-Length", fileResponse.headers["content-length"]);
        }

        // Pipe the file data to the response
        fileResponse.pipe(res);

        // Handle pipe errors
        fileResponse.on("error", (err) => {
          console.error("Download stream error:", err);
          if (!res.headersSent) {
            res.status(500).json({ message: "Error streaming file" });
          }
        });
      });

      request.on("error", (err) => {
        console.error("Download proxy request error:", err);
        if (!res.headersSent) {
          res.status(500).json({ message: "Error downloading file: " + err.message });
        }
      });

      request.on("timeout", () => {
        request.destroy();
        if (!res.headersSent) {
          res.status(504).json({ message: "Download request timed out" });
        }
      });
    };

    fetchWithRedirects(downloadUrl);
  } catch (error) {
    console.error("Download proxy error:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Error downloading file: " + error.message });
    }
  }
});

//@description     Send Call Record Message
//@route           POST /api/Message/call
//@access          Protected
const sendCallRecord = asyncHandler(async (req, res) => {
  const { chatId, callType, duration, status } = req.body;

  if (!chatId || !callType) {
    console.log("Invalid call data passed into request");
    return res.sendStatus(400);
  }

  const callIcons = {
    voice: "📞",
    video: "📹",
    "group-voice": "📞",
    "group-video": "📹",
    meeting: "🎥",
  };

  const callLabels = {
    voice: "Voice Call",
    video: "Video Call",
    "group-voice": "Group Voice Call",
    "group-video": "Group Video Call",
    meeting: "Group Meeting",
  };

  const icon = callIcons[callType] || "📞";
  const label = callLabels[callType] || "Call";

  // Format duration
  let durationStr = "";
  if (duration && duration > 0) {
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    durationStr = ` • ${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  const statusLabel = status === "missed" ? " (Missed)" : status === "declined" ? " (Declined)" : "";
  const content = `${icon} ${label}${durationStr}${statusLabel}`;

  var newMessage = {
    sender: req.user._id,
    content,
    chat: chatId,
    isCall: true,
    call: {
      callType,
      duration: duration || 0,
      status: status || "ended",
    },
  };

  try {
    var message = await Message.create(newMessage);

    message = await Message.findOne({ _id: message._id })
      .populate("sender", "name pic email")
      .populate("chat");

    message = await User.populate(message, {
      path: "chat.users",
      select: "name pic email",
    });

    await Chat.findByIdAndUpdate(chatId, { latestMessage: message });

    res.json(message);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

module.exports = { allMessages, sendMessage, sendFileMessage, sendLocationMessage, updateLiveLocation, downloadFileProxy, sendCallRecord };
